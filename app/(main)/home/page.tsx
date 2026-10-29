"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Trophy,
  Calendar,
  Recycle,
  Leaf,
  Pencil,
  Loader2,
} from "lucide-react";

interface HouseholdInfo {
  id: number;
  house_number: string;
  moo: number;
}

interface WasteRecord {
  id: number;
  household_id: number;
  category_id: string;
  record_date: string;
  images: string[];
  points: number;
}

const CATEGORY_MAP: Record<string, { title: string; emoji: string }> = {
  food: { title: "เศษอาหาร", emoji: "🥬" },
  leaves: { title: "ใบไม้ / กิ่งไม้", emoji: "🌿" },
  plastic: { title: "พลาสติกรีไซเคิล", emoji: "🧴" },
  paper: { title: "กระดาษ / กล่อง", emoji: "📦" },
  glass: { title: "ขวดแก้ว", emoji: "🍾" },
  can: { title: "กระป๋อง / โลหะ", emoji: "🥫" },
  general: { title: "ขยะทั่วไป", emoji: "🗑️" },
  hazardous: { title: "ขยะอันตราย", emoji: "🔋" },
};

const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

// แปลงวันที่ YYYY-MM-DD เป็นรูปแบบไทย เช่น "28 ต.ค. 2569"
function formatThaiDate(dateStr?: string): string {
  const d = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  if (isNaN(d.getTime())) return "";
  const day = d.getDate();
  const month = THAI_MONTHS[d.getMonth()];
  const buddhistYear = d.getFullYear() + 543;
  return `${day} ${month} ${buddhistYear}`;
}

