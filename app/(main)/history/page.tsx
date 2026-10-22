"use client";

import React, { useState } from "react";
import { Leaf, ChevronDown } from "lucide-react";

export default function HistoryPage() {
  const [wasteType, setWasteType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("2026-10-14");

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
        {/* แถวตัวกรอง 3 ช่อง (Responsive: เรียงเดี่ยวในมือถือ, 3 คอลัมน์ในจอคอม) */}
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
                <option value="organic">ขยะอินทรีย์ / ขยะเปียก</option>
                <option value="recycle">ขยะรีไซเคิล</option>
                <option value="general">ขยะทั่วไป</option>
                <option value="hazardous">ขยะอันตราย</option>
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
        <p className="text-xs text-gray-500 mt-4">
          พบ 0 รายการ · 0 วันที่ร่วมคัดแยก
        </p>

        {/* พื้นที่แสดงสถานะเมื่อไม่มีรายการ */}
        <div className="py-16 md:py-20 flex flex-col items-center justify-center text-center">
          <Leaf className="w-8 h-8 text-[#7fa982] mb-2.5 stroke-[1.75]" />
          <p className="font-bold text-gray-900 text-sm">
            ไม่มีรายการในช่วงที่เลือก
          </p>
          <p className="text-xs text-gray-500 mt-1">
            เปลี่ยนตัวกรอง หรือเริ่มบันทึกการคัดแยกค่ะ
          </p>
        </div>
      </div>
    </div>
  );
}