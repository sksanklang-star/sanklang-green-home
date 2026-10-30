"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Camera,
  ImagePlus,
  Check,
  X,
  Loader2,
  Scale,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
} from "lucide-react";

interface WasteCategory {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  topBorderColor: string;
  iconBgColor: string;
}

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

// รองรับทั้ง Android/PC (WebP) และ iPhone/iOS Safari (Fallback เป็น JPEG อัตโนมัติ)
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_SIZE = 1200;
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
      if (!ctx) {
        reject(new Error("ไม่สามารถประมวลผลรูปภาพได้"));
        return;
      }

      // ถมพื้นหลังสีขาวกันภาพโปร่งใสเวลาแปลงเป็น JPEG บน iPhone
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // ลองแปลงเป็น WebP ก่อน ถ้า iPhone ไม่รองรับหรือไฟล์ใหญ่เกิน ให้แปลงเป็น JPEG ทันที
      canvas.toBlob(
        (webpBlob) => {
          if (
            webpBlob &&
            webpBlob.type === "image/webp" &&
            webpBlob.size > 0 &&
            webpBlob.size <= 1.8 * 1024 * 1024
          ) {
            const safeName = file.name.replace(/\.[^.]+$/, "") || "waste";
            resolve(
              new File([webpBlob], `${safeName}.webp`, { type: "image/webp" })
            );
            return;
          }

          // Fallback สำหรับ iPhone / Safari: ใช้ image/jpeg คุณภาพ 0.8
          canvas.toBlob(
            (jpegBlob) => {
              if (!jpegBlob || jpegBlob.size === 0) {
                reject(
                  new Error(
                    "ไม่สามารถแปลงไฟล์รูปจากอุปกรณ์นี้ได้ กรุณาตั้งค่ากล้องเป็นรูปแบบ JPEG (Most Compatible)"
                  )
                );
                return;
              }
              const safeName = file.name.replace(/\.[^.]+$/, "") || "waste";
              resolve(
                new File([jpegBlob], `${safeName}.jpg`, { type: "image/jpeg" })
              );
            },
            "image/jpeg",
            0.8
          );
        },
        "image/webp",
        0.78
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          "เบราว์เซอร์ไม่สามารถอ่านไฟล์รูปนี้ได้ (หากใช้ iPhone กรุณาถ่ายรูปผ่านปุ่ม 'ถ่ายรูป' หรือใช้ไฟล์ JPG/PNG)"
        )
      );
    };

    img.src = url;
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      if (!result.startsWith("data:image/")) {
        reject(new Error("รูปแบบข้อมูลรูปภาพไม่ถูกต้อง"));
        return;
      }
      resolve(result);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

const CACHE_TTL_MS = 60 * 1000;

function RecordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [household, setHousehold] = useState<{
    id: number;
    house_number: string;
    moo: number;
  } | null>(null);

  const [recordDate, setRecordDate] = useState(() => {
    const dateParam = searchParams.get("date");
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return dateParam;
    return new Date().toISOString().split("T")[0];
  });

  const [imagesByCategory, setImagesByCategory] = useState<
    Record<string, ImageItem[]>
  >({});
  const [weightsByCategory, setWeightsByCategory] = useState<
    Record<string, string>
  >({});
  const [missingWeightIds, setMissingWeightIds] = useState<string[]>([]);

  // จำไว้ว่าวันนี้เคยมีข้อมูลเดิมในฐานข้อมูลหรือไม่ (ถ้าไม่เคยมี ห้ามกดบันทึกตอนรูปเป็น 0 เด็ดขาด)
  const [hadExistingRecords, setHadExistingRecords] = useState(false);

  const [loadingExisting, setLoadingExisting] = useState(false);
  // State สำหรับแสดง Modal หมุนๆ ตอนกำลังย่อรูปจากมือถือ
  const [processingImages, setProcessingImages] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [lightbox, setLightbox] = useState<{
    title: string;
    images: string[];
    index: number;
  } | null>(null);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const cameraInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // คำนวณรายการที่ถูกเลือกอัตโนมัติจากหมวดที่มีรูปภาพอย่างน้อย 1 รูปเท่านั้น
  const selectedIds = useMemo(() => {
    return WASTE_CATEGORIES.map((c) => c.id).filter(
      (id) => (imagesByCategory[id]?.length || 0) > 0
    );
  }, [imagesByCategory]);

  useEffect(() => {
    const saved = localStorage.getItem("sanklang_household");
    if (saved) {
      try {
        setHousehold(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const applyRecordsToState = useCallback((records: any[]) => {
    const loadedImages: Record<string, ImageItem[]> = {};
    const loadedWeights: Record<string, string> = {};
    let foundAny = false;

    for (const rec of records) {
      const urls: string[] = Array.isArray(rec.images) ? rec.images : [];
      if (urls.length > 0) {
        foundAny = true;
        loadedImages[rec.category_id] = urls.map((url) => ({
          previewUrl: url,
          existingUrl: url,
        }));
      }
      const w = Number(rec.weight_kg);
      if (w > 0) {
        loadedWeights[rec.category_id] = String(w);
      }
    }

    setHadExistingRecords(foundAny);
    setImagesByCategory(loadedImages);
    setWeightsByCategory(loadedWeights);
    setMissingWeightIds([]);
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
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({ timestamp: Date.now(), records })
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!isCancelled) setLoadingExisting(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [household?.id, recordDate, applyRecordsToState]);

  const handleWeightChange = (id: string, rawVal: string) => {
    const cleaned = rawVal.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    const formatted =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;

    if (Number(formatted) > 500) return;

    setWeightsByCategory((prev) => ({
      ...prev,
      [id]: formatted,
    }));

    if (Number(formatted) > 0) {
      setMissingWeightIds((prev) => prev.filter((item) => item !== id));
    }
  };

  // เมื่อเลือกรูปหรือถ่ายรูป จะเปิด Modal กำลังประมวลผลรูปภาพทันทีเพื่อไม่ให้หน้าจอนิ่ง
  const handleFileChange = async (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentImages = imagesByCategory[id] || [];
    if (currentImages.length >= 3) {
      alert("แนบได้สูงสุด 3 รูปต่อชนิดขยะครับ (ลบภาพเดิมก่อนหากต้องการเปลี่ยนรูป)");
      e.target.value = "";
      return;
    }

    const filesToProcess = Array.from(files).slice(0, 3 - currentImages.length);
    e.target.value = "";

    setProcessingImages(true);
    try {
      // เว้นจังหวะสั้นๆ ให้ React เรนเดอร์ Modal หมุนๆ ขึ้นมาก่อนเริ่มย่อรูปหนักๆ
      await new Promise((r) => setTimeout(r, 50));

      const processedItems: ImageItem[] = [];
      for (const rawFile of filesToProcess) {
        const compressed = await compressImage(rawFile);
        processedItems.push({
          file: compressed,
          previewUrl: URL.createObjectURL(compressed),
        });
      }

      setImagesByCategory((prev) => ({
        ...prev,
        [id]: [...(prev[id] || []), ...processedItems],
      }));
    } catch (err: any) {
      alert(err?.message || "ไม่สามารถโหลดรูปภาพนี้ได้ กรุณาลองถ่ายใหม่อีกครั้งครับ");
    } finally {
      setProcessingImages(false);
    }
  };

  const removeImage = (id: string, indexToRemove: number) => {
    setImagesByCategory((prev) => {
      const current = prev[id] || [];
      const target = current[indexToRemove];
      if (target && target.file) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const updated = current.filter((_, idx) => idx !== indexToRemove);
      if (updated.length === 0) {
        setMissingWeightIds((m) => m.filter((item) => item !== id));
      }
      return { ...prev, [id]: updated };
    });
  };

  const handleSubmit = async () => {
    if (submitting || processingImages) return;

    if (!household?.id) {
      alert("กรุณาระบุบ้านเลขที่ก่อนบันทึกข้อมูลครับ");
      router.push("/");
      return;
    }

    // 🔒 ดักจับกรณีไม่ได้แนบรูปอะไรเลย
    if (selectedIds.length === 0) {
      if (!hadExistingRecords) {
        alert("กรุณาถ่ายรูปหรือเพิ่มรูปขยะอย่างน้อย 1 ชนิดก่อนกดบันทึกครับ");
        return;
      }
      const confirmDeleteAll = window.confirm(
        "คุณได้ลบรูปภาพของวันนี้ออกทั้งหมด ต้องการลบรายการบันทึกของวันนี้ใช่หรือไม่?"
      );
      if (!confirmDeleteAll) return;
    }

    // ตรวจสอบว่าทุกหมวดที่มีรูปภาพ ต้องกรอกน้ำหนัก (> 0 กก.) ครบทุกหมวด
    const invalidWeightCats: string[] = [];
    for (const catId of selectedIds) {
      const w = parseFloat(weightsByCategory[catId] || "0");
      if (!Number.isFinite(w) || w <= 0) {
        invalidWeightCats.push(catId);
      }
    }

    if (invalidWeightCats.length > 0) {
      setMissingWeightIds(invalidWeightCats);
      const missingNames = WASTE_CATEGORIES.filter((c) =>
        invalidWeightCats.includes(c.id)
      )
        .map((c) => c.title)
        .join(", ");
      alert(`กรุณากรอกปริมาณน้ำหนัก (กิโลกรัม) สำหรับ: ${missingNames}`);
      return;
    }

    setSubmitting(true);
    try {
      const imagesPayload: Record<string, string[]> = {};
      const weightsPayload: Record<string, number> = {};

      for (const catId of selectedIds) {
        const items = imagesByCategory[catId] || [];
        const encodedList = await Promise.all(
          items.map(async (item) => {
            if (item.existingUrl) return item.existingUrl;
            if (item.file) return await fileToBase64(item.file);
            return "";
          })
        );

        const validList = encodedList.filter((str) => str.length > 0);
        // 🔒 ดักจับชั้นที่ 2: ถ้าแปลงไฟล์รูปแล้วไม่สำเร็จ ห้ามส่งไปบันทึกเด็ดขาด
        if (validList.length === 0) {
          throw new Error(
            "พบรูปภาพที่ไม่สามารถอัปโหลดได้ กรุณาลบรูปแล้วลองถ่ายใหม่อีกครั้งครับ"
          );
        }

        imagesPayload[catId] = validList;
        const w = parseFloat(weightsByCategory[catId] || "0");
        weightsPayload[catId] = Math.round(w * 100) / 100;
      }

      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: household.id,
          recordDate,
          categories: selectedIds,
          imagesByCategory: imagesPayload,
          weightsByCategory: weightsPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "ไม่สามารถบันทึกข้อมูลได้");
        setSubmitting(false);
        return;
      }

      sessionStorage.removeItem(`sanklang_rec_${household.id}_${recordDate}`);
      sessionStorage.removeItem(`sanklang_history_${household.id}`);
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("sanklang_comm_")) {
          sessionStorage.removeItem(key);
        }
      });

      router.push("/history");
    } catch (error: any) {
      alert(error?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setSubmitting(false);
    }
  };

  const totalSelectedWeight = selectedIds.reduce((sum, id) => {
    const val = parseFloat(weightsByCategory[id] || "0");
    return sum + (Number.isFinite(val) && val > 0 ? val : 0);
  }, 0);

  const today = new Date();
  const maxDate = today.toISOString().split("T")[0];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  const minDate = sevenDaysAgo.toISOString().split("T")[0];

  // ปุ่มบันทึกจะกดได้ก็ต่อเมื่อมีรูปอย่างน้อย 1 หมวด หรือเคยมีข้อมูลของวันนี้แล้วต้องการลบออก
  const canSubmit = selectedIds.length > 0 || hadExistingRecords;

  return (
    <div className="space-y-6 pb-4">
      {/* ส่วนหัวของหน้า */}
      <div>
        <p className="text-xs font-medium text-[#4a6b5b] tracking-wide">
          ถ่ายรูป · ระบุน้ำหนัก · บันทึก
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mt-0.5">
          วันนี้แยกขยะอะไรบ้าง?
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          บ้านเลขที่ {household?.house_number || "0"} หมู่{" "}
          {household?.moo || "1"} · แนบรูปและระบุปริมาณกิโลกรัมเพื่อบันทึก
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
              min={minDate}
              max={maxDate}
            />
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p className="flex items-center gap-1.5">
              <span>📷</span>
              <span>ถ่ายเฉพาะขยะ หลีกเลี่ยงใบหน้าและเอกสารส่วนตัว</span>
            </p>
            <p>
              แนบ 1–3 รูปต่อชนิด (ระบบจะติ๊กเลือกให้อัตโนมัติเมื่อมีรูป) และกรอกน้ำหนักรวม
            </p>
          </div>
        </div>
      </div>

      {/* ตารางการ์ดชนิดขยะทั้ง 8 ชนิด */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {WASTE_CATEGORIES.map((cat) => {
          const images = imagesByCategory[cat.id] || [];
          const isSelected = images.length > 0;
          const weightVal = weightsByCategory[cat.id] || "";
          const isMissingWeight = missingWeightIds.includes(cat.id);

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
                  <div className="flex items-center gap-3.5 select-none">
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
                    disabled
                    readOnly
                    title={
                      isSelected
                        ? "เลือกอัตโนมัติเนื่องจากแนบรูปแล้ว"
                        : "แนบรูปภาพเพื่อเลือกหมวดหมู่นี้"
                    }
                    className="w-4 h-4 mt-1 rounded border-gray-300 text-[#085f46] accent-[#085f46] disabled:opacity-90 cursor-not-allowed"
                  />
                </div>

                {/* แถวปุ่ม ถ่ายรูป / เพิ่มรูป */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    capture="environment"
                    ref={(el) => {
                      cameraInputRefs.current[cat.id] = el;
                    }}
                    onChange={(e) => handleFileChange(cat.id, e)}
                    className="hidden"
                  />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    multiple
                    ref={(el) => {
                      fileInputRefs.current[cat.id] = el;
                    }}
                    onChange={(e) => handleFileChange(cat.id, e)}
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={processingImages || submitting}
                    onClick={() => cameraInputRefs.current[cat.id]?.click()}
                    className="flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-800 font-semibold text-xs py-2.5 px-3 rounded-xl transition-colors"
                  >
                    <Camera className="w-4 h-4 text-gray-600" />
                    <span>ถ่ายรูป</span>
                  </button>

                  <button
                    type="button"
                    disabled={processingImages || submitting}
                    onClick={() => fileInputRefs.current[cat.id]?.click()}
                    className="flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-800 font-semibold text-xs py-2.5 px-3 rounded-xl transition-colors"
                  >
                    <ImagePlus className="w-4 h-4 text-gray-600" />
                    <span>เพิ่มรูป</span>
                  </button>
                </div>

                {/* ช่องกรอกปริมาณโดยรวม */}
                <div
                  className={`mt-3 flex items-center justify-between gap-3 rounded-xl px-3.5 py-2 border transition-colors ${
                    isMissingWeight
                      ? "bg-red-50/70 border-red-300"
                      : isSelected
                      ? "bg-[#eef6ec]/60 border-[#085f46]/30"
                      : "bg-[#f8faf7] border-gray-200/80 opacity-60"
                  }`}
                >
                  <label
                    htmlFor={`weight-${cat.id}`}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-800"
                  >
                    <Scale className="w-3.5 h-3.5 text-[#085f46]" />
                    <span>
                      ปริมาณโดยรวม{" "}
                      {isSelected && (
                        <span className="text-red-600 font-bold">*</span>
                      )}
                    </span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id={`weight-${cat.id}`}
                      type="text"
                      inputMode="decimal"
                      disabled={!isSelected}
                      placeholder={isSelected ? "ระบุ กก." : "แนบรูปก่อน"}
                      value={weightVal}
                      onChange={(e) =>
                        handleWeightChange(cat.id, e.target.value)
                      }
                      className={`w-24 bg-white border rounded-lg px-2.5 py-1 text-right text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed ${
                        isMissingWeight
                          ? "border-red-400 focus:ring-red-200 focus:border-red-500"
                          : "border-gray-300 focus:ring-[#085f46]/20 focus:border-[#085f46]"
                      }`}
                    />
                    <span className="text-xs text-gray-600 font-medium">
                      กก.
                    </span>
                  </div>
                </div>
                {isMissingWeight && (
                  <p className="text-[11px] text-red-600 font-medium mt-1">
                    * กรุณาระบุน้ำหนักมากกว่า 0 กิโลกรัม
                  </p>
                )}

                {/* แสดงรูปภาพ */}
                {images.length > 0 && (
                  <div className="flex items-center gap-2.5 mt-3.5 overflow-x-auto py-1">
                    {images.map((item, idx) => (
                      <div
                        key={idx}
                        className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 shrink-0 group cursor-pointer"
                        onClick={() =>
                          setLightbox({
                            title: cat.title,
                            images: images.map((img) => img.previewUrl),
                            index: idx,
                          })
                        }
                      >
                        <img
                          src={item.previewUrl}
                          alt={`${cat.title} ${idx + 1}`}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(cat.id, idx);
                          }}
                          title="ลบรูปนี้"
                          className="absolute top-1 right-1 bg-black/65 text-white rounded-full p-1 hover:bg-red-600 transition-colors z-10"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500 mt-3">
                {isSelected
                  ? `แนบแล้ว ${images.length}/3 รูป · ติ๊กเลือกอัตโนมัติ`
                  : "แนบรูปถ่ายอย่างน้อย 1 รูปเพื่อเลือกชนิดนี้"}
              </p>
            </div>
          );
        })}
      </div>

      {/* แถบสรุปผลด้านล่าง */}
      <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-2xl p-4 md:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div>
          <p className="font-bold text-gray-900 text-sm">
            {selectedIds.length} ชนิดที่มีรูปภาพ
            {totalSelectedWeight > 0 && (
              <span className="ml-2 text-[#085f46] font-semibold">
                · น้ำหนักรวม{" "}
                {totalSelectedWeight.toFixed(2).replace(/\.00$/, "")} กก.
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            ต้องแนบรูปและระบุน้ำหนักทุกชนิดที่เลือก · คะแนนไม่ซ้ำ
          </p>
        </div>

        <button
          type="button"
          disabled={submitting || processingImages || !canSubmit}
          onClick={handleSubmit}
          className={`inline-flex items-center justify-center gap-2 text-white font-semibold text-xs px-5 py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            selectedIds.length > 0
              ? "bg-[#085f46] hover:bg-[#064e39]"
              : "bg-[#689b8a]"
          }`}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span>
            {submitting
              ? "กำลังบันทึก..."
              : selectedIds.length === 0 && hadExistingRecords
              ? "บันทึกการลบรายการ"
              : "บันทึกการคัดแยก"}
          </span>
        </button>
      </div>

      {/* =========================================================
          Modal แสดงสถานะกำลังโหลดรูปภาพ / กำลังบันทึกข้อมูล
      ========================================================= */}
      {(processingImages || submitting) && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-xs w-full shadow-2xl flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#eaf5ea] flex items-center justify-center text-[#085f46]">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h4 className="font-bold text-gray-900 text-base">
              {processingImages
                ? "กำลังเตรียมรูปภาพ..."
                : "กำลังบันทึกข้อมูล..."}
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              {processingImages
                ? "ระบบกำลังย่อขนาดรูปภาพให้เหมาะกับการอัปโหลด กรุณารอสักครู่ค่ะ"
                : "กำลังอัปโหลดรูปภาพและบันทึกข้อมูลลงระบบ กรุณาอย่าปิดหน้านี้ค่ะ"}
            </p>
          </div>
        </div>
      )}

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
                  {lightbox.title}
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

export default function RecordPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex flex-col items-center justify-center text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin text-[#085f46] mb-2" />
          <p className="text-xs">กำลังโหลดหน้าบันทึกขยะ...</p>
        </div>
      }
    >
      <RecordContent />
    </Suspense>
  );
}