// 🔒 ตรวจสอบความปลอดภัยของ URL รูปภาพก่อนนำไปเรนเดอร์ (ป้องกัน XSS / External Tracking)
function isSafeImageUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length > 250) return false;
  if (/[<>"'\\]/.test(url)) return false;
  return url.startsWith("/uploads/") || url.startsWith("/api/image?key=");
}

const CACHE_TTL_MS = 60 * 1000; // Cache 60 วินาที ป้องกันการกด Refresh รัวๆ

export default function HomePage() {
  const [household, setHousehold] = useState<HouseholdInfo | null>(null);
  const [records, setRecords] = useState<WasteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayThaiStr, setTodayThaiStr] = useState("");

  useEffect(() => {
    setTodayThaiStr(formatThaiDate());

    const saved = localStorage.getItem("sanklang_household");
    if (!saved) {
      setLoading(false);
      return;
    }

    let parsedHousehold: HouseholdInfo | null = null;
    try {
      const raw = JSON.parse(saved);
      const cleanId = Number(raw?.id);
      if (Number.isInteger(cleanId) && cleanId > 0 && cleanId <= 999999) {
        parsedHousehold = {
          id: cleanId,
          house_number: String(raw.house_number || "0").replace(/[^0-9/]/g, ""),
          moo: Number(raw.moo) || 1,
        };
        setHousehold(parsedHousehold);
      }
    } catch {}

    if (!parsedHousehold) {
      setLoading(false);
      return;
    }

    // 1. ตรวจสอบข้อมูลใน sessionStorage Cache ก่อนยิง API
    const cacheKey = `sanklang_history_${parsedHousehold.id}`;
    const cachedRaw = sessionStorage.getItem(cacheKey);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (
          cached &&
          typeof cached.timestamp === "number" &&
          Date.now() - cached.timestamp < CACHE_TTL_MS &&
          Array.isArray(cached.records)
        ) {
          setRecords(cached.records);
          setLoading(false);
          return;
        }
      } catch {}
    }

    // 2. ดึงข้อมูลจาก API พร้อม AbortController ป้องกันการยิงซ้ำซ้อน
    const controller = new AbortController();

    fetch(`/api/records?householdId=${parsedHousehold.id}`, {
      method: "GET",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const list: WasteRecord[] = Array.isArray(data?.records)
          ? data.records
          : [];
        setRecords(list);
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({ timestamp: Date.now(), records: list })
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  // คำนวณสถิติทั้ง 3 การ์ดจากข้อมูลจริงของครัวเรือน
  const stats = useMemo(() => {
    const totalPoints = records.reduce(
      (sum, r) => sum + (Number(r.points) || 1),
      0
    );
    const activeDays = new Set(records.map((r) => r.record_date)).size;
    const uniqueCategories = new Set(
      records
        .map((r) => r.category_id)
        .filter((catId) => Boolean(CATEGORY_MAP[catId]))
    ).size;

    return { totalPoints, activeDays, uniqueCategories };
  }, [records]);

  // ดึง 4 รายการล่าสุดมาแสดงในกล่อง "รายการล่าสุด"
  const recentRecords = useMemo(() => {
    return records.slice(0, 4);
  }, [records]);

  return (
    <div className="space-y-6">
      {/* ส่วนหัวทักทายและวันที่ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-[#4a6b5b]">
            บ้านสร้างสุข · สันกลางรักษ์โลก
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mt-0.5">
            วันนี้ บ้านเราคัดแยกหรือยัง?
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            บ้านเลขที่ {household?.house_number || "0"} หมู่{" "}
            {household?.moo || "1"}
          </p>
        </div>

        <div className="self-start sm:self-center bg-[#eff4e6] text-gray-700 text-xs font-medium px-3.5 py-1.5 rounded-lg">
          {todayThaiStr || "กำลังโหลด..."}
        </div>
      </div>

      {/* แบนเนอร์สีเขียวเข้ม */}
      <div className="bg-[#085f46] rounded-2xl p-6 md:p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="space-y-3 text-center md:text-left">
          <p className="text-xs md:text-sm font-medium text-[#c5e09b]">
            เริ่มที่บ้าน เปลี่ยนทั้งชุมชน
          </p>
          <h3 className="text-2xl md:text-3xl font-bold leading-snug">
            แยกขยะวันละนิด
            <br />
            สันกลางน่าอยู่ขึ้นทุกวัน
          </h3>
          <p className="text-xs md:text-sm text-gray-100/90">
            ไม่ต้องชั่งน้ำหนัก แค่เลือกขยะ ถ่ายรูป แล้วบันทึก
          </p>
          <div className="pt-2">
            <Link
              href="/record"
              className="inline-flex items-center gap-2 bg-[#cde58e] hover:bg-[#c2de7b] text-[#085f46] font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>บันทึกการคัดแยกวันนี้</span>
            </Link>
          </div>
        </div>

        {/* กรอบรูปวงกลมน้องอาสา */}
        <div className="w-32 h-32 md:w-36 md:h-36 rounded-full bg-[#e8f5e9] flex flex-col items-center justify-center text-[#085f46] shrink-0 shadow-md border-4 border-white/10 overflow-hidden relative group">
          <img
            src="/nong-asa.png"
            alt="น้องอาสา"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* การ์ดสรุปผล 3 ช่อง */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* การ์ดที่ 1: คะแนนสะสม */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>คะแนนสะสม</span>
            <Trophy className="w-4 h-4 text-gray-400" />
          </div>
          <div className="my-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-gray-900">
              {loading ? "0" : stats.totalPoints.toLocaleString()}
            </span>
            <span className="text-sm font-medium text-gray-700">คะแนน</span>
          </div>
          <p className="text-xs text-gray-500">ชนิดละ 1 คะแนน / วัน</p>
        </div>

        {/* การ์ดที่ 2: วันที่ร่วมคัดแยก */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>วันที่ร่วมคัดแยก</span>
            <Calendar className="w-4 h-4 text-gray-400" />
          </div>
          <div className="my-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-gray-900">
              {loading ? "0" : stats.activeDays.toLocaleString()}
            </span>
            <span className="text-sm font-medium text-gray-700">วัน</span>
          </div>
          <p className="text-xs text-gray-500">ทุกวันที่ลงมือมีความหมาย</p>
        </div>

        {/* การ์ดที่ 3: ชนิดขยะที่เคยแยก */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>ชนิดขยะที่เคยแยก</span>
            <Recycle className="w-4 h-4 text-gray-400" />
          </div>
          <div className="my-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-gray-900">
              {loading ? "0" : stats.uniqueCategories}
            </span>
            <span className="text-sm font-medium text-gray-700">จาก 8 ชนิด</span>
          </div>
          <p className="text-xs text-gray-500">เริ่มจากสิ่งที่บ้านเรามี</p>
        </div>
      </div>

      {/* ส่วนล่าง: รายการล่าสุด (ซ้าย) และ คำแนะนำ (ขวา) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* กล่องรายการล่าสุด (กินพื้นที่ 2 ส่วนในจอใหญ่) */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 flex flex-col min-h-[280px]">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-gray-900 text-base">รายการล่าสุด</h4>
            <Link
              href="/history"
              className="text-xs font-semibold text-[#085f46] hover:underline"
            >
              ดูทั้งหมด
            </Link>
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin text-[#085f46] mb-2" />
              <p className="text-xs">กำลังดึงข้อมูลรายการล่าสุด...</p>
            </div>
          ) : recentRecords.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <Leaf className="w-8 h-8 text-[#7fa982] mb-2 stroke-[1.75]" />
              <p className="font-semibold text-gray-800 text-sm">
                ยังไม่มีรายการบันทึก
              </p>
              <p className="text-xs text-gray-500 mt-1">
                เริ่มคัดแยกวันนี้ แล้วบันทึกภาพไว้ด้วยกันค่ะ
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentRecords.map((rec) => {
                const catInfo = CATEGORY_MAP[rec.category_id] || {
                  title: rec.category_id,
                  emoji: "♻️",
                };
                const safeImages = Array.isArray(rec.images)
                  ? rec.images.filter(isSafeImageUrl)
                  : [];

                return (
                  <div
                    key={rec.id}
                    className="border border-gray-200 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* แสดงรูปแรกของรายการ (ถ้ามี) หรือแสดงไอคอนชนิดขยะ */}
                      {safeImages.length > 0 ? (
                        <img
                          src={safeImages[0]}
                          alt={catInfo.title}
                          loading="lazy"
                          className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[#eef3e3] flex items-center justify-center text-xl shrink-0">
                          {catInfo.emoji}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-sm truncate">
                            {catInfo.title}
                          </span>
                          <span className="text-[11px] bg-[#e5efe3] text-[#085f46] font-semibold px-2 py-0.5 rounded-full">
                            +{rec.points || 1} คะแนน
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatThaiDate(rec.record_date)}
                          {safeImages.length > 0 &&
                            ` · แนบรูป ${safeImages.length} ภาพ`}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/record?date=${encodeURIComponent(rec.record_date)}`}
                      className="inline-flex items-center gap-1 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
                    >
                      <Pencil className="w-3 h-3" />
                      <span className="hidden sm:inline">แก้ไข</span>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* คอลัมน์ขวา 2 กล่องซ้อนกัน */}
        <div className="space-y-4 flex flex-col justify-between">
          {/* กล่องคำอธิบายคะแนน */}
          <div className="bg-[#eef3e3] rounded-2xl p-5 space-y-2">
            <p className="text-xs font-medium text-[#5c7258]">
              คะแนนเล็ก ๆ จากความตั้งใจ
            </p>
            <h4 className="font-bold text-gray-900 text-base">
              1 ชนิด · 1 คะแนน · ต่อวัน
            </h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              คัดแยกหลายชนิดได้หลายคะแนน เพิ่มรูปชนิดเดิมในวันเดียวกันได้โดยไม่เพิ่มคะแนน
            </p>
            <p className="text-[11px] text-gray-500 pt-1">
              คะแนนเพื่อเป็นกำลังใจ ไม่แลกของรางวัล
            </p>
          </div>

          {/* กล่องถามน้องอาสา */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <h4 className="font-bold text-gray-900 text-base">
              ไม่แน่ใจว่าแยกอย่างไร?
            </h4>
            <p className="text-xs text-gray-500">
              ถามวิธีใช้โปรแกรม หรือเรียนรู้เรื่องขยะกับน้องอาสา
            </p>
            <div>
              <button
                type="button"
                onClick={() => alert("เปิดหน้าต่างแชทถามน้องอาสา")}
                className="border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors"
              >
                ถามน้องอาสา
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}