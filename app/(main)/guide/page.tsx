"use client";

import React from "react";

interface GuideItem {
  id: string;
  title: string;
  category: string;
  emoji: string;
  description: string;
  topBorderColor: string;
  iconBgColor: string;
}

const GUIDE_ITEMS: GuideItem[] = [
  {
    id: "food",
    title: "เศษอาหาร",
    category: "อินทรีย์",
    emoji: "🥬",
    description:
      "แยกถุงพลาสติกออก นำไปทำปุ๋ยหรือใส่ถังขยะเปียกตามวิธีที่เหมาะสม ไม่เทลงท่อระบายน้ำ",
    topBorderColor: "border-t-[#2e7d32]",
    iconBgColor: "bg-[#eaf5ea]",
  },
  {
    id: "leaves",
    title: "ใบไม้ / กิ่งไม้",
    category: "อินทรีย์",
    emoji: "🌿",
    description:
      "รวบรวมทำปุ๋ยหมัก แยกกิ่งไม้ขนาดใหญ่ และหลีกเลี่ยงการเผา",
    topBorderColor: "border-t-[#2e7d32]",
    iconBgColor: "bg-[#eaf5ea]",
  },
  {
    id: "plastic",
    title: "พลาสติกรีไซเคิล",
    category: "รีไซเคิล",
    emoji: "🧴",
    description:
      "เทของเหลวออก ล้างคราบและผึ่งให้แห้ง แยกตามชนิดที่จุดรับรับซื้อ พลาสติกทุกชนิดไม่ได้รีไซเคิลได้ในทุกพื้นที่",
    topBorderColor: "border-t-[#b7891b]",
    iconBgColor: "bg-[#f4f6ec]",
  },
  {
    id: "paper",
    title: "กระดาษ / กล่อง",
    category: "รีไซเคิล",
    emoji: "📦",
    description:
      "เก็บให้แห้ง พับกล่อง กระดาษเปื้อนน้ำมันหรือทิชชูใช้แล้วแยกเป็นขยะทั่วไป",
    topBorderColor: "border-t-[#b7891b]",
    iconBgColor: "bg-[#f4f6ec]",
  },
  {
    id: "glass",
    title: "ขวดแก้ว",
    category: "รีไซเคิล",
    emoji: "🍾",
    description:
      "เทของเหลวออกและล้างให้สะอาด แก้วแตกห่อให้มิดชิดและติดป้ายเตือน สอบถามจุดรับก่อนส่งต่อ",
    topBorderColor: "border-t-[#b7891b]",
    iconBgColor: "bg-[#eef4ed]",
  },
  {
    id: "can",
    title: "กระป๋อง / โลหะ",
    category: "รีไซเคิล",
    emoji: "🥫",
    description:
      "ล้างคราบอาหารและผึ่งให้แห้ง กระป๋องสารเคมีหรือสเปรย์แยกเป็นขยะอันตราย",
    topBorderColor: "border-t-[#b7891b]",
    iconBgColor: "bg-[#eef4ed]",
  },
  {
    id: "general",
    title: "ขยะทั่วไป",
    category: "ทั่วไป",
    emoji: "🗑️",
    description:
      "ใส่ถุงให้มิดชิดเพื่อรอเก็บขน แยกของมีคมและติดป้ายเตือน ไม่รวมถ่านไฟฉายหรือสารเคมี",
    topBorderColor: "border-t-[#2b74b8]",
    iconBgColor: "bg-[#eef2f0]",
  },
  {
    id: "hazardous",
    title: "ขยะอันตราย",
    category: "อันตราย",
    emoji: "🔋",
    description:
      "แยกเก็บในภาชนะที่เหมาะสม ไม่เจาะ ไม่เผา ไม่ผสมสารเคมี สอบถามจุดรับจากเทศบาล หากมีการรั่วไหลให้หลีกเลี่ยงการสัมผัส",
    topBorderColor: "border-t-[#c85a42]",
    iconBgColor: "bg-[#eef4ed]",
  },
];

export default function GuidePage() {
  return (
    <div className="space-y-6 pb-4">
      {/* ส่วนหัวและปุ่มถามน้องอาสา */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#4a6b5b] tracking-wide">
            เรียนรู้ไปด้วยกัน
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mt-0.5">
            ขยะแบบนี้ แยกอย่างไร?
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            8 ชนิดที่เลือกบันทึกได้ จัดอยู่ในขยะ 4 ประเภท
          </p>
        </div>

        <button
          type="button"
          onClick={() => alert("เปิดหน้าต่างแชทถามน้องอาสา")}
          className="self-start sm:self-center bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold text-xs px-4 py-2.5 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors shrink-0"
        >
          ถามน้องอาสา
        </button>
      </div>

      {/* ตารางการ์ดคู่มือทั้ง 8 ชนิด (2 คอลัมน์บนจอคอม, 1 คอลัมน์บนจอมือถือ) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GUIDE_ITEMS.map((item) => (
          <div
            key={item.id}
            className={`bg-white border border-gray-200 border-t-4 ${item.topBorderColor} rounded-2xl p-5 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between space-y-4`}
          >
            {/* แถวบน: ไอคอน + ชื่อชนิดขยะ + ป้ายประเภท */}
            <div className="flex items-start gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl ${item.iconBgColor} flex items-center justify-center text-2xl shrink-0`}
              >
                {item.emoji}
              </div>

              <div className="space-y-1.5">
                <h3 className="font-bold text-gray-900 text-base leading-snug">
                  {item.title}
                </h3>
                <span className="inline-block bg-[#eef3e3] text-[#4a5d47] text-xs font-medium px-2.5 py-0.5 rounded-md">
                  {item.category}
                </span>
              </div>
            </div>

            {/* คำอธิบายวิธีการแยกขยะ */}
            <p className="text-xs sm:text-sm text-gray-800 leading-relaxed">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}