"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, ImagePlus, Check, X, Loader2 } from "lucide-react";
import { Suspense } from 'react'
interface WasteCategory {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  topBorderColor: string;
  iconBgColor: string;
}

// รองรับทั้งรูปเก่าที่ดึงมาจากเซิร์ฟเวอร์ (existingUrl) และรูปใหม่ที่เพิ่งเลือก (file)
interface ImageItem {
  previewUrl: string;
  file?: File;
  existingUrl?: string;
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

// ย่อรูปและแปลงเป็น WebP
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_SIZE = 1280;
      let width = img.width;
      let height = img.height;

      if (width > height && width > MAX_SIZE) {
        height = Math.round((height * MAX_SIZE) / width);
        width = MAX_SIZE;
      } else if (height > MAX_SIZE) {
        width = Math.round((width * MAX_SIZE) / height);
        height = MAX_SIZE;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".webp"),
            { type: "image/webp" }
          );
          resolve(compressedFile);
        },
        "image/webp",
        0.78
      );
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

const CACHE_TTL_MS = 60 * 1000; // เก็บ Cache ไว้ 60 วินาที ป้องกันการกด Refresh รัวๆ


function RecordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [household, setHousehold] = useState<{ id: number; house_number: string; moo: number; } | null>(null);

  // ปรับการดึงค่าเริ่มต้นของข้อมูลวันที่ให้อ่านผ่าน searchParams ได้อย่างปลอดภัย
  const [recordDate, setRecordDate] = useState(() => {
    const dateParam = searchParams.get("date");
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return dateParam;
    return new Date().toISOString().split("T")[0];
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [imagesByCategory, setImagesByCategory] = useState<Record<string, ImageItem[]>>({});
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const cameraInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const saved = localStorage.getItem("sanklang_household");
    if (saved) {
      try { setHousehold(JSON.parse(saved)); } catch {}
    }
  }, []);

  const applyRecordsToState = useCallback((records: any[]) => {
    const loadedSelected: string[] = [];
    const loadedImages: Record<string, ImageItem[]> = {};

    for (const rec of records) {
      loadedSelected.push(rec.category_id);
      const urls: string[] = Array.isArray(rec.images) ? rec.images : [];
      loadedImages[rec.category_id] = urls.map((url) => ({ previewUrl: url, existingUrl: url }));
    }

    setSelectedIds(loadedSelected);
    setImagesByCategory(loadedImages);
  }, []);

  useEffect(() => {
    if (!household?.id || !recordDate) return;

    const cacheKey = `sanklang_rec_${household.id}_${recordDate}`;
    const cachedRaw = sessionStorage.getItem(cacheKey);

    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
          applyRecordsToState(cached.records || []);
          return;
        }
      } catch {}
    }

    let isCancelled = false;
    setLoadingExisting(true);

    fetch(`/api/records?householdId=${household.id}&date=${recordDate}`)
      .then((res) => res.json())
      .then((data) => {
        if (isCancelled) return;
        const records = data.records || [];
        applyRecordsToState(records);
        sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), records }));
      })
      .catch(() => {})
      .finally(() => {
        if (!isCancelled) setLoadingExisting(false);
      });

    return () => { isCancelled = true; };
  }, [household?.id, recordDate, applyRecordsToState]);

  const toggleCategory = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const handleFileChange = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentImages = imagesByCategory[id] || [];
    if (currentImages.length >= 3) {
      alert("แนบได้สูงสุด 3 รูปต่อชนิดขยะครับ (ลบภาพเดิมก่อนหากต้องการเปลี่ยนรูป)");
      e.target.value = "";
      return;
    }

    const filesToProcess = Array.from(files).slice(0, 3 - currentImages.length);
    const processedItems: ImageItem[] = [];

    for (const rawFile of filesToProcess) {
      const compressed = await compressImage(rawFile);
      processedItems.push({ file: compressed, previewUrl: URL.createObjectURL(compressed) });
    }

    setImagesByCategory((prev) => ({ ...prev, [id]: [...(prev[id] || []), ...processedItems] }));
    if (!selectedIds.includes(id)) { setSelectedIds((prev) => [...prev, id]); }
    e.target.value = "";
  };

  // ลบรูปออกจากรายการ (ทั้งรูปเก่าและรูปใหม่)
  const removeImage = (id: string, indexToRemove: number) => {
    setImagesByCategory((prev) => {
      const current = prev[id] || [];
      const target = current[indexToRemove];
      if (target && target.file) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const updated = current.filter((_, idx) => idx !== indexToRemove);
      return { ...prev, [id]: updated };
    });
  };


  const handleSubmit = async () => {
    if (submitting) return;

    if (!household?.id) {
      alert("กรุณาระบุบ้านเลขที่ก่อนบันทึกข้อมูลครับ");
      router.push("/");
      return;
    }

    setSubmitting(true);
    try {
      const imagesPayload: Record<string, string[]> = {};

      for (const catId of selectedIds) {
        const items = imagesByCategory[catId] || [];
        imagesPayload[catId] = await Promise.all(
          items.map(async (item) => {
            // ถ้าเป็นรูปเดิมที่เคยอัปโหลดแล้ว ส่ง URL เดิมไปได้เลย ไม่ต้องแปลง Base64 ซ้ำ
            if (item.existingUrl) return item.existingUrl;
            if (item.file) return await fileToBase64(item.file);
            return "";
          })
        );
      }

      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: household.id,
          recordDate,
          categories: selectedIds,
          imagesByCategory: imagesPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "ไม่สามารถบันทึกข้อมูลได้");
        setSubmitting(false);
        return;
      }

      // ล้าง Cache ของวันที่บันทึกและหน้าประวัติ เพื่อให้ดึงข้อมูลล่าสุดเสมอ
      sessionStorage.removeItem(`sanklang_rec_${household.id}_${recordDate}`);
      sessionStorage.removeItem(`sanklang_history_${household.id}`);
      // ล้าง Cache หน้า community เมื่อมีการบันทึกขยะใหม่
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("sanklang_comm_")) {
          sessionStorage.removeItem(key);
        }
      });
      
      // เด้งไปหน้าประวัติการบันทึกทันที
      router.push("/history");
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setSubmitting(false);
    }
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
          บ้านเลขที่ {household?.house_number || "0"} หมู่ {household?.moo || "1"} · ไม่ต้องชั่งน้ำหนัก
        </p>
      </div>

      {/* กล่องเลือกวันที่คัดแยก */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-bold text-gray-900">
            วันที่คัดแยก
          </label>
          {loadingExisting && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#085f46]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              กำลังโหลดข้อมูลที่เคยบันทึก...
            </span>
          )}
        </div>
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

      {/* ตารางการ์ดชนิดขยะทั้ง 8 ชนิด */}
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

                {/* แสดงรูปภาพ (ทั้งรูปที่เคยอัปโหลดไว้แล้วและรูปที่เพิ่งเลือกเพิ่ม) */}
                {images.length > 0 && (
                  <div className="flex items-center gap-2.5 mt-3.5 overflow-x-auto py-1">
                    {images.map((item, idx) => (
                      <div
                        key={idx}
                        className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 shrink-0 group"
                      >
                        <img
                          src={item.previewUrl}
                          alt={`${cat.title} ${idx + 1}`}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(cat.id, idx)}
                          title="ลบรูปนี้"
                          className="absolute top-1 right-1 bg-black/65 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500 mt-4">
                เลือกเมื่อบ้านคุณคัดแยกชนิดนี้ ({images.length}/3 รูป)
              </p>
            </div>
          );
        })}
      </div>

      {/* แถบสรุปผลด้านล่าง */}
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
          disabled={submitting}
          onClick={handleSubmit}
          className={`inline-flex items-center justify-center gap-2 text-white font-semibold text-xs px-5 py-3 rounded-xl transition-colors disabled:opacity-60 ${
            selectedIds.length > 0
              ? "bg-[#085f46] hover:bg-[#064e39]"
              : "bg-[#689b8a] hover:bg-[#5a8a7a]"
          }`}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span>{submitting ? "กำลังบันทึก..." : "บันทึกการคัดแยก"}</span>
        </button>
      </div>
    </div>
  );
}

export default function RecordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        <span className="ml-2 font-medium text-slate-600">กำลังโหลดหน้าบันทึก...</span>
      </div>
    }>
      <RecordContent />
    </Suspense>
  );
}