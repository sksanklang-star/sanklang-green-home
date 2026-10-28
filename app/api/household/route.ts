// ไฟล์: app/api/household/route.ts (ทำงานเฉพาะตอนรัน npm run dev ในเครื่อง Local)
import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// ค้นหาไฟล์ SQLite ของ sanklang-green-db-local ในโฟลเดอร์ .wrangler
function getLocalDb() {
  const basePath = path.resolve(
    process.cwd(),
    ".wrangler/state/v3/d1/miniflare-D1DatabaseObject"
  );
  if (!fs.existsSync(basePath)) {
    throw new Error("ไม่พบฐานข้อมูล Local กรุณารัน wrangler d1 execute --local ก่อน");
  }
  const dbFile = fs.readdirSync(basePath).find((f) => f.endsWith(".sqlite"));
  if (!dbFile) {
    throw new Error("ไม่พบไฟล์ .sqlite ใน .wrangler");
  }
  return new Database(path.join(basePath, dbFile));
}

// ระบบจำกัดการยิง API รัวๆ (Rate Limit)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, houseNumber, moo, website_hp } = body;

    // 1. ดักบอทด้วย Honeypot
    if (website_hp) {
      return NextResponse.json({ error: "ตรวจพบพฤติกรรมผิดปกติ" }, { status: 400 });
    }

    // 2. ตรวจสอบรูปแบบข้อมูล (Strict Validation)
    const cleanHouseNo = String(houseNumber || "").trim();
    const cleanMoo = Number(moo);

    if (!HOUSE_NO_REGEX.test(cleanHouseNo)) {
      return NextResponse.json(
        { error: "รูปแบบบ้านเลขที่ไม่ถูกต้อง (ใช้เลขอารบิก 0-9 และ / เท่านั้น)" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(cleanMoo) || cleanMoo < 1 || cleanMoo > 7) {
      return NextResponse.json(
        { error: "กรุณาเลือกหมู่ที่ 1 ถึง 7 เท่านั้น" },
        { status: 400 }
      );
    }

    const db = getLocalDb();

    // โหมดที่ 1: เช็คว่ามีบ้านนี้ในระบบหรือยัง
    if (action === "check") {
      if (!checkRateLimit("local:check", 20, 60 * 1000)) {
        db.close();
        return NextResponse.json(
          { error: "คุณทำรายการเร็วเกินไป กรุณารอสักครู่แล้วลองใหม่ค่ะ" },
          { status: 429 }
        );
      }

      const existing = db
        .prepare(
          "SELECT id, house_number, moo, qgis_id FROM households WHERE house_number = ? AND moo = ? LIMIT 1"
        )
        .get(cleanHouseNo, cleanMoo);

      db.close();

      if (existing) {
        return NextResponse.json({ exists: true, household: existing });
      }
      return NextResponse.json({ exists: false });
    }

    // โหมดที่ 2: เพิ่มบ้านใหม่ลงฐานข้อมูล
    if (action === "create") {
      if (!checkRateLimit("local:create", 5, 10 * 60 * 1000)) {
        db.close();
        return NextResponse.json(
          { error: "เพิ่มข้อมูลครัวเรือนเกินกำหนด กรุณารอสักครู่" },
          { status: 429 }
        );
      }

      db.prepare(
        "INSERT INTO households (house_number, moo) VALUES (?, ?) ON CONFLICT(house_number, moo) DO NOTHING"
      ).run(cleanHouseNo, cleanMoo);

      const created = db
        .prepare(
          "SELECT id, house_number, moo, qgis_id FROM households WHERE house_number = ? AND moo = ? LIMIT 1"
        )
        .get(cleanHouseNo, cleanMoo);

      db.close();
      return NextResponse.json({ success: true, household: created }, { status: 201 });
    }

    db.close();
    return NextResponse.json({ error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
  } catch (err: any) {
    console.error("Local DB Error:", err);
    return NextResponse.json(
      { error: err.message || "ระบบฐานข้อมูลในเครื่องขัดข้อง" },
      { status: 500 }
    );
  }
}