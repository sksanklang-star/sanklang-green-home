// ไฟล์: functions/api/household.ts (ทำงานบน Cloudflare Pages จริง - Hardened Security)
interface Env {
  DB: any; // Cloudflare D1 Binding
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, action: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (rateLimitStore.size > 5000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetTime) rateLimitStore.delete(k);
    }
  }

  const key = `${ip}:${action}`;
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (record.count >= limit) return false;
  record.count += 1;
  return true;
}

const HOUSE_NO_REGEX = /^[0-9]{1,5}(\/[0-9]{1,4})?$/;

// 🔒 ตรวจสอบพิกัดให้อยู่ในเขตจังหวัดเชียงใหม่ / สันกลาง-สันกำแพง
function isValidChiangMaiCoord(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= 18.5 && lat <= 19.1 && lng >= 98.8 && lng <= 99.3;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  // 1. ป้องกันการยิงข้ามโดเมน (CSRF)
  const origin = request.headers.get("Origin") || "";
  const host = request.headers.get("Host") || "";
  if (origin && !origin.includes(host) && !origin.includes("localhost")) {
    return new Response(JSON.stringify({ error: "ไม่อนุญาตให้เข้าถึงข้ามโดเมน" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!env.DB) {
    return new Response(
      JSON.stringify({ error: "ยังไม่ได้ผูก D1 Binding ชื่อ 'DB' บน Cloudflare Pages" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const clientIp = request.headers.get("CF-Connecting-IP") || "127.0.0.1";

  try {
    const body: any = await request.json();
    const { action, website_hp } = body;

    // 2. Honeypot Trap
    if (website_hp) {
      return new Response(JSON.stringify({ error: "ตรวจพบพฤติกรรมผิดปกติ" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================================================
    // โหมดที่ 1: เช็คบ้านตอน Login (action === "check")
    // =========================================================
    if (action === "check") {
      if (!checkRateLimit(clientIp, "check", 12, 60 * 1000)) {
        return new Response(
          JSON.stringify({ error: "คุณทำรายการเร็วเกินไป กรุณารอสักครู่แล้วลองใหม่ค่ะ" }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }

      const cleanHouseNo = String(body.houseNumber || "").trim();
      const cleanMoo = Number(body.moo);

      if (!HOUSE_NO_REGEX.test(cleanHouseNo) || !Number.isInteger(cleanMoo) || cleanMoo < 1 || cleanMoo > 7) {
        return new Response(
          JSON.stringify({ error: "ข้อมูลบ้านเลขที่หรือหมู่ไม่ถูกต้อง" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const existing = await env.DB.prepare(
        "SELECT id, house_number, moo, qgis_id, lat, lng FROM households WHERE house_number = ?1 AND moo = ?2 LIMIT 1"
      )
        .bind(cleanHouseNo, cleanMoo)
        .first();

      if (existing) {
        return new Response(JSON.stringify({ exists: true, household: existing }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ exists: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================================================
    // โหมดที่ 2: สร้างบ้านใหม่ตอน Login (action === "create")
    // =========================================================
    if (action === "create") {
      if (!checkRateLimit(clientIp, "create", 3, 10 * 60 * 1000)) {
        return new Response(
          JSON.stringify({ error: "เพิ่มข้อมูลครัวเรือนเกินกำหนด กรุณารอ 10 นาที" }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }

      const cleanHouseNo = String(body.houseNumber || "").trim();
      const cleanMoo = Number(body.moo);

      if (!HOUSE_NO_REGEX.test(cleanHouseNo) || !Number.isInteger(cleanMoo) || cleanMoo < 1 || cleanMoo > 7) {
        return new Response(
          JSON.stringify({ error: "ข้อมูลบ้านเลขที่หรือหมู่ไม่ถูกต้อง" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      await env.DB.prepare(
        "INSERT INTO households (house_number, moo) VALUES (?1, ?2) ON CONFLICT(house_number, moo) DO NOTHING"
      )
        .bind(cleanHouseNo, cleanMoo)
        .run();

      const created = await env.DB.prepare(
        "SELECT id, house_number, moo, qgis_id, lat, lng FROM households WHERE house_number = ?1 AND moo = ?2 LIMIT 1"
      )
        .bind(cleanHouseNo, cleanMoo)
        .first();

      return new Response(JSON.stringify({ success: true, household: created }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================================================
    // โหมดที่ 3: ดึงข้อมูลบ้านล่าสุดตาม ID (action === "get_info")
    // =========================================================
    if (action === "get_info") {
      if (!checkRateLimit(clientIp, "get_info", 30, 60 * 1000)) {
        return new Response(JSON.stringify({ error: "เรียกข้อมูลถี่เกินไป" }), { status: 429 });
      }

      const householdId = Number(body.householdId);
      if (!Number.isInteger(householdId) || householdId <= 0 || householdId > 999999) {
        return new Response(JSON.stringify({ error: "รหัสครัวเรือนไม่ถูกต้อง" }), { status: 400 });
      }

      const household = await env.DB.prepare(
        "SELECT id, house_number, moo, qgis_id, lat, lng FROM households WHERE id = ?1 LIMIT 1"
      )
        .bind(householdId)
        .first();

      if (!household) {
        return new Response(JSON.stringify({ error: "ไม่พบข้อมูลบ้าน" }), { status: 404 });
      }

      return new Response(JSON.stringify({ household }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================================================
    // โหมดที่ 4: บันทึกพิกัดบ้าน lat, lng (action === "update_location")
    // =========================================================
    if (action === "update_location") {
      if (!checkRateLimit(clientIp, "update_loc", 6, 60 * 1000)) {
        return new Response(
          JSON.stringify({ error: "บันทึกพิกัดถี่เกินไป กรุณารอสักครู่" }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }

      const householdId = Number(body.householdId);
      const lat = Number(Number(body.lat).toFixed(6));
      const lng = Number(Number(body.lng).toFixed(6));

      if (!Number.isInteger(householdId) || householdId <= 0 || householdId > 999999) {
        return new Response(JSON.stringify({ error: "รหัสครัวเรือนไม่ถูกต้อง" }), { status: 400 });
      }

      if (!isValidChiangMaiCoord(lat, lng)) {
        return new Response(
          JSON.stringify({ error: "พิกัดอยู่นอกเขตพื้นที่จังหวัดเชียงใหม่ กรุณาตรวจสอบตำแหน่งอีกครั้ง" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      await env.DB.prepare("UPDATE households SET lat = ?1, lng = ?2 WHERE id = ?3")
        .bind(lat, lng, householdId)
        .run();

      const updated = await env.DB.prepare(
        "SELECT id, house_number, moo, qgis_id, lat, lng FROM households WHERE id = ?1 LIMIT 1"
      )
        .bind(householdId)
        .first();

      return new Response(JSON.stringify({ success: true, household: updated }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================================================
    // โหมดที่ 5: แจ้งข้อมูลบ้านไม่ถูกต้อง (action === "report_issue")
    // =========================================================
    if (action === "report_issue") {
      // จำกัดไม่เกิน 3 ครั้ง ต่อ 10 นาที ต่อ 1 IP ป้องกันบอทยิงสแปมกล่องข้อความเจ้าหน้าที่
      if (!checkRateLimit(clientIp, "report_issue", 3, 10 * 60 * 1000)) {
        return new Response(
          JSON.stringify({ error: "คุณส่งเรื่องแจ้งเจ้าหน้าที่แล้ว กรุณารอ 10 นาทีก่อนส่งซ้ำค่ะ" }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }

      const householdId = Number(body.householdId);
      const cleanDetail = String(body.detail || "")
        .replace(/[<>]/g, "")
        .trim()
        .slice(0, 500);

      if (!Number.isInteger(householdId) || householdId <= 0 || householdId > 999999) {
        return new Response(JSON.stringify({ error: "รหัสครัวเรือนไม่ถูกต้อง" }), { status: 400 });
      }

      if (cleanDetail.length < 3) {
        return new Response(
          JSON.stringify({ error: "กรุณาระบุรายละเอียดอย่างน้อย 3 ตัวอักษร" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      await env.DB.prepare("INSERT INTO household_reports (household_id, detail) VALUES (?1, ?2)")
        .bind(householdId, cleanDetail)
        .run();

      return new Response(JSON.stringify({ success: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "คำสั่งไม่ถูกต้อง" }), { status: 400 });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "ระบบฐานข้อมูลขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};