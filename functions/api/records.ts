// ไฟล์: functions/api/records.ts (ทำงานบน Cloudflare Pages จริง - Hardened Security + Weight KG + Trash Quarantine)
interface Env {
  DB: any;     // D1 Binding
  BUCKET: any; // R2 Bucket Binding
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, action: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
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

const isValidDateStr = (dateStr: string | null): boolean => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().startsWith(dateStr);
};

// 🔒 จำกัดค่าน้ำหนักให้อยู่ระหว่าง 0 - 500 กก. ทศนิยมไม่เกิน 2 ตำแหน่ง
function sanitizeWeightKg(val: unknown): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return 0;
  if (num > 500) return 500;
  return Math.round(num * 100) / 100;
}

// 🔒 ตรวจว่าวันที่บันทึกต้องไม่ใช่วันในอนาคต และไม่ย้อนหลังเกิน 7 วัน
const isWithinEditableWindow = (dateStr: string): boolean => {
  const nowThai = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const todayStr = nowThai.toISOString().split("T")[0];

  const minDate = new Date(nowThai);
  minDate.setUTCDate(minDate.getUTCDate() - 7);
  const minDateStr = minDate.toISOString().split("T")[0];

  return dateStr >= minDateStr && dateStr <= todayStr;
};

function isGenuineImageBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true;
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return true;
  }
  return false;
}

// 🔒 แปลง URL รูปภาพ (/api/image?key=...) กลับมาเป็น R2 Key และตรวจสอบว่าเป็นไฟล์ของบ้านนั้นจริง
function extractOwnedR2Key(imageUrl: string, householdId: number): string | null {
  if (!imageUrl.startsWith("/api/image?key=")) return null;
  try {
    const rawKey = decodeURIComponent(imageUrl.slice("/api/image?key=".length));
    if (rawKey.includes("..") || rawKey.startsWith("trash/")) return null;
    // ตรวจสอบว่าชื่อไฟล์เป็นของบ้านนี้จริง (_h{householdId}_ หรือ /h{householdId}_) ป้องกันการสั่งลบรูปบ้านอื่น
    if (!rawKey.includes(`/h${householdId}_`)) return null;
    return rawKey;
  } catch {
    return null;
  }
}

