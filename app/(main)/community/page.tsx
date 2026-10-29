"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Printer,
  TreePine,
  Users,
  Leaf,
  Recycle,
  ChevronDown,
  Loader2,
} from "lucide-react";

interface WasteCategoryMeta {
  id: string;
  name: string;
  emoji: string;
  barColor: string;
}

interface VillageStat {
  moo: number;
  totalHouseholds: number;
  participating: number;
  percent: number;
  records: number;
}

const WASTE_CATEGORIES_META: WasteCategoryMeta[] = [
  { id: "food", name: "เศษอาหาร", emoji: "🥬", barColor: "bg-[#2e7d32]" },
  { id: "leaves", name: "ใบไม้ / กิ่งไม้", emoji: "🌿", barColor: "bg-[#2e7d32]" },
  { id: "plastic", name: "พลาสติกรีไซเคิล", emoji: "🧴", barColor: "bg-[#b7891b]" },
  { id: "paper", name: "กระดาษ / กล่อง", emoji: "📦", barColor: "bg-[#b7891b]" },
  { id: "glass", name: "ขวดแก้ว", emoji: "🍾", barColor: "bg-[#b7891b]" },
  { id: "can", name: "กระป๋อง / โลหะ", emoji: "🥫", barColor: "bg-[#b7891b]" },
  { id: "general", name: "ขยะทั่วไป", emoji: "🗑️", barColor: "bg-[#2b74b8]" },
  { id: "hazardous", name: "ขยะอันตราย", emoji: "🔋", barColor: "bg-[#c85a42]" },
];

const INITIAL_VILLAGES: VillageStat[] = [
  { moo: 1, totalHouseholds: 1000, participating: 0, percent: 0, records: 0 },
  { moo: 2, totalHouseholds: 1000, participating: 0, percent: 0, records: 0 },
  { moo: 3, totalHouseholds: 700, participating: 0, percent: 0, records: 0 },
  { moo: 4, totalHouseholds: 700, participating: 0, percent: 0, records: 0 },
  { moo: 5, totalHouseholds: 900, participating: 0, percent: 0, records: 0 },
  { moo: 6, totalHouseholds: 600, participating: 0, percent: 0, records: 0 },
  { moo: 7, totalHouseholds: 500, participating: 0, percent: 0, records: 0 },
];

const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

function formatThaiShortDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${THAI_MONTHS[m - 1]} ${y + 543}`;
}

function formatThaiTimestamp(isoStr: string): string {
  const d = isoStr ? new Date(isoStr) : new Date();
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear() + 543;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hh}:${mm}:${ss}`;
}

const CACHE_TTL_MS = 2 * 60 * 1000; // เก็บ Cache ไว้ 2 นาที

