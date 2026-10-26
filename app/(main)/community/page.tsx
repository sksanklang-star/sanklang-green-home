"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Printer,
  TreePine,
  Users,
  Leaf,
  Recycle,
  ChevronDown,
} from "lucide-react";

interface WasteStat {
  id: string;
  name: string;
  emoji: string;
  count: number;
  barColor: string;
}

interface VillageStat {
  moo: number;
  totalHouseholds: number;
  participating: number;
  percent: number;
  records: number;
}

const WASTE_STATS: WasteStat[] = [
  { id: "food", name: "เศษอาหาร", emoji: "🥬", count: 1, barColor: "bg-[#2e7d32]" },
  { id: "leaves", name: "ใบไม้ / กิ่งไม้", emoji: "🌿", count: 0, barColor: "bg-[#2e7d32]" },
  { id: "plastic", name: "พลาสติกรีไซเคิล", emoji: "🧴", count: 1, barColor: "bg-[#b7891b]" },
  { id: "paper", name: "กระดาษ / กล่อง", emoji: "📦", count: 1, barColor: "bg-[#b7891b]" },
  { id: "glass", name: "ขวดแก้ว", emoji: "🍾", count: 1, barColor: "bg-[#b7891b]" },
  { id: "can", name: "กระป๋อง / โลหะ", emoji: "🥫", count: 0, barColor: "bg-[#b7891b]" },
  { id: "general", name: "ขยะทั่วไป", emoji: "🗑️", count: 0, barColor: "bg-[#2b74b8]" },
  { id: "hazardous", name: "ขยะอันตราย", emoji: "🔋", count: 0, barColor: "bg-[#c85a42]" },
];

const VILLAGE_STATS: VillageStat[] = [
  { moo: 1, totalHouseholds: 1000, participating: 2, percent: 0.2, records: 4 },
  { moo: 2, totalHouseholds: 1000, participating: 0, percent: 0, records: 0 },
  { moo: 3, totalHouseholds: 700, participating: 0, percent: 0, records: 0 },
  { moo: 4, totalHouseholds: 700, participating: 0, percent: 0, records: 0 },
  { moo: 5, totalHouseholds: 900, participating: 0, percent: 0, records: 0 },
  { moo: 6, totalHouseholds: 600, participating: 0, percent: 0, records: 0 },
  { moo: 7, totalHouseholds: 500, participating: 0, percent: 0, records: 0 },
];