// 🗑️ ฟังก์ชันย้ายไฟล์รูปที่ถูกลบหรือถูกเปลี่ยนไปยังโฟลเดอร์ trash/ บน R2 พร้อมเก็บหลักฐาน IP และเวลาที่ลบ
async function moveR2ImageToTrash(
  bucket: any,
  imageUrl: string,
  householdId: number,
  clientIp: string
): Promise<void> {
  if (!bucket) return;
  const r2Key = extractOwnedR2Key(imageUrl, householdId);
  if (!r2Key) return;

  try {
    const existingObj = await bucket.get(r2Key);
    if (!existingObj) return;

    // ย้ายไปไว้ที่ trash/{catId}/{recordDate}/{fileName}
    const trashKey = `trash/${r2Key}`;

    await bucket.put(trashKey, existingObj.body, {
      httpMetadata: existingObj.httpMetadata,
      customMetadata: {
        deletedAt: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
        deletedByIp: clientIp,
        householdId: String(householdId),
        originalKey: r2Key,
      },
    });

    // ลบไฟล์ออกจากโฟลเดอร์หลัก เพื่อไม่ให้หน้าเว็บเรียกดูผ่าน /api/image ได้อีก
    await bucket.delete(r2Key);
  } catch (err) {
    // กรณีไฟล์ต้นทางไม่มีอยู่แล้ว ให้ข้ามไปโดยไม่ทำให้ระบบหลักล่ม
  }
}

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
      "SELECT id, household_id, category_id, record_date, images, weight_kg, points, created_at, updated_at FROM waste_records WHERE household_id = ?";
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

    query += " ORDER BY record_date DESC, id DESC LIMIT 200";

    const result = await env.DB.prepare(query).bind(...params).all();
    const rows = result.results || [];

    const records = rows.map((r: any) => ({
      ...r,
      weight_kg: Number(r.weight_kg) || 0,
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

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  const origin = request.headers.get("Origin") || "";
  const host = request.headers.get("Host") || "";
  if (origin && !origin.includes(host) && !origin.includes("localhost")) {
    return new Response(JSON.stringify({ error: "ไม่อนุญาตให้เข้าถึงข้ามโดเมน" }), { status: 403 });
  }

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
    const selectedIds = Array.from(new Set(rawSelectedIds)).slice(0, 8);
    const imagesByCategory: Record<string, string[]> = body.imagesByCategory || {};
    const weightsByCategory: Record<string, number | string> = body.weightsByCategory || {};

    if (!Number.isInteger(householdId) || householdId <= 0 || householdId > 999999 || !isValidDateStr(recordDate)) {
      return new Response(JSON.stringify({ error: "ข้อมูลไม่ครบถ้วนหรือรูปแบบไม่ถูกต้อง" }), { status: 400 });
    }

    const houseExists = await env.DB.prepare("SELECT id FROM households WHERE id = ?1 LIMIT 1")
      .bind(householdId)
      .first();
    if (!houseExists) {
      return new Response(JSON.stringify({ error: "ไม่พบข้อมูลครัวเรือนนี้ในระบบ" }), { status: 404 });
    }

    if (!isWithinEditableWindow(recordDate)) {
      return new Response(JSON.stringify({ error: "บันทึกหรือแก้ไขได้เฉพาะภายใน 7 วันย้อนหลังเท่านั้น" }), { status: 400 });
    }

    // 1. ตรวจสอบความถูกต้องของหมวดหมู่ รูปภาพ และน้ำหนักก่อนแตะฐานข้อมูล
    for (const catId of selectedIds) {
      if (!VALID_CATEGORIES.includes(catId)) {
        return new Response(JSON.stringify({ error: "พบหมวดหมู่ขยะไม่ถูกต้อง" }), { status: 400 });
      }
      const imgs = imagesByCategory[catId];
      const weight = sanitizeWeightKg(weightsByCategory[catId]);

      if (!Array.isArray(imgs) || imgs.length === 0) {
        return new Response(
          JSON.stringify({ error: "ทุกหมวดหมู่ที่บันทึกต้องมีรูปภาพอย่างน้อย 1 รูป" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      if (weight <= 0) {
        return new Response(
          JSON.stringify({ error: "กรุณาระบุน้ำหนัก (กิโลกรัม) มากกว่า 0 ทุกหมวดหมู่ที่แนบรูป" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 2. ดึงรายการรูปเดิมของบ้านนี้ในวันนั้นออกมา เพื่อตรวจสอบว่ามีรูปไหนถูกลบออกบ้าง
    const existingRes = await env.DB.prepare(
      "SELECT category_id, images FROM waste_records WHERE household_id = ?1 AND record_date = ?2"
    )
      .bind(householdId, recordDate)
      .all();

    const oldImagesByCat = new Map<string, string[]>();
    for (const row of existingRes?.results || []) {
      try {
        oldImagesByCat.set(String(row.category_id), JSON.parse(row.images || "[]"));
      } catch {
        oldImagesByCat.set(String(row.category_id), []);
      }
    }

    // 3. กรณีผู้ใช้ลบรูปออกหมดทุกหมวดหมู่ในวันนั้น -> ย้ายรูปเก่าทั้งหมดเข้า trash/ แล้วลบ Row
    if (selectedIds.length === 0) {
      for (const oldUrls of oldImagesByCat.values()) {
        for (const oldUrl of oldUrls) {
          await moveR2ImageToTrash(env.BUCKET, oldUrl, householdId, clientIp);
        }
      }
      await env.DB.prepare("DELETE FROM waste_records WHERE household_id = ?1 AND record_date = ?2")
        .bind(householdId, recordDate)
        .run();
      return new Response(JSON.stringify({ success: true, savedCount: 0 }), { status: 200 });
    }

    // 4. กรณีมีบางหมวดหมู่ที่เคยบันทึกไว้ แต่รอบนี้ถูกลบรูปออกจนไม่ถูกเลือกแล้ว -> ย้ายรูปของหมวดนั้นเข้า trash/
    for (const [oldCatId, oldUrls] of oldImagesByCat.entries()) {
      if (!selectedIds.includes(oldCatId)) {
        for (const oldUrl of oldUrls) {
          await moveR2ImageToTrash(env.BUCKET, oldUrl, householdId, clientIp);
        }
      }
    }

    const placeholders = selectedIds.map(() => "?").join(",");
    await env.DB.prepare(
      `DELETE FROM waste_records WHERE household_id = ? AND record_date = ? AND category_id NOT IN (${placeholders})`
    )
      .bind(householdId, recordDate, ...selectedIds)
      .run();

    // 5. วนลูปบันทึกหมวดหมู่ที่เลือก และย้ายเฉพาะรูปที่ถูกกดลบออกในแต่ละหมวดเข้า trash/
    for (const catId of selectedIds) {
      const weightKg = sanitizeWeightKg(weightsByCategory[catId]);
      const rawList = Array.isArray(imagesByCategory[catId])
        ? imagesByCategory[catId].slice(0, 3)
        : [];

      const finalUrls: string[] = [];

      for (const item of rawList) {
        if (typeof item !== "string") continue;

        // ถ้ารูปเดิมยังถูกเก็บไว้
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

        if (!["jpeg", "jpg", "png", "webp", "gif"].includes(subType)) continue;
        if (base64Data.length > 2800000) continue;

        const binaryStr = atob(base64Data);
        if (binaryStr.length > 2 * 1024 * 1024) continue;

        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        if (!isGenuineImageBytes(bytes)) continue;

        const ext = subType.includes("webp") ? "webp" : subType.includes("png") ? "png" : "jpg";
        const r2Key = `${catId}/${recordDate}/h${householdId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;

        await env.BUCKET.put(r2Key, bytes.buffer, {
          httpMetadata: { contentType: mimeType },
        });

        finalUrls.push(`/api/image?key=${encodeURIComponent(r2Key)}`);
      }

      // เช็คว่าในหมวดนี้ มีรูปเก่าใบไหนที่ผู้ใช้กดลบทิ้งหรือเปลี่ยนออกบ้าง -> ย้ายเข้า trash/
      const previousUrls = oldImagesByCat.get(catId) || [];
      for (const oldUrl of previousUrls) {
        if (!finalUrls.includes(oldUrl)) {
          await moveR2ImageToTrash(env.BUCKET, oldUrl, householdId, clientIp);
        }
      }

      if (finalUrls.length === 0) {
        return new Response(
          JSON.stringify({
            error: `รูปภาพในหมวด "${catId}" ไม่สามารถอัปโหลดได้ (รองรับเฉพาะไฟล์รูป JPG, PNG, WebP ขนาดไม่เกิน 2MB)`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      await env.DB.prepare(
        `INSERT INTO waste_records (household_id, category_id, record_date, images, weight_kg, points)
         VALUES (?1, ?2, ?3, ?4, ?5, 1)
         ON CONFLICT(household_id, category_id, record_date)
         DO UPDATE SET
           images = excluded.images,
           weight_kg = excluded.weight_kg,
           updated_at = datetime('now', '+7 hours')`
      )
        .bind(householdId, catId, recordDate, JSON.stringify(finalUrls), weightKg)
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