export default function CommunityPage() {
  // ค่าในช่อง Input ตัวกรอง (ยังไม่ยิง API จนกว่าจะกดปุ่ม "แสดงผล")
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [area, setArea] = useState("all");

  // ค่าตัวกรองที่กดยืนยันแล้ว
  const [appliedFilter, setAppliedFilter] = useState(() => {
    const now = new Date();
    return {
      startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
      endDate: now.toISOString().split("T")[0],
      area: "all",
    };
  });

  const [metricType, setMetricType] = useState<"households" | "records">("households");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [lastClickTime, setLastClickTime] = useState(0);

  // ข้อมูลสถิติที่ดึงมาจาก API
  const [summary, setSummary] = useState({
    participatingHouseholds: 0,
    baseHouseholds: 5400,
    participationPercent: 0,
    totalRecords: 0,
  });
  const [categoryStats, setCategoryStats] = useState<
    Record<string, { households: number; records: number }>
  >({});
  const [villageStats, setVillageStats] = useState<VillageStat[]>(INITIAL_VILLAGES);
  const [updatedAtText, setUpdatedAtText] = useState("");

  // เปอร์เซ็นต์การมีส่วนร่วมสำหรับคุมวิดีโอต้นไม้ (0 - 100)
  const treePercent = summary.participationPercent;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const VIDEO_DURATION = 10; // ความยาววิดีโอเต็ม 10 วินาที

  // คำนวณวินาทีที่ต้องหยุดจาก % (เช่น 0% = 0 วิ, 50% = 5 วิ, 100% = 10 วิ)
  const targetStopTime =
    (Math.min(Math.max(treePercent, 0), 100) / 100) * VIDEO_DURATION;

  // ฟังก์ชันนำข้อมูลที่ได้มาอัปเดตลง State
  const applyData = useCallback((data: any) => {
    if (data?.summary) setSummary(data.summary);
    if (data?.categoryStats) setCategoryStats(data.categoryStats);
    if (Array.isArray(data?.villageStats)) setVillageStats(data.villageStats);
    setUpdatedAtText(formatThaiTimestamp(data?.updatedAt));
  }, []);

  // ดึงข้อมูลเมื่อ appliedFilter เปลี่ยน (พร้อมระบบ Cache กันการกดซ้ำ)
  useEffect(() => {
    const { startDate: s, endDate: e, area: a } = appliedFilter;
    const cacheKey = `sanklang_comm_${s}_${e}_${a}`;

    const cachedRaw = sessionStorage.getItem(cacheKey);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (Date.now() - cached.timestamp < CACHE_TTL_MS && cached.payload) {
          applyData(cached.payload);
          setLoading(false);
          return;
        }
      } catch {}
    }

    const controller = new AbortController();
    setLoading(true);
    setErrorMsg("");

    fetch(
      `/api/community?startDate=${encodeURIComponent(s)}&endDate=${encodeURIComponent(e)}&area=${encodeURIComponent(a)}`,
      { signal: controller.signal }
    )
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "ไม่สามารถดึงข้อมูลได้");
        return json;
      })
      .then((data) => {
        applyData(data);
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({ timestamp: Date.now(), payload: data })
        );
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setErrorMsg(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [appliedFilter, applyData]);

  // กดปุ่ม "แสดงผล" (มี Debounce 1 วินาที กันคนกดรัวๆ)
  const handleApplyFilter = () => {
    const now = Date.now();
    if (now - lastClickTime < 1000) return;
    setLastClickTime(now);

    if (!startDate || !endDate) {
      setErrorMsg("กรุณาเลือกวันเริ่มต้นและวันสิ้นสุด");
      return;
    }
    if (startDate > endDate) {
      setErrorMsg("วันเริ่มต้นต้องไม่มากกว่าวันสิ้นสุด");
      return;
    }
    setErrorMsg("");
    setAppliedFilter({ startDate, endDate, area });
  };

  // สั่งเล่นหรือหยุดวิดีโอเมื่อค่าเปอร์เซ็นต์เปลี่ยน
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (targetStopTime <= 0) {
      video.pause();
      video.currentTime = 0;
    } else {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  }, [targetStopTime]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.currentTime >= targetStopTime) {
      video.pause();
      video.currentTime = targetStopTime;
    }
  };

  // คำนวณรายการขยะทั้ง 8 ชนิดตามโหมดที่เลือก (จำนวนครัวเรือน หรือ จำนวนรายการ)
  const wasteStatsList = useMemo(() => {
    return WASTE_CATEGORIES_META.map((meta) => {
      const stat = categoryStats[meta.id] || { households: 0, records: 0 };
      const count = metricType === "households" ? stat.households : stat.records;
      return { ...meta, count };
    });
  }, [categoryStats, metricType]);

  const maxWasteCount = useMemo(() => {
    return Math.max(...wasteStatsList.map((item) => item.count), 1);
  }, [wasteStatsList]);

  const areaLabel =
    appliedFilter.area === "all"
      ? "ทั้งตำบล"
      : `หมู่ที่ ${appliedFilter.area}`;

  return (
    <div className="space-y-6 pb-4">
      {/* 1. ส่วนหัวและปุ่มพิมพ์ / PDF */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#4a6b5b] tracking-wide">
            ร่วมมือกันทั้ง 7 หมู่บ้าน
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mt-0.5">
            ผลรวมชุมชน
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            เลือกช่วงวันที่และพื้นที่ เพื่อดูผลการมีส่วนร่วม
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="self-start sm:self-center inline-flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-semibold text-xs px-4 py-2.5 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors"
        >
          <Printer className="w-4 h-4 text-gray-600" />
          <span>พิมพ์ / PDF</span>
        </button>
      </div>

      {/* 2. กล่องตัวกรองวันที่และพื้นที่ */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* วันเริ่มต้น */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="block text-xs font-bold text-gray-900">
              วันเริ่มต้น
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#085f46]/20 focus:border-[#085f46]"
            />
          </div>

          {/* วันสิ้นสุด */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="block text-xs font-bold text-gray-900">
              วันสิ้นสุด
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#085f46]/20 focus:border-[#085f46]"
            />
          </div>

          {/* พื้นที่ + ปุ่มแสดงผล */}
          <div className="md:col-span-4 flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
            <div className="flex-1 space-y-1.5">
              <label className="block text-xs font-bold text-gray-900">
                พื้นที่
              </label>
              <div className="relative">
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full appearance-none bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 pr-9 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#085f46]/20 focus:border-[#085f46]"
                >
                  <option value="all">ทั้งตำบลสันกลาง</option>
                  <option value="1">หมู่ที่ 1</option>
                  <option value="2">หมู่ที่ 2</option>
                  <option value="3">หมู่ที่ 3</option>
                  <option value="4">หมู่ที่ 4</option>
                  <option value="5">หมู่ที่ 5</option>
                  <option value="6">หมู่ที่ 6</option>
                  <option value="7">หมู่ที่ 7</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <button
              type="button"
              onClick={handleApplyFilter}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 bg-[#085f46] hover:bg-[#064e39] disabled:opacity-60 text-white font-semibold text-xs px-5 py-3 rounded-xl transition-colors shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <TreePine className="w-4 h-4" />
              )}
              <span>แสดงผล</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <p className="text-xs text-red-600 mt-3">{errorMsg}</p>
        )}
      </div>

      {/* 3. แถบแจ้งเตือนข้อมูลสาธิตและช่วงเวลาที่แสดง */}
      <div className="space-y-3">
        <div className="bg-[#fdf6e2] border border-[#f5e2a8] text-gray-800 text-xs px-4 py-3 rounded-xl">
          ใช้จำนวนครัวเรือนสมมติสำหรับสาธิต · ฐานทั้งตำบล 5,400 ครัวเรือน (หรือค่าที่เจ้าหน้าที่ปรับ) · ผู้เข้าร่วมและรายการด้านล่างมาจากข้อมูลที่บันทึกในระบบ
        </div>
        <p className="text-xs text-gray-500">
          ผลที่แสดง: {areaLabel} · {formatThaiShortDate(appliedFilter.startDate)} –{" "}
          {formatThaiShortDate(appliedFilter.endDate)}
        </p>
      </div>

      {/* 4. การ์ดสรุปผล 3 ช่อง */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>ครัวเรือนที่ร่วมบันทึก</span>
            <Users className="w-4 h-4 text-gray-400" />
          </div>
          <div className="my-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-gray-900">
              {summary.participatingHouseholds.toLocaleString()}
            </span>
            <span className="text-sm font-medium text-gray-700">ครัวเรือน</span>
          </div>
          <p className="text-xs text-gray-500">นับบ้านไม่ซ้ำในช่วงวันที่เลือก</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>สัดส่วนการมีส่วนร่วม</span>
            <Leaf className="w-4 h-4 text-gray-400" />
          </div>
          <div className="my-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-gray-900">{treePercent}</span>
            <span className="text-sm font-medium text-gray-700">เปอร์เซ็นต์</span>
          </div>
          <p className="text-xs text-gray-500">
            จากฐาน {summary.baseHouseholds.toLocaleString()} ครัวเรือน
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>รายการคัดแยก</span>
            <Recycle className="w-4 h-4 text-gray-400" />
          </div>
          <div className="my-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-gray-900">
              {summary.totalRecords.toLocaleString()}
            </span>
            <span className="text-sm font-medium text-gray-700">รายการ</span>
          </div>
          <p className="text-xs text-gray-500">บ้านเดียว–ชนิดเดียว–วันเดียว = 1</p>
        </div>
      </div>

      {/* 5. ส่วนต้นไม้ของตำบลสันกลาง (ซ้าย) และ การคัดแยกแต่ละชนิด (ขวา) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* การ์ดซ้าย: วิดีโอต้นไม้เติบโตตาม % */}
        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-between text-center">
          <span className="bg-[#eef3e3] text-[#3b5239] text-xs font-medium px-3.5 py-1.5 rounded-lg">
            ต้นไม้ของตำบลสันกลาง
          </span>

          {/* พื้นที่สำหรับใส่วิดีโอความยาว 10 วินาที */}
          <div className="my-6 w-56 h-56 sm:w-64 sm:h-64 rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative">
            <video
              ref={videoRef}
              src="/tree-growth.mp4"
              muted
              playsInline
              preload="auto"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={() => {
                if (videoRef.current && targetStopTime <= 0) {
                  videoRef.current.currentTime = 0;
                  videoRef.current.pause();
                }
              }}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-2 w-full max-w-md">
            <div className="text-4xl md:text-5xl font-bold text-[#085f46]">
              {treePercent}%
            </div>
            <p className="text-xs text-gray-500">
              {summary.participatingHouseholds.toLocaleString()} จาก{" "}
              {summary.baseHouseholds.toLocaleString()} ครัวเรือนร่วมคัดแยก
            </p>

            <div className="mt-4 bg-[#eef3e3]/80 rounded-xl p-3.5 text-xs text-gray-700 space-y-1">
              <p className="font-medium">
                ครัวเรือนที่ร่วมบันทึก ÷ ครัวเรือนทั้งหมด × 100
              </p>
              <p className="text-gray-600">
                ต้นไม้เติบโตจากการมีส่วนร่วม ไม่ใช่คะแนน
              </p>
            </div>
          </div>
        </div>

        {/* การ์ดขวา: การคัดแยกแต่ละชนิด */}
        <div className="lg:col-span-5 bg-white border border-gray-200 rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">
              การคัดแยกแต่ละชนิด
            </h3>

            <div className="relative">
              <select
                value={metricType}
                onChange={(e) =>
                  setMetricType(e.target.value as "households" | "records")
                }
                className="w-full appearance-none bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 pr-9 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#085f46]/20 focus:border-[#085f46]"
              >
                <option value="households">จำนวนครัวเรือน</option>
                <option value="records">จำนวนรายการ</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* รายการ Progress bar ของขยะทั้ง 8 ชนิด */}
            <div className="space-y-3.5 pt-1">
              {wasteStatsList.map((item) => {
                const widthPercent =
                  item.count > 0 ? (item.count / maxWasteCount) * 100 : 0;

                return (
                  <div key={item.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-gray-800">
                        <span>{item.emoji}</span>
                        <span>{item.name}</span>
                      </span>
                      <span className="font-bold text-gray-900">
                        {item.count.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-[#ecefe8] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${item.barColor}`}
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-gray-500 pt-5">
            หน่วย: {metricType === "households" ? "ครัวเรือน" : "รายการ"} · ไม่ใช่น้ำหนักขยะ
          </p>
        </div>
      </div>

      {/* 6. ส่วนการมีส่วนร่วมแยกตามหมู่บ้าน */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">
            การมีส่วนร่วมแยกตามหมู่บ้าน
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            ช่วงวันที่เดียวกัน · แสดงเฉพาะพื้นที่ที่เลือก
          </p>
        </div>

        {/* แถบสรุปหมู่บ้านแนวนอน */}
        <div
          className={`grid grid-cols-2 sm:grid-cols-4 ${
            villageStats.length > 1 ? "md:grid-cols-7" : "md:grid-cols-1 max-w-xs"
          } gap-4 pt-6`}
        >
          {villageStats.map((v) => (
            <div key={v.moo} className="text-center space-y-2">
              <div className="text-xs font-bold text-gray-900">
                {v.percent}%
              </div>
              <div className="w-full h-1.5 bg-[#ecefe8] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#6b9e78] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(Math.max(v.percent, 8), 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-800 font-medium">
                หมู่ {v.moo}
              </div>
              <div className="text-xs text-gray-500">
                {v.participating.toLocaleString()} บ้าน
              </div>
            </div>
          ))}
        </div>

        {/* ตารางข้อมูลรายหมู่บ้าน */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-gray-600 font-medium">
                <th className="py-3 pr-4 font-medium">หมู่ที่</th>
                <th className="py-3 px-4 font-medium">ฐานครัวเรือน</th>
                <th className="py-3 px-4 font-medium">เข้าร่วม</th>
                <th className="py-3 px-4 font-medium">เปอร์เซ็นต์</th>
                <th className="py-3 pl-4 font-medium">รายการ / คะแนน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-900">
              {villageStats.map((v) => (
                <tr key={v.moo} className="hover:bg-gray-50/60">
                  <td className="py-3.5 pr-4">{v.moo}</td>
                  <td className="py-3.5 px-4">
                    {v.totalHouseholds.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4">
                    {v.participating.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4">{v.percent}%</td>
                  <td className="py-3.5 pl-4">{v.records.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. เวลาอัปเดตข้อมูลด้านล่างสุด */}
      <p className="text-xs text-gray-500">
        ปรับปรุงข้อมูล {updatedAtText || "กำลังโหลด..."}
      </p>
    </div>
  );
}