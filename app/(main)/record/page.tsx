"use client";

import React, { useState, useRef } from "react";
import { Camera, ImagePlus, Check, X } from "lucide-react";

interface WasteCategory {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  topBorderColor: string;
  iconBgColor: string;
}

const WASTE_CATEGORIES: WasteCategory[] = [
  {
    id: "food",
    title: "เศษอาหาร",
    subtitle: "เศษผัก ผลไม้ และอาหาร",
    emoji: "🥬",
    topBorderColor: "border-t-[#2e7d32]",
    iconBgColor: "bg-[#eaf5ea]",
  },
  {
    id: "leaves",
    title: "ใบไม้ / กิ่งไม้",
    subtitle: "ใบไม้แห้งและเศษพืช",
    emoji: "🌿",
    topBorderColor: "border-t-[#2e7d32]",
    iconBgColor: "bg-[#eaf5ea]",
  },
  {
    id: "plastic",
    title: "พลาสติกรีไซเคิล",
    subtitle: "ขวดและภาชนะที่จุดรับรับซื้อ",
    emoji: "🧴",
    topBorderColor: "border-t-[#b7891b]",
    iconBgColor: "bg-[#fbf4dc]",
  },
  {
    id: "paper",
    title: "กระดาษ / กล่อง",
    subtitle: "กระดาษสะอาดและกล่องกระดาษ",
    emoji: "📦",
    topBorderColor: "border-t-[#b7891b]",
    iconBgColor: "bg-[#faecd8]",
  },
  {
    id: "glass",
    title: "ขวดแก้ว",
    subtitle: "ขวดและภาชนะแก้ว",
    emoji: "🍾",
    topBorderColor: "border-t-[#b7891b]",
    iconBgColor: "bg-[#eaf5ea]",
  },
  {
    id: "can",
    title: "กระป๋อง / โลหะ",
    subtitle: "กระป๋องอาหารและเครื่องดื่ม",
    emoji: "🥫",
    topBorderColor: "border-t-[#b7891b]",
    iconBgColor: "bg-[#faecd8]",
  },
  {
    id: "general",
    title: "ขยะทั่วไป",
    subtitle: "ซองขนมและทิชชูใช้แล้ว",
    emoji: "🗑️",
    topBorderColor: "border-t-[#2b74b8]",
    iconBgColor: "bg-[#edf2f7]",
  },
  {
    id: "hazardous",
    title: "ขยะอันตราย",
    subtitle: "ถ่านไฟฉาย หลอดไฟ และสารเคมี",
    emoji: "🔋",
    topBorderColor: "border-t-[#c85a42]",
    iconBgColor: "bg-[#fcebe8]",
  },
];

