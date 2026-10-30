// ไฟล์: functions/api/community.ts (ทำงานบน Cloudflare Pages จริง - Hardened & Optimized + Weight KG)
interface Env {
  DB: any; // D1 Binding
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (rateLimitMap.size > 5000) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (now > v.resetAt) rateLimitMap.delete(k);
    }
  }
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= limit) return false;
  record.count += 1;
  return true;
}

const DEFAULT_BASE_HOUSEHOLDS: Record<number, number> = {
  1: 1000,
  2: 1000,
  3: 700,
  4: 700,
  5: 900,
  6: 600,
  7: 500,
};

const isValidDateStr = (dateStr: string | null): boolean => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().startsWith(dateStr);
};

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const clientIp = request.headers.get("CF-Connecting-IP") || "127.0.0.1";

  // 🔒 จำกัดการเรียกดูไม่เกิน 20 ครั้ง ต่อ 1 นาที ต่อ 1 IP
  if (!checkRateLimit(clientIp, 20, 60 * 1000)) {
    return new Response(
      JSON.stringify({ error: "เรียกข้อมูลถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ค่ะ" }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!env.DB) {
    return new Response(
      JSON.stringify({ error: "ยังไม่ได้ผูก D1 Binding ชื่อ DB" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const area = searchParams.get("area") || "all";

    // 🔒 ตรวจสอบความถูกต้องของพารามิเตอร์ทั้งหมด
    if (!isValidDateStr(startDate) || !isValidDateStr(endDate)) {
      return new Response(JSON.stringify({ error: "รูปแบบวันที่ไม่ถูกต้อง" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (startDate > endDate) {
      return new Response(
        JSON.stringify({ error: "วันเริ่มต้นต้องไม่มากกว่าวันสิ้นสุด" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (area !== "all" && !["1", "2", "3", "4", "5", "6", "7"].includes(area)) {
      return new Response(JSON.stringify({ error: "พื้นที่ไม่ถูกต้อง" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // เตรียมคำสั่ง SQL ทั้ง 3 ชุด (รวมการคำนวณ SUM(r.weight_kg) มาในรอบเดียว)
    const settingsStmt = env.DB.prepare(
      "SELECT value FROM app_settings WHERE key = 'base_households' LIMIT 1"
    );

    const villageStmt = env.DB.prepare(
      `SELECT 
         h.moo AS moo,
         COUNT(DISTINCT r.household_id) AS participating,
         COUNT(r.id) AS records,
         ROUND(COALESCE(SUM(r.weight_kg), 0), 2) AS total_weight_kg
       FROM households h
       INNER JOIN waste_records r ON r.household_id = h.id
       WHERE r.record_date >= ?1 AND r.record_date <= ?2
       GROUP BY h.moo`
    ).bind(startDate, endDate);

    let categoryStmt;
    if (area === "all") {
      categoryStmt = env.DB.prepare(
        `SELECT 
           r.category_id AS category_id,
           COUNT(DISTINCT r.household_id) AS households_count,
           COUNT(r.id) AS records_count,
           ROUND(COALESCE(SUM(r.weight_kg), 0), 2) AS weight_kg_sum
         FROM waste_records r
         INNER JOIN households h ON r.household_id = h.id
         WHERE r.record_date >= ?1 AND r.record_date <= ?2
         GROUP BY r.category_id`
      ).bind(startDate, endDate);
    } else {
      categoryStmt = env.DB.prepare(
        `SELECT 
           r.category_id AS category_id,
           COUNT(DISTINCT r.household_id) AS households_count,
           COUNT(r.id) AS records_count,
           ROUND(COALESCE(SUM(r.weight_kg), 0), 2) AS weight_kg_sum
         FROM waste_records r
         INNER JOIN households h ON r.household_id = h.id
         WHERE r.record_date >= ?1 AND r.record_date <= ?2 AND h.moo = ?3
         GROUP BY r.category_id`
      ).bind(startDate, endDate, Number(area));
    }

    const [settingsRes, villageRes, categoryRes] = await env.DB.batch([
      settingsStmt,
      villageStmt,
      categoryStmt,
    ]);

    let baseMap = { ...DEFAULT_BASE_HOUSEHOLDS };
    const settingRow = settingsRes?.results?.[0];
    if (settingRow?.value) {
      try {
        const parsed = JSON.parse(settingRow.value);
        for (let m = 1; m <= 7; m++) {
          if (Number(parsed[m]) > 0) baseMap[m] = Number(parsed[m]);
        }
      } catch {}
    }

    const villageLookup = new Map<
      number,
      { participating: number; records: number; weightKg: number }
    >();
    for (const row of villageRes?.results || []) {
      villageLookup.set(Number(row.moo), {
        participating: Number(row.participating) || 0,
        records: Number(row.records) || 0,
        weightKg: Number(Number(row.total_weight_kg || 0).toFixed(2)),
      });
    }

    const allVillages = [1, 2, 3, 4, 5, 6, 7].map((moo) => {
      const totalHouseholds = baseMap[moo] || 0;
      const stat = villageLookup.get(moo) || {
        participating: 0,
        records: 0,
        weightKg: 0,
      };
      const percent =
        totalHouseholds > 0
          ? Number(((stat.participating / totalHouseholds) * 100).toFixed(1))
          : 0;
      return {
        moo,
        totalHouseholds,
        participating: stat.participating,
        percent,
        records: stat.records,
        weightKg: stat.weightKg,
      };
    });

    const filteredVillages =
      area === "all"
        ? allVillages
        : allVillages.filter((v) => v.moo === Number(area));

    const categoryStats: Record<
      string,
      { households: number; records: number; weightKg: number }
    > = {};
    for (const row of categoryRes?.results || []) {
      categoryStats[String(row.category_id)] = {
        households: Number(row.households_count) || 0,
        records: Number(row.records_count) || 0,
        weightKg: Number(Number(row.weight_kg_sum || 0).toFixed(2)),
      };
    }

    const totalBaseHouseholds = filteredVillages.reduce(
      (sum, v) => sum + v.totalHouseholds,
      0
    );
    const totalParticipating = filteredVillages.reduce(
      (sum, v) => sum + v.participating,
      0
    );
    const totalRecords = filteredVillages.reduce((sum, v) => sum + v.records, 0);
    const totalWeightKg = Number(
      filteredVillages.reduce((sum, v) => sum + v.weightKg, 0).toFixed(2)
    );
    const participationPercent =
      totalBaseHouseholds > 0
        ? Number(((totalParticipating / totalBaseHouseholds) * 100).toFixed(1))
        : 0;

    return new Response(
      JSON.stringify({
        summary: {
          participatingHouseholds: totalParticipating,
          baseHouseholds: totalBaseHouseholds,
          participationPercent,
          totalRecords,
          totalWeightKg,
        },
        categoryStats,
        villageStats: filteredVillages,
        updatedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60, s-maxage=60",
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "ไม่สามารถดึงข้อมูลผลรวมชุมชนได้" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};