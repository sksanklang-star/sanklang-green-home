// ไฟล์: functions/api/records.ts (ทำงานบน Cloudflare Pages จริง)
interface Env {
  DB: any;     // D1 Binding
  BUCKET: any; // R2 Bucket Binding
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, action: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
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

    if (!householdId) {
      return new Response(JSON.stringify({ error: "ไม่พบรหัสครัวเรือน" }), { status: 400 });
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
        query += " AND category_id = ?";
        params.push(categoryId);
      }
    }

    query += " ORDER BY record_date DESC, id DESC";

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

  const origin = request.headers.get("Origin") || "";
  const host = request.headers.get("Host") || "";
  if (origin && !origin.includes(host) && !origin.includes("localhost")) {
    return new Response(JSON.stringify({ error: "ไม่อนุญาตให้เข้าถึงข้ามโดเมน" }), { status: 403 });
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
    const selectedIds: string[] = Array.isArray(body.categories) ? body.categories : [];
    const imagesByCategory: Record<string, string[]> = body.imagesByCategory || {};

    if (!householdId || !/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
      return new Response(JSON.stringify({ error: "ข้อมูลไม่ครบถ้วน" }), { status: 400 });
    }

    if (selectedIds.length === 0) {
      await env.DB.prepare("DELETE FROM waste_records WHERE household_id = ?1 AND record_date = ?2")
        .bind(householdId, recordDate)
        .run();
      return new Response(JSON.stringify({ success: true, savedCount: 0 }), { status: 200 });
    } else {
      const placeholders = selectedIds.map(() => "?").join(",");
      await env.DB.prepare(
        `DELETE FROM waste_records WHERE household_id = ? AND record_date = ? AND category_id NOT IN (${placeholders})`
      )
        .bind(householdId, recordDate, ...selectedIds)
        .run();
    }

    for (const catId of selectedIds) {
      if (!VALID_CATEGORIES.includes(catId)) continue;

      const rawList = Array.isArray(imagesByCategory[catId])
        ? imagesByCategory[catId].slice(0, 3)
        : [];

      const finalUrls: string[] = [];

      for (const item of rawList) {
        if (typeof item !== "string") continue;

        // ถ้ารูปเดิมเคยอยู่บน R2 หรือ Local แล้ว ให้คง URL เดิมไว้ ไม่ต้องอัปโหลดซ้ำ
        if (item.startsWith("/api/image") || item.startsWith("/uploads/")) {
          finalUrls.push(item);
          continue;
        }

        const match = /^data:(image\/([a-zA-Z0-9+.-]+));base64,(.+)$/.exec(item);
        if (!match) continue;

        if (!env.BUCKET) {
          return new Response(
            JSON.stringify({ error: "ยังไม่ได้ผูก R2 Bucket ชื่อ 'BUCKET' ในหน้า Settings -> Bindings" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        const mimeType = match[1];
        const subType = match[2].toLowerCase();
        const ext = subType.includes("webp") ? "webp" : subType.includes("png") ? "png" : "jpg";
        const binaryStr = atob(match[3]);

        if (binaryStr.length > 2 * 1024 * 1024) continue;

        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

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