export default function RecordPage() {
  const [recordDate, setRecordDate] = useState("2026-10-22");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [imagesByCategory, setImagesByCategory] = useState<
    Record<string, string[]>
  >({});

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const cameraInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // เปิด/ปิดการเลือกชนิดขยะ
  const toggleCategory = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // จัดการเมื่อผู้ใช้เลือกรูปหรือถ่ายรูป (สูงสุด 3 รูปต่อชนิด)
  const handleFileChange = (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentImages = imagesByCategory[id] || [];
    if (currentImages.length >= 3) {
      alert("แนบได้สูงสุด 3 รูปต่อชนิดขยะครับ");
      return;
    }

    const newFileUrls = Array.from(files)
      .slice(0, 3 - currentImages.length)
      .map((file) => URL.createObjectURL(file));

    setImagesByCategory((prev) => ({
      ...prev,
      [id]: [...(prev[id] || []), ...newFileUrls],
    }));

    // หากยังไม่ได้ติ๊กถูก ให้ติ๊กเลือกชนิดขยะนั้นอัตโนมัติ
    if (!selectedIds.includes(id)) {
      setSelectedIds((prev) => [...prev, id]);
    }

    e.target.value = "";
  };

  // ลบรูปที่แนบไว้
  const removeImage = (id: string, indexToRemove: number) => {
    setImagesByCategory((prev) => {
      const updated = (prev[id] || []).filter(
        (_, idx) => idx !== indexToRemove
      );
      return { ...prev, [id]: updated };
    });
  };

  const handleSubmit = () => {
    if (selectedIds.length === 0) {
      alert("กรุณาเลือกชนิดขยะอย่างน้อย 1 ชนิดก่อนบันทึกครับ");
      return;
    }
    alert(`บันทึกการคัดแยกจำนวน ${selectedIds.length} ชนิดเรียบร้อยแล้ว!`);
  };

  return (
    <div className="space-y-6 pb-4">
      {/* ส่วนหัวของหน้า */}
      <div>
        <p className="text-xs font-medium text-[#4a6b5b] tracking-wide">
          เลือก · ถ่าย · บันทึก
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mt-0.5">
          วันนี้แยกขยะอะไรบ้าง?
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          บ้านเลขที่ 0 หมู่ 1 · ไม่ต้องชั่งน้ำหนัก
        </p>
      </div>

      {/* กล่องเลือกวันที่คัดแยก */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <label className="block text-xs font-bold text-gray-900 mb-2">
          วันที่คัดแยก
        </label>
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className="w-full md:w-64 shrink-0">
            <input
              type="date"
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#085f46]/20 focus:border-[#085f46] transition-colors"
            />
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p className="flex items-center gap-1.5">
              <span>📷</span>
              <span>ถ่ายเฉพาะขยะ หลีกเลี่ยงใบหน้าและเอกสารส่วนตัว</span>
            </p>
            <p>แนบ 1–3 รูปต่อชนิด · ชนิดเดิมวันเดียวกันได้คะแนนครั้งเดียว</p>
          </div>
        </div>
      </div>

      {/* ตารางการ์ดชนิดขยะทั้ง 8 ชนิด (2 คอลัมน์บนจอคอม, 1 คอลัมน์บนมือถือ) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {WASTE_CATEGORIES.map((cat) => {
          const isSelected = selectedIds.includes(cat.id);
          const images = imagesByCategory[cat.id] || [];

          return (
            <div
              key={cat.id}
              className={`bg-white border border-gray-200 border-t-4 ${
                cat.topBorderColor
              } rounded-2xl p-5 flex flex-col justify-between transition-shadow ${
                isSelected
                  ? "ring-2 ring-[#085f46]/20 shadow-sm"
                  : "shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              }`}
            >
              <div>
                {/* แถวบน: ไอคอน + ชื่อหมวดหมู่ + Checkbox */}
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex items-center gap-3.5 cursor-pointer select-none"
                    onClick={() => toggleCategory(cat.id)}
                  >
                    <div
                      className={`w-12 h-12 rounded-2xl ${cat.iconBgColor} flex items-center justify-center text-2xl shrink-0`}
                    >
                      {cat.emoji}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-base leading-snug">
                        {cat.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {cat.subtitle}
                      </p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCategory(cat.id)}
                    className="w-4 h-4 mt-1 rounded border-gray-300 text-[#085f46] focus:ring-[#085f46] cursor-pointer accent-[#085f46]"
                  />
                </div>

                {/* แถวปุ่ม ถ่ายรูป / เพิ่มรูป */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {/* Input ซ่อนสำหรับเปิดกล้องมือถือ */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={(el) => {
                      cameraInputRefs.current[cat.id] = el;
                    }}
                    onChange={(e) => handleFileChange(cat.id, e)}
                    className="hidden"
                  />
                  {/* Input ซ่อนสำหรับเลือกรูปจากอัลบั้ม */}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    ref={(el) => {
                      fileInputRefs.current[cat.id] = el;
                    }}
                    onChange={(e) => handleFileChange(cat.id, e)}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => cameraInputRefs.current[cat.id]?.click()}
                    className="flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-800 font-semibold text-xs py-2.5 px-3 rounded-xl transition-colors"
                  >
                    <Camera className="w-4 h-4 text-gray-600" />
                    <span>ถ่ายรูป</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[cat.id]?.click()}
                    className="flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-800 font-semibold text-xs py-2.5 px-3 rounded-xl transition-colors"
                  >
                    <ImagePlus className="w-4 h-4 text-gray-600" />
                    <span>เพิ่มรูป</span>
                  </button>
                </div>

                {/* พรีวิวรูปภาพ (แสดงเมื่อมีการแนบรูป) */}
                {images.length > 0 && (
                  <div className="flex items-center gap-2 mt-3 overflow-x-auto py-1">
                    {images.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200 shrink-0"
                      >
                        <img
                          src={url}
                          alt={`${cat.title} ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(cat.id, idx)}
                          className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ข้อความกำกับด้านล่างการ์ด */}
              <p className="text-xs text-gray-500 mt-4">
                เลือกเมื่อบ้านคุณคัดแยกชนิดนี้
              </p>
            </div>
          );
        })}
      </div>

      {/* แถบสรุปผลด้านล่าง (Sticky Bar ลอยตามหน้าจอเวลาเลื่อน และหยุดที่ท้ายตาราง) */}
      <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-2xl p-4 md:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div>
          <p className="font-bold text-gray-900 text-sm">
            {selectedIds.length} ชนิดที่เลือก
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            บันทึกแทนกันได้ คะแนนไม่ซ้ำ
          </p>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className={`inline-flex items-center justify-center gap-2 text-white font-semibold text-xs px-5 py-3 rounded-xl transition-colors ${
            selectedIds.length > 0
              ? "bg-[#085f46] hover:bg-[#064e39]"
              : "bg-[#689b8a] hover:bg-[#5a8a7a]"
          }`}
        >
          <Check className="w-4 h-4" />
          <span>บันทึกการคัดแยก</span>
        </button>
      </div>
    </div>
  );
}