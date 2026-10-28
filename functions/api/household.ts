// ไฟล์: functions/api/household.ts

interface Env {
  DB: any; // Cloudflare D1 Binding
  TURNSTILE_SECRET_KEY?: string; // (ทางเลือก) ใส่ใน Cloudflare Env เมื่อต้องการเปิดโหมดเข้มงวดสูงสุด
}

// ระบบ Rate Limit ในหน่วยความจำของ Edge Worker (แยกตาม IP และประเภทคำสั่ง)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, action: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const key = `${ip}:${action}`;
  const record = rateLimitStore.get(key);

  // ล้างข้อมูลเก่าเพื่อไม่ให้ Memory เต็ม
  if (rateLimitStore.size > 5000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetTime) rateLimitStore.delete(k);
    }
  }

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false; // เกินโควตา บล็อกทันที
  }

  record.count += 1;
  return true;
}

// ตรวจสอบรูปแบบบ้านเลขที่: อนุญาตเฉพาะตัวเลขอารบิก 0-9 และเครื่องหมาย / เท่านั้น (เช่น 100, 125/3)
const HOUSE_NO_REGEX = /^[0-9]{1,5}(\/[0-9]{1,4})?$/;

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  // 1. ป้องกันการยิงข้ามโดเมน (CSRF / External Script Attack)
  const origin = request.headers.get("Origin") || "";
  const host = request.headers.get("Host") || "";
  if (origin && !origin.includes(host) && !origin.includes("localhost")) {
    return new Response(JSON.stringify({ error: "ไม่อนุญาตให้เข้าถึงข้ามโดเมน" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ดึง IP จริงของผู้ใช้งานจาก Cloudflare Header
  const clientIp = request.headers.get("CF-Connecting-IP") || "127.0.0.1";

  try {
    const body: any = await request.json();
    const { action, houseNumber, moo, website_hp } = body;

    // 2. Honeypot Trap: ถ้าช่องดักบอทมีค่าส่งมา แปลว่าเป็นสคริปต์ยิงถล่ม
    if (website_hp) {
      return new Response(JSON.stringify({ error: "ตรวจพบพฤติกรรมผิดปกติ" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. ตรวจสอบความถูกต้องของข้อมูล (Strict Input Validation)
    const cleanHouseNo = String(houseNumber || "").trim();
    const cleanMoo = Number(moo);

    if (!HOUSE_NO_REGEX.test(cleanHouseNo)) {
      return new Response(
        JSON.stringify({ error: "รูปแบบบ้านเลขที่ไม่ถูกต้อง (ใช้เลขอารบิก 0-9 และ / เท่านั้น)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!Number.isInteger(cleanMoo) || cleanMoo < 1 || cleanMoo > 7) {
      return new Response(
        JSON.stringify({ error: "กรุณาเลือกหมู่ที่ 1 ถึง 7 เท่านั้น" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // =========================================================
    // โหมดที่ 1: เช็คว่ามีบ้านนี้ในระบบหรือยัง (action === "check")
    // =========================================================
    if (action === "check") {
      // จำกัดการค้นหาไม่เกิน 12 ครั้ง ต่อ 1 นาที ต่อ 1 IP
      if (!checkRateLimit(clientIp, "check", 12, 60 * 1000)) {
        return new Response(
          JSON.stringify({ error: "คุณทำรายการเร็วเกินไป กรุณารอสักครู่แล้วลองใหม่ค่ะ" }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }

      const existing = await env.DB.prepare(
        "SELECT id, house_number, moo, qgis_id FROM households WHERE house_number = ?1 AND moo = ?2 LIMIT 1"
      )
        .bind(cleanHouseNo, cleanMoo)
        .first();

      if (existing) {
        return new Response(
          JSON.stringify({ exists: true, household: existing }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // ถ้ายังไม่พบบ้านนี้ ให้ส่ง exists: false เพื่อให้หน้าบ้านเด้ง Modal ยืนยัน
      return new Response(
        JSON.stringify({ exists: false }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // =========================================================
    // โหมดที่ 2: ยืนยันเพิ่มครัวเรือนใหม่ลงฐานข้อมูล (action === "create")
    // =========================================================
    if (action === "create") {
      // จำกัดการสร้างบ้านใหม่เข้มงวดพิเศษ: ไม่เกิน 3 ครั้ง ต่อ 10 นาที ต่อ 1 IP (ป้องกันการปั๊มบ้านปลอม)
      if (!checkRateLimit(clientIp, "create", 3, 10 * 60 * 1000)) {
        return new Response(
          JSON.stringify({ error: "เพิ่มข้อมูลครัวเรือนเกินกำหนด กรุณารอ 10 นาที" }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }

      // บันทึกครัวเรือนใหม่ (หากมีคนกดซ้ำพร้อมกัน จะไม่ Error ด้วย ON CONFLICT)
      await env.DB.prepare(
        `INSERT INTO households (house_number, moo) 
         VALUES (?1, ?2) 
         ON CONFLICT(house_number, moo) DO NOTHING`
      )
        .bind(cleanHouseNo, cleanMoo)
        .run();

      const created = await env.DB.prepare(
        "SELECT id, house_number, moo, qgis_id FROM households WHERE house_number = ?1 AND moo = ?2 LIMIT 1"
      )
        .bind(cleanHouseNo, cleanMoo)
        .first();

      return new Response(
        JSON.stringify({ success: true, household: created }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "คำสั่งไม่ถูกต้อง" }), { status: 400 });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "ระบบฐานข้อมูลขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};