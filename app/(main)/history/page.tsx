"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Leaf,
  ChevronDown,
  Pencil,
  Calendar,
  Loader2,
  Lock,
  Scale,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
} from "lucide-react";

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

const CACHE_TTL_MS = 60 * 1000;
const PAGE_SIZE = 10;

function isSafeImageUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length > 250) return false;
  if (/[<>"'\\]/.test(url)) return false;
  return url.startsWith("/uploads/") || url.startsWith("/api/image?key=");
}

function isWithin7Days(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = dateStr.split("-").map(Number);
  const recordUTC = Date.UTC(y, m - 1, d);
  const diffDays = Math.floor((todayUTC - recordUTC) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 7;
}

export default function HistoryPage() {
  const [wasteType, setWasteType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // State สำหรับเปิดดูรูปภาพใน Modal หน้าเดิม
  const [lightbox, setLightbox] = useState<{
    title: string;
    date: string;
    images: string[];
    index: number;
  } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("sanklang_household");
    if (!saved) {
      setLoading(false);
      return;
    }

    let householdId = 0;
    try {
      householdId = Number(JSON.parse(saved).id);
    } catch {}

    if (!householdId || householdId <= 0) {
      setLoading(false);
      return;
    }

    const cacheKey = `sanklang_history_${householdId}`;
    const cachedRaw = sessionStorage.getItem(cacheKey);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
          setRecords(cached.records || []);
          setLoading(false);
          return;
        }
      } catch {}
    }

    const controller = new AbortController();

    fetch(`/api/records?householdId=${householdId}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const list = Array.isArray(data?.records) ? data.records : [];
        setRecords(list);
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({ timestamp: Date.now(), records: list })
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [wasteType, startDate, endDate]);

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      if (wasteType !== "all" && rec.category_id !== wasteType) return false;
      if (startDate && rec.record_date < startDate) return false;
      if (endDate && rec.record_date > endDate) return false;
      return true;
    });
  }, [records, wasteType, startDate, endDate]);

  const displayedRecords = useMemo(() => {
    return filteredRecords.slice(0, visibleCount);
  }, [filteredRecords, visibleCount]);

  const uniqueDays = useMemo(() => {
    return new Set(filteredRecords.map((r) => r.record_date)).size;
  }, [filteredRecords]);

  // คำนวณน้ำหนักรวมของรายการที่กรองอยู่
  const totalWeightKg = useMemo(() => {
    return filteredRecords.reduce(
      (sum, r) => sum + (Number(r.weight_kg) || 0),
      0
    );
  }, [filteredRecords]);

  const hasMore = visibleCount < filteredRecords.length;
  const remainingCount = filteredRecords.length - visibleCount;

  return (
    <div className="space-y-6">
      {/* ส่วนหัวหน้าประวัติการคัดแยก */}
      <div>
        <p className="text-xs font-medium text-[#4a6b5b] tracking-wide">
          ความตั้งใจที่บันทึกไว้
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mt-0.5">
          ประวัติการคัดแยก
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          ดูรูปย้อนหลัง เพิ่มรูป หรือแก้ไขรายการภายใน 7 วัน
        </p>
      </div>

      {/* กล่องตัวกรองและรายการประวัติ */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. ชนิดขยะ */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-800">
              ชนิดขยะ
            </label>
            <div className="relative">
              <select
                value={wasteType}
                onChange={(e) => setWasteType(e.target.value)}
                className="w-full appearance-none bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#085f46]/20 focus:border-[#085f46] transition-colors"
              >
                <option value="all">ทุกชนิด</option>
                {Object.entries(CATEGORY_MAP).map(([id, info]) => (
                  <option key={id} value={id}>
                    {info.emoji} {info.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 2. ตั้งแต่วันที่ */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-800">
              ตั้งแต่วันที่
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#085f46]/20 focus:border-[#085f46] transition-colors"
            />
          </div>

          {/* 3. ถึงวันที่ */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-800">
              ถึงวันที่
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#085f46]/20 focus:border-[#085f46] transition-colors"
            />
          </div>
        </div>

        {/* ข้อความสรุปผลการค้นหา */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
          <p className="text-xs text-gray-500">
            พบ {filteredRecords.length} รายการ · {uniqueDays} วันที่ร่วมคัดแยก
            {totalWeightKg > 0 && (
              <span className="ml-1.5 text-[#085f46] font-semibold">
                · น้ำหนักรวม{" "}
                {totalWeightKg.toFixed(2).replace(/\.00$/, "")} กก.
              </span>
            )}
          </p>
          {filteredRecords.length > 0 && (
            <p className="text-xs text-gray-400">
              แสดง {displayedRecords.length} จาก {filteredRecords.length} รายการ
            </p>
          )}
        </div>

        {/* แสดงสถานะกำลังโหลด / ไม่มีรายการ / รายการประวัติ */}
        {loading ? (
          <div className="py-16 md:py-20 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-7 h-7 text-[#085f46] animate-spin mb-2.5" />
            <p className="text-xs text-gray-500">กำลังโหลดประวัติการบันทึก...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 md:py-20 flex flex-col items-center justify-center text-center">
            <Leaf className="w-8 h-8 text-[#7fa982] mb-2.5 stroke-[1.75]" />
            <p className="font-bold text-gray-900 text-sm">
              ไม่มีรายการในช่วงที่เลือก
            </p>
            <p className="text-xs text-gray-500 mt-1">
              เปลี่ยนตัวกรอง หรือเริ่มบันทึกการคัดแยกค่ะ
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {displayedRecords.map((rec) => {
              const catInfo = CATEGORY_MAP[rec.category_id] || {
                title: rec.category_id,
                emoji: "♻️",
              };
              const safeImages: string[] = Array.isArray(rec.images)
                ? rec.images.filter(isSafeImageUrl)
                : [];
              const weightKg = Number(rec.weight_kg) || 0;
              const editable = isWithin7Days(rec.record_date);

              return (
                <div
                  key={rec.id}
                  className="border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-gray-300 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xl">{catInfo.emoji}</span>
                      <span className="font-bold text-gray-900 text-sm">
                        {catInfo.title}
                      </span>
                      <span className="text-xs bg-[#e5efe3] text-[#085f46] font-semibold px-2.5 py-0.5 rounded-full">
                        +{rec.points || 1} คะแนน
                      </span>
                      {weightKg > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 font-medium px-2.5 py-0.5 rounded-full">
                          <Scale className="w-3 h-3 text-gray-500" />
                          {weightKg} กก.
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>วันที่คัดแยก: {rec.record_date}</span>
                    </p>

                    {/* กดที่รูปเพื่อเปิด Modal ดูรูปในหน้าเดิม */}
                    {safeImages.length > 0 && (
                      <div className="flex items-center gap-2 pt-1">
                        {safeImages.map((url, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() =>
                              setLightbox({
                                title: catInfo.title,
                                date: rec.record_date,
                                images: safeImages,
                                index: i,
                              })
                            }
                            className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 block shrink-0 group focus:outline-none focus:ring-2 focus:ring-[#085f46]"
                          >
                            <img
                              src={url}
                              alt={`${catInfo.title} ${i + 1}`}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                              <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {editable ? (
                    <Link
                      href={`/record?date=${encodeURIComponent(rec.record_date)}`}
                      className="self-start sm:self-center inline-flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-800 text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>เพิ่ม/แก้ไขรูป</span>
                    </Link>
                  ) : (
                    <span className="self-start sm:self-center inline-flex items-center gap-1 text-gray-400 text-xs px-3 py-1.5 rounded-xl bg-gray-50 shrink-0">
                      <Lock className="w-3 h-3" />
                      <span>เกินกำหนดแก้ไข 7 วัน</span>
                    </span>
                  )}
                </div>
              );
            })}

            {hasMore && (
              <div className="pt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#f8faf7] hover:bg-[#eef3e3] border border-gray-200 text-[#085f46] font-semibold text-xs px-6 py-3 rounded-xl transition-colors"
                >
                  <span>
                    ดูเพิ่มเติมอีก {Math.min(PAGE_SIZE, remainingCount)} รายการ
                  </span>
                  <span className="text-gray-500 font-normal">
                    (เหลืออีก {remainingCount} รายการ)
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =========================================================
          Modal Lightbox: แสดงรูปภาพขยายใหญ่ในหน้าเดิม
      ========================================================= */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div>
                <h4 className="font-bold text-gray-900 text-sm">
                  {lightbox.title} · วันที่ {lightbox.date}
                </h4>
                <p className="text-xs text-gray-500">
                  รูปที่ {lightbox.index + 1} จาก {lightbox.images.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="p-1.5 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                aria-label="ปิดหน้าต่างดูรูป"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative bg-gray-950 flex items-center justify-center h-[60vh] max-h-[520px]">
              <img
                src={lightbox.images[lightbox.index]}
                alt={`${lightbox.title} ${lightbox.index + 1}`}
                className="max-w-full max-h-full object-contain"
              />

              {lightbox.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setLightbox((prev) =>
                        prev
                          ? {
                              ...prev,
                              index:
                                (prev.index - 1 + prev.images.length) %
                                prev.images.length,
                            }
                          : null
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 rounded-full p-2 shadow-md transition-colors"
                    aria-label="รูปก่อนหน้า"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLightbox((prev) =>
                        prev
                          ? {
                              ...prev,
                              index: (prev.index + 1) % prev.images.length,
                            }
                          : null
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 rounded-full p-2 shadow-md transition-colors"
                    aria-label="รูปถัดไป"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {lightbox.images.length > 1 && (
              <div className="flex items-center justify-center gap-2 p-3 bg-gray-50">
                {lightbox.images.map((imgUrl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setLightbox((prev) =>
                        prev ? { ...prev, index: i } : null
                      )
                    }
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                      i === lightbox.index
                        ? "border-[#085f46] scale-105"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={imgUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}