export default function CommunityPage() {
  const [startDate, setStartDate] = useState("2026-10-01");
  const [endDate, setEndDate] = useState("2026-10-22");
  const [area, setArea] = useState("all");
  const [metricType, setMetricType] = useState("households");

  // เปอร์เซ็นต์การมีส่วนร่วมสำหรับคุมวิดีโอต้นไม้ (0 - 100)
  // สามารถเปลี่ยนค่าเริ่มต้นตรงนี้ (เช่น ลองใส่ 50) เพื่อทดสอบวิดีโอหยุดที่วินาทีที่ 5 ได้ครับ
  const [treePercent, setTreePercent] = useState<number>(70);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const VIDEO_DURATION = 10; // ความยาววิดีโอเต็ม 10 วินาที

  // คำนวณวินาทีที่ต้องหยุดจาก % (เช่น 0% = 0 วิ, 50% = 5 วิ, 100% = 10 วิ)
  const targetStopTime =
    (Math.min(Math.max(treePercent, 0), 100) / 100) * VIDEO_DURATION;

  // สั่งเล่นหรือหยุดวิดีโอเมื่อค่าเปอร์เซ็นต์เปลี่ยน
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (targetStopTime <= 0) {
      video.pause();
      video.currentTime = 0;
    } else {
      video.currentTime = 0;
      video.play().catch(() => {
        // กรณีเบราว์เซอร์บล็อก Autoplay หรือยังไม่มีไฟล์วิดีโอจริง
      });
    }
  }, [targetStopTime]);

  // ฟังก์ชันตรวจจับเวลาขณะวิดีโอเล่น เพื่อสั่งหยุดเมื่อถึงวินาทีเป้าหมาย
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.currentTime >= targetStopTime) {
      video.pause();
      video.currentTime = targetStopTime; // ล็อกเฟรมไว้ที่วินาทีตาม % เป๊ะๆ
    }
  };

  const maxWasteCount = Math.max(...WASTE_STATS.map((item) => item.count), 1);

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
              className="inline-flex items-center justify-center gap-2 bg-[#085f46] hover:bg-[#064e39] text-white font-semibold text-xs px-5 py-3 rounded-xl transition-colors shrink-0"
            >
              <TreePine className="w-4 h-4" />
              <span>แสดงผล</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. แถบแจ้งเตือนข้อมูลสาธิตและช่วงเวลาที่แสดง */}
      <div className="space-y-3">
        <div className="bg-[#fdf6e2] border border-[#f5e2a8] text-gray-800 text-xs px-4 py-3 rounded-xl">
          ใช้จำนวนครัวเรือนสมมติสำหรับสาธิต · ฐานทั้งตำบล 5,400 ครัวเรือน (หรือค่าที่เจ้าหน้าที่ปรับ) · ผู้เข้าร่วมและรายการด้านล่างมาจากข้อมูลที่บันทึกในระบบ
        </div>
        <p className="text-xs text-gray-500">
          ผลที่แสดง: ทั้งตำบล · 1 ต.ค. 2569 – 22 ต.ค. 2569
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
            <span className="text-3xl font-bold text-gray-900">2</span>
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
          <p className="text-xs text-gray-500">จากฐาน 5,400 ครัวเรือน</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>รายการคัดแยก</span>
            <Recycle className="w-4 h-4 text-gray-400" />
          </div>
          <div className="my-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-gray-900">4</span>
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
              // นำไฟล์วิดีโอ 10 วินาทีมาวางในโฟลเดอร์ public แล้วเปลี่ยนชื่อไฟล์ตรง src ได้เลยครับ
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
            {/* ข้อความกำกับพื้นที่ว่าง (จะถูกซ่อนทับเมื่อมีภาพจากวิดีโอ) 
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-gray-400 text-xs p-4">
              <span>พื้นที่สำหรับวิดีโอต้นไม้ (10 วินาที)</span>
              <span className="mt-1 text-[11px]">
                (หยุดที่วินาทีที่ {targetStopTime.toFixed(1)} ตามค่า {treePercent}%)
              </span>
            </div>*/}
          </div>

          <div className="space-y-2 w-full max-w-md">
            <div className="text-4xl md:text-5xl font-bold text-[#085f46]">
              {treePercent}%
            </div>
            <p className="text-xs text-gray-500">
              2 จาก 5,400 ครัวเรือนร่วมคัดแยก
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
                onChange={(e) => setMetricType(e.target.value)}
                className="w-full appearance-none bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 pr-9 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#085f46]/20 focus:border-[#085f46]"
              >
                <option value="households">จำนวนครัวเรือน</option>
                <option value="records">จำนวนรายการ</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* รายการ Progress bar ของขยะทั้ง 8 ชนิด */}
            <div className="space-y-3.5 pt-1">
              {WASTE_STATS.map((item) => {
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
                        {item.count}
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
            หน่วย: ครัวเรือน · ไม่ใช่น้ำหนักขยะ
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

        {/* แถบสรุปทั้ง 7 หมู่บ้านแนวนอน */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 pt-6">
          {VILLAGE_STATS.map((v) => (
            <div key={v.moo} className="text-center space-y-2">
              <div className="text-xs font-bold text-gray-900">
                {v.percent}%
              </div>
              <div className="w-full h-1 bg-[#6b9e78] rounded-full" />
              <div className="text-xs text-gray-800 font-medium">
                หมู่ {v.moo}
              </div>
              <div className="text-xs text-gray-500">{v.participating} บ้าน</div>
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
              {VILLAGE_STATS.map((v) => (
                <tr key={v.moo} className="hover:bg-gray-50/60">
                  <td className="py-3.5 pr-4">{v.moo}</td>
                  <td className="py-3.5 px-4">
                    {v.totalHouseholds.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4">{v.participating}</td>
                  <td className="py-3.5 px-4">{v.percent}%</td>
                  <td className="py-3.5 pl-4">{v.records}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. เวลาอัปเดตข้อมูลด้านล่างสุด */}
      <p className="text-xs text-gray-500">
        ปรับปรุงข้อมูล 22/10/2569 13:36:45
      </p>
    </div>
  );
}