// ไฟล์: functions/api/records.ts (ทำงานบน Cloudflare Pages จริง - Hardened Security)
interface Env {
  DB: any;     // D1 Binding
  BUCKET: any; // R2 Bucket Binding
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, action: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  // ล้าง Memory อัตโนมัติหากมี IP สะสมเกิน 5,000 รายการ (กัน Memory Leak ตอนโดน DDoS)
  if (rateLimitMap.size > 5000) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (now > v.resetAt) rateLimitMap.delete(k);
    }
  }

  const key = `${ip}:${action}`;
  const record = rateLimitMap.get(key);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= limit) return false;
  record.count += 1;
  return true;
}

const VALID_CATEGORIES = [
  "food", "leaves", "plastic", "paper", "glass", "can", "general", "hazardous",
];

// ตรวจฟอร์แมตวันที่มาตรฐาน (YYYY-MM-DD) และตรวจว่าเป็นวันที่ที่มีอยู่จริงในปฏิทิน
const isValidDateStr = (dateStr: string | null): boolean => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().startsWith(dateStr);
};

// 🔒 ตรวจว่าวันที่บันทึกต้องไม่ใช่วันในอนาคต และไม่ย้อนหลังเกิน 7 วัน (ตามกติกาเทศบาล)
const isWithinEditableWindow = (dateStr: string): boolean => {
  // เวลาปัจจุบันของประเทศไทย (UTC+7)
  const nowThai = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const todayStr = nowThai.toISOString().split("T")[0];

  const minDate = new Date(nowThai);
  minDate.setUTCDate(minDate.getUTCDate() - 7);
  const minDateStr = minDate.toISOString().split("T")[0];

  return dateStr >= minDateStr && dateStr <= todayStr;
};

// 🔒 ตรวจลายเซ็นไฟล์จริง (Magic Bytes) ป้องกันการปลอมแปลงไฟล์ .exe / .html เป็นรูปภาพ
function isGenuineImageBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true;
  // WEBP: RIFF....WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return true;
  }
  return false;
}

// ============================================================================
// GET: ดึงรายการบันทึกขยะตามวันที่หรือช่วงเวลา
// ============================================================================
export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const clientIp = request.headers.get("CF-Connecting-IP") || "127.0.0.1";

  if (!checkRateLimit(clientIp, "get_records", 30, 60 * 1000)) {
    return new Response(JSON.stringify({ error: "เรียกข้อมูลถี่เกินไป กรุณารอสักครู่" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "ยังไม่ได้ผูก D1 Binding ชื่อ DB" }), { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const householdId = Number(searchParams.get("householdId"));
    const recordDate = searchParams.get("date");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const categoryId = searchParams.get("category");

    if (!Number.isInteger(householdId) || householdId <= 0 || householdId > 999999) {
      return new Response(JSON.stringify({ error: "รหัสครัวเรือนไม่ถูกต้อง" }), { status: 400 });
    }

    if (recordDate && !isValidDateStr(recordDate)) {
      return new Response(JSON.stringify({ error: "รูปแบบวันที่ไม่ถูกต้อง" }), { status: 400 });
    }
    if (startDate && !isValidDateStr(startDate)) {
      return new Response(JSON.stringify({ error: "รูปแบบวันที่เริ่มต้นไม่ถูกต้อง" }), { status: 400 });
    }
    if (endDate && !isValidDateStr(endDate)) {
      return new Response(JSON.stringify({ error: "รูปแบบวันที่สิ้นสุดไม่ถูกต้อง" }), { status: 400 });
    }

    let query =
      "SELECT id, household_id, category_id, record_date, images, points, created_at, updated_at FROM waste_records WHERE household_id = ?";
    const params: any[] = [householdId];

    if (recordDate) {
      query += " AND record_date = ?";
      params.push(recordDate);
    } else {
      if (startDate) {
        query += " AND record_date >= ?";
        params.push(startDate);
      }
      if (endDate) {
        query += " AND record_date <= ?";
        params.push(endDate);
      }
      if (categoryId && categoryId !== "all") {
        if (!VALID_CATEGORIES.includes(categoryId)) {
          return new Response(JSON.stringify({ error: "หมวดหมู่ไม่ถูกต้อง" }), { status: 400 });
        }
        query += " AND category_id = ?";
        params.push(categoryId);
      }
    }

    // จำกัดสูงสุด 200 รายการต่อการดึง 1 ครั้ง ป้องกันการดึงข้อมูลหนักเกินไป
    query += " ORDER BY record_date DESC, id DESC LIMIT 200";

    const result = await env.DB.prepare(query).bind(...params).all();
    const rows = result.results || [];

    const records = rows.map((r: any) => ({
      ...r,
      images: JSON.parse(r.images || "[]"),
    }));

    return new Response(JSON.stringify({ records }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "ไม่สามารถดึงข้อมูลได้" }), { status: 500 });
  }
};

