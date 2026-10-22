"use client";

import React from "react";
import Link from "next/link";
import {
  Plus,
  Trophy,
  Calendar,
  Recycle,
  Leaf,
  Bot,
} from "lucide-react";

export default function HomePage() {
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
          <p className="text-sm text-gray-500 mt-1">บ้านเลขที่ 0 หมู่ 1</p>
        </div>

        <div className="self-start sm:self-center bg-[#eff4e6] text-gray-700 text-xs font-medium px-3.5 py-1.5 rounded-lg">
          14 ต.ค. 2569
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
            <img src="nong-asa.png" alt="น้องอาสา" /> 
        </div>
      </div>

      {/* การ์ดสรุปผล 3 ช่อง */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* การ์ดที่ 1 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>คะแนนสะสม</span>
            <Trophy className="w-4 h-4 text-gray-400" />
          </div>
          <div className="my-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-gray-900">0</span>
            <span className="text-sm font-medium text-gray-700">คะแนน</span>
          </div>
          <p className="text-xs text-gray-500">ชนิดละ 1 คะแนน / วัน</p>
        </div>

        {/* การ์ดที่ 2 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>วันที่ร่วมคัดแยก</span>
            <Calendar className="w-4 h-4 text-gray-400" />
          </div>
          <div className="my-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-gray-900">0</span>
            <span className="text-sm font-medium text-gray-700">วัน</span>
          </div>
          <p className="text-xs text-gray-500">ทุกวันที่ลงมือมีความหมาย</p>
        </div>

        {/* การ์ดที่ 3 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>ชนิดขยะที่เคยแยก</span>
            <Recycle className="w-4 h-4 text-gray-400" />
          </div>
          <div className="my-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-gray-900">0</span>
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

          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <Leaf className="w-8 h-8 text-[#7fa982] mb-2 stroke-[1.75]" />
            <p className="font-semibold text-gray-800 text-sm">
              ยังไม่มีรายการบันทึก
            </p>
            <p className="text-xs text-gray-500 mt-1">
              เริ่มคัดแยกวันนี้ แล้วบันทึกภาพไว้ด้วยกันค่ะ
            </p>
          </div>
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