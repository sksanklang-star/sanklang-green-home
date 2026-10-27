import { defineConfig } from "drizzle-kit";
import fs from "fs";
import path from "path";

// ค้นหาไฟล์ .sqlite ของ D1 ที่ Wrangler สร้างไว้ในเครื่องอัตโนมัติ
function getLocalD1DB() {
  const basePath = path.resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  if (!fs.existsSync(basePath)) return "";
  const dbFile = fs.readdirSync(basePath).find((f) => f.endsWith(".sqlite"));
  return dbFile ? path.resolve(basePath, dbFile) : "";
}

export default defineConfig({
  dialect: "sqlite",
  dbCredentials: {
    url: getLocalD1DB(),
  },
});