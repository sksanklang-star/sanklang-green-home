-- ลบตารางเก่าก่อน (กรณีต้องการรันทับเพื่อรีเซ็ตระบบใหม่)
DROP TABLE IF EXISTS household_reports;
DROP TABLE IF EXISTS waste_records;
DROP TABLE IF EXISTS households;
DROP TABLE IF EXISTS app_settings;

-- ==========================================
-- 1. ตารางครัวเรือน (households)
-- ==========================================
CREATE TABLE households (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  house_number TEXT NOT NULL,          -- บ้านเลขที่ เช่น '125/3', '123'
  moo INTEGER NOT NULL CHECK (moo BETWEEN 1 AND 7), -- หมู่ที่ 1-7 เก็บเป็นตัวเลขตรงๆ
  qgis_id TEXT DEFAULT NULL,           -- รหัสเชื่อมพิกัด QGIS (NULL = รอเชื่อมพิกัด)
  lat REAL DEFAULT NULL,               -- ละติจูด
  lng REAL DEFAULT NULL,               -- ลองจิจูด
  created_at TEXT DEFAULT (datetime('now', '+7 hours')),
  
  -- ป้องกันบ้านเลขที่ซ้ำในหมู่เดียวกัน
  UNIQUE(house_number, moo)
);

-- สร้าง Index เพื่อให้ค้นหาบ้านตอน Login และกรองตามหมู่บ้านได้เร็วขึ้น
CREATE INDEX idx_households_moo ON households(moo);
CREATE INDEX idx_households_lookup ON households(house_number, moo);


-- ==========================================
-- 2. ตารางประวัติการบันทึกขยะ (waste_records)
-- ==========================================
CREATE TABLE waste_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL,       -- อ้างอิง households.id
  category_id TEXT NOT NULL,           -- 'food', 'leaves', 'plastic', 'paper', 'glass', 'can', 'general', 'hazardous'
  record_date TEXT NOT NULL,           -- วันที่คัดแยก รูปแบบ 'YYYY-MM-DD' เช่น '2026-10-22'
  images TEXT NOT NULL DEFAULT '[]',   -- เก็บ JSON Array ของ URL รูปภาพ เช่น '["url1.jpg","url2.jpg"]'
  weight_kg REAL NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 1,   -- 1 ชนิด = 1 คะแนน/วัน
  created_at TEXT DEFAULT (datetime('now', '+7 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+7 hours')),

  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  
  -- กฎเหล็ก: บ้านเดียว-ชนิดเดียว-วันเดียว ได้แค่ 1 รายการ (1 คะแนน)
  UNIQUE(household_id, category_id, record_date)
);

-- สร้าง Index สำหรับดึงหน้าประวัติและคำนวณแดชบอร์ดผลรวมชุมชน
CREATE INDEX idx_records_household_date ON waste_records(household_id, record_date DESC);
CREATE INDEX idx_records_date ON waste_records(record_date);
CREATE INDEX idx_records_category ON waste_records(category_id);


-- ==========================================
-- 3. ตารางแจ้งข้อมูลบ้านไม่ถูกต้อง (household_reports)
-- ==========================================
CREATE TABLE household_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL,       -- บ้านที่แจ้งแก้ไข
  detail TEXT NOT NULL,                -- รายละเอียดที่แจ้ง เช่น บ้านเลขที่พิมพ์ผิด
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' (รอตรวจสอบ), 'resolved' (แก้ไขแล้ว)
  created_at TEXT DEFAULT (datetime('now', '+7 hours')),

  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
);

CREATE INDEX idx_reports_status ON household_reports(status);


-- ==========================================
-- 4. ตารางตั้งค่าระบบ (app_settings) - เก็บฐานครัวเรือนทั้ง 7 หมู่
-- ==========================================
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now', '+7 hours'))
);

-- ใส่ค่าเริ่มต้นจำนวนฐานครัวเรือนทั้ง 7 หมู่ (รวม 5,400 ครัวเรือน)
INSERT INTO app_settings (key, value) VALUES (
  'base_households',
  '{"1":1000,"2":1000,"3":700,"4":700,"5":900,"6":600,"7":500}'
);