// ============================================================================
// POST: บันทึกและอัปเดตข้อมูลพร้อมรูปภาพขึ้น R2
// ============================================================================
export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  // 1. ตรวจสอบ Origin ป้องกันการยิงข้ามโดเมน (CSRF)
  const origin = request.headers.get("Origin") || "";
  const host = request.headers.get("Host") || "";
  if (origin && !origin.includes(host) && !origin.includes("localhost")) {
    return new Response(JSON.stringify({ error: "ไม่อนุญาตให้เข้าถึงข้ามโดเมน" }), { status: 403 });
  }

  // 2. จำกัดขนาด Payload รวมไม่ให้เกิน 15MB ป้องกันการยิง JSON ขนาดยักษ์ทำให้ Worker ค้าง
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 15 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: "ขนาดข้อมูลใหญ่เกินกำหนด" }), { status: 413 });
  }

  const clientIp = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
  if (!checkRateLimit(clientIp, "post_records", 10, 60 * 1000)) {
    return new Response(
      JSON.stringify({ error: "คุณส่งข้อมูลถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ค่ะ" }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "ยังไม่ได้ผูก D1 Binding ชื่อ DB" }), { status: 500 });
  }

  try {
    const body: any = await request.json();
    const householdId = Number(body.householdId);
    const recordDate = String(body.recordDate || "").trim();
    const rawSelectedIds: string[] = Array.isArray(body.categories) ? body.categories : [];
    // ตัดค่าซ้ำกันออกอัตโนมัติ และจำกัดไม่เกิน 8 ชนิด
    const selectedIds = Array.from(new Set(rawSelectedIds)).slice(0, 8);
    const imagesByCategory: Record<string, string[]> = body.imagesByCategory || {};

    if (!Number.isInteger(householdId) || householdId <= 0 || householdId > 999999 || !isValidDateStr(recordDate)) {
      return new Response(JSON.stringify({ error: "ข้อมูลไม่ครบถ้วนหรือรูปแบบไม่ถูกต้อง" }), { status: 400 });
    }

    // 🔒 3. ตรวจสอบว่า householdId นี้มีอยู่จริงในตาราง households หรือไม่
    const houseExists = await env.DB.prepare("SELECT id FROM households WHERE id = ?1 LIMIT 1")
      .bind(householdId)
      .first();
    if (!houseExists) {
      return new Response(JSON.stringify({ error: "ไม่พบข้อมูลครัวเรือนนี้ในระบบ" }), { status: 404 });
    }

    // (ทางเลือก) หากต้องการเปิดบังคับห้ามแก้ไขย้อนหลังเกิน 7 วัน ให้เอาคอมเมนต์ 3 บรรทัดนี้ออกได้ครับ
    // if (!isWithinEditableWindow(recordDate)) {
    //   return new Response(JSON.stringify({ error: "บันทึกหรือแก้ไขได้เฉพาะภายใน 7 วันย้อนหลังเท่านั้น" }), { status: 400 });
    // }

    if (selectedIds.length === 0) {
      await env.DB.prepare("DELETE FROM waste_records WHERE household_id = ?1 AND record_date = ?2")
        .bind(householdId, recordDate)
        .run();
      return new Response(JSON.stringify({ success: true, savedCount: 0 }), { status: 200 });
    } else {
      for (const id of selectedIds) {
        if (!VALID_CATEGORIES.includes(id)) {
          return new Response(JSON.stringify({ error: "พบหมวดหมู่ขยะไม่ถูกต้อง" }), { status: 400 });
        }
      }

      const placeholders = selectedIds.map(() => "?").join(",");
      await env.DB.prepare(
        `DELETE FROM waste_records WHERE household_id = ? AND record_date = ? AND category_id NOT IN (${placeholders})`
      )
        .bind(householdId, recordDate, ...selectedIds)
        .run();
    }

    for (const catId of selectedIds) {
      const rawList = Array.isArray(imagesByCategory[catId])
        ? imagesByCategory[catId].slice(0, 3)
        : [];

      const finalUrls: string[] = [];

      for (const item of rawList) {
        if (typeof item !== "string") continue;

        // 🔒 ตรวจสอบ URL รูปเดิมให้ปลอดภัยและไม่ยาวผิดปกติ
        if (
          (item.startsWith("/api/image?key=") || item.startsWith("/uploads/")) &&
          item.length < 200 &&
          !/[<>"'\\]/.test(item)
        ) {
          finalUrls.push(item);
          continue;
        }

        const match = /^data:(image\/([a-zA-Z0-9+.-]+));base64,([A-Za-z0-9+/=]+)$/.exec(item);
        if (!match) continue;

        if (!env.BUCKET) {
          return new Response(
            JSON.stringify({ error: "ยังไม่ได้ผูก R2 Bucket" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        const mimeType = match[1];
        const subType = match[2].toLowerCase();
        const base64Data = match[3];

        // 🔒 จำกัดนามสกุลเฉพาะรูปภาพปลอดภัย
        if (!["jpeg", "jpg", "png", "webp", "gif"].includes(subType)) {
          continue;
        }

        // 🔒 เช็คความยาว Base64 ก่อนเรียก atob() เพื่อป้องกัน Worker CPU/Memory เต็ม (2MB ~ 2,800,000 ตัวอักษร)
        if (base64Data.length > 2800000) {
          continue;
        }

        const binaryStr = atob(base64Data);
        if (binaryStr.length > 2 * 1024 * 1024) continue;

        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        // 🔒 ตรวจสอบ Magic Bytes ยืนยันว่าเป็นไฟล์รูปภาพจริง ไม่ใช่ไฟล์สคริปต์ปลอมแปลง
        if (!isGenuineImageBytes(bytes)) {
          continue;
        }

        const ext = subType.includes("webp") ? "webp" : subType.includes("png") ? "png" : "jpg";
        const r2Key = `${catId}/${recordDate}/h${householdId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;

        await env.BUCKET.put(r2Key, bytes.buffer, {
          httpMetadata: { contentType: mimeType },
        });

        finalUrls.push(`/api/image?key=${encodeURIComponent(r2Key)}`);
      }

      await env.DB.prepare(
        `INSERT INTO waste_records (household_id, category_id, record_date, images, points)
         VALUES (?1, ?2, ?3, ?4, 1)
         ON CONFLICT(household_id, category_id, record_date)
         DO UPDATE SET
           images = excluded.images,
           updated_at = datetime('now', '+7 hours')`
      )
        .bind(householdId, catId, recordDate, JSON.stringify(finalUrls))
        .run();
    }

    return new Response(JSON.stringify({ success: true, savedCount: selectedIds.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "ไม่สามารถบันทึกข้อมูลได้" }), { status: 500 });
  }
};