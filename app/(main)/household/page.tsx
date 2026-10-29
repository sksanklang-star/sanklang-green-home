"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Trophy,
  Calendar,
  Recycle,
  MapPin,
  Navigation,
  ExternalLink,
  Check,
  X,
  Loader2,
} from "lucide-react";

interface HouseholdData {
  id: number;
  house_number: string;
  moo: number;
  qgis_id?: string | null;
  lat?: number | null;
  lng?: number | null;
}

const VALID_CATEGORIES = new Set([
  "food", "leaves", "plastic", "paper", "glass", "can", "general", "hazardous",
]);

// พิกัดเริ่มต้น: ตำบลสันกลาง อำเภอสันกำแพง จังหวัดเชียงใหม่
const DEFAULT_LAT = 18.7845;
const DEFAULT_LNG = 99.0485;
const CACHE_TTL_MS = 60 * 1000;

export default function HouseholdPage() {
  const [household, setHousehold] = useState<HouseholdData | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // State สำหรับฟอร์มแจ้งข้อมูลบ้านไม่ถูกต้อง
  const [issueDetail, setIssueDetail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [issueFeedback, setIssueFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // State สำหรับ Modal ปักหมุดแผนที่ Google Maps
  const [showMapModal, setShowMapModal] = useState(false);
  const [draftLat, setDraftLat] = useState<number>(DEFAULT_LAT);
  const [draftLng, setDraftLng] = useState<number>(DEFAULT_LNG);
  const [coordInput, setCoordInput] = useState<string>("");
  const [locatingGps, setLocatingGps] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [mapError, setMapError] = useState("");

  // 1. โหลดข้อมูลครัวเรือนและสถิติการคัดแยก
  useEffect(() => {
    const saved = localStorage.getItem("sanklang_household");
    if (!saved) {
      setLoadingStats(false);
      return;
    }

    let parsed: HouseholdData | null = null;
    try {
      parsed = JSON.parse(saved);
      if (parsed?.id) {
        setHousehold(parsed);
        if (parsed.lat && parsed.lng) {
          setDraftLat(Number(parsed.lat));
          setDraftLng(Number(parsed.lng));
          setCoordInput(`${parsed.lat}, ${parsed.lng}`);
        }
      }
    } catch {}

    if (!parsed?.id) {
      setLoadingStats(false);
      return;
    }

    const controller = new AbortController();

    // ดึงข้อมูลบ้านล่าสุดจากฐานข้อมูล (เช็คสถานะ lat / lng ล่าสุด)
    fetch("/api/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_info", householdId: parsed.id }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.household) {
          setHousehold(data.household);
          localStorage.setItem(
            "sanklang_household",
            JSON.stringify(data.household)
          );
          if (data.household.lat && data.household.lng) {
            setDraftLat(Number(data.household.lat));
            setDraftLng(Number(data.household.lng));
            setCoordInput(`${data.household.lat}, ${data.household.lng}`);
          }
        }
      })
      .catch(() => {});

    // ดึงสถิติการบันทึกขยะ (ใช้ sessionStorage Cache ร่วมกับหน้า /home และ /history)
    const cacheKey = `sanklang_history_${parsed.id}`;
    const cachedRaw = sessionStorage.getItem(cacheKey);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (Date.now() - cached.timestamp < CACHE_TTL_MS && Array.isArray(cached.records)) {
          setRecords(cached.records);
          setLoadingStats(false);
          return;
        }
      } catch {}
    }

    fetch(`/api/records?householdId=${parsed.id}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
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
        if (!controller.signal.aborted) setLoadingStats(false);
      });

    return () => controller.abort();
  }, []);

  // คำนวณสถิติ 3 การ์ดบน
  const stats = useMemo(() => {
    const totalPoints = records.reduce(
      (sum, r) => sum + (Number(r.points) || 1),
      0
    );
    const activeDays = new Set(records.map((r) => r.record_date)).size;
    const uniqueCategories = new Set(
      records
        .map((r) => r.category_id)
        .filter((catId) => VALID_CATEGORIES.has(catId))
    ).size;

    return { totalPoints, activeDays, uniqueCategories };
  }, [records]);

  const hasPinnedLocation =
    household?.lat !== null &&
    household?.lat !== undefined &&
    household?.lng !== null &&
    household?.lng !== undefined;

  // เปิดหน้าต่าง Google Maps และขอตำแหน่งปัจจุบัน
  const handleOpenMapModal = () => {
    setMapError("");
    const initLat = hasPinnedLocation ? Number(household!.lat) : DEFAULT_LAT;
    const initLng = hasPinnedLocation ? Number(household!.lng) : DEFAULT_LNG;
    setDraftLat(initLat);
    setDraftLng(initLng);
    setCoordInput(`${initLat.toFixed(6)}, ${initLng.toFixed(6)}`);
    setShowMapModal(true);

    // ถ้าบ้านนี้ยังไม่ได้ปักหมุด ให้ขอพิกัด GPS ปัจจุบันให้อัตโนมัติทันทีที่เปิดหน้าต่าง
    if (!hasPinnedLocation) {
      requestCurrentGpsLocation();
    }
  };

  // ขอเข้าถึงตำแหน่ง GPS จากอุปกรณ์ของผู้ใช้
  const requestCurrentGpsLocation = () => {
    setMapError("");
    if (!("geolocation" in navigator)) {
      setMapError("เบราว์เซอร์ของคุณไม่รองรับการดึงตำแหน่ง GPS");
      return;
    }

    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setDraftLat(lat);
        setDraftLng(lng);
        setCoordInput(`${lat}, ${lng}`);
        setLocatingGps(false);
      },
      () => {
        setLocatingGps(false);
        setMapError(
          "ไม่สามารถเข้าถึงตำแหน่งปัจจุบันได้ กรุณากดอนุญาตสิทธิ์ตำแหน่ง หรือระบุพิกัดด้วยตนเองด้านล่างค่ะ"
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // รองรับการพิมพ์หรือวางค่าพิกัด "18.7845, 99.0485" หรือวางลิงก์จาก Google Maps
  const handleCoordInputChange = (val: string) => {
    setCoordInput(val);
    setMapError("");

    // ดึงตัวเลขทศนิยมคู่ที่เป็นพิกัด เช่น 18.7845, 99.0485 หรือ @18.7845,99.0485
    const match = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/.exec(val);
    if (match) {
      const parsedLat = Number(Number(match[1]).toFixed(6));
      const parsedLng = Number(Number(match[2]).toFixed(6));
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        setDraftLat(parsedLat);
        setDraftLng(parsedLng);
      }
    }
  };

  // บันทึกตำแหน่งพิกัดบ้าน (lat, lng) ลงฐานข้อมูล
  const handleSaveLocation = async () => {
    if (!household?.id || savingLocation) return;
    setMapError("");

    if (
      !Number.isFinite(draftLat) ||
      !Number.isFinite(draftLng) ||
      draftLat < 18.5 ||
      draftLat > 19.1 ||
      draftLng < 98.8 ||
      draftLng > 99.3
    ) {
      setMapError(
        "พิกัดต้องอยู่ในพื้นที่จังหวัดเชียงใหม่ (เช่น 18.7845, 99.0485)"
      );
      return;
    }

    setSavingLocation(true);
    try {
      const res = await fetch("/api/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_location",
          householdId: household.id,
          lat: draftLat,
          lng: draftLng,
          website_hp: honeypot,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMapError(data.error || "ไม่สามารถบันทึกพิกัดได้");
        setSavingLocation(false);
        return;
      }

      if (data.household) {
        setHousehold(data.household);
        localStorage.setItem(
          "sanklang_household",
          JSON.stringify(data.household)
        );
      }
      setShowMapModal(false);
    } catch {
      setMapError("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setSavingLocation(false);
    }
  };

  // ส่งฟอร์มแจ้งข้อมูลบ้านไม่ถูกต้องเข้าตาราง household_reports
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingIssue || !household?.id) return;
    setIssueFeedback(null);

    const trimmed = issueDetail.trim();
    if (trimmed.length < 3) {
      setIssueFeedback({
        type: "error",
        text: "กรุณากรอกรายละเอียดที่ต้องการแก้ไขอย่างน้อย 3 ตัวอักษรค่ะ",
      });
      return;
    }

    setSubmittingIssue(true);
    try {
      const res = await fetch("/api/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report_issue",
          householdId: household.id,
          detail: trimmed,
          website_hp: honeypot,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setIssueFeedback({
          type: "error",
          text: data.error || "ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่ค่ะ",
        });
        setSubmittingIssue(false);
        return;
      }

      setIssueDetail("");
      setIssueFeedback({
        type: "success",
        text: "ส่งเรื่องแจ้งเจ้าหน้าที่เรียบร้อยแล้วค่ะ ขอบคุณค่ะ",
      });
    } catch {
      setIssueFeedback({
        type: "error",
        text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setSubmittingIssue(false);
    }
  };

  return (
    <div className="space-y-6 pb-4">
      {/* 1. ส่วนหัวหน้าข้อมูลครัวเรือน */}
      <div>
        <p className="text-xs font-medium text-[#4a6b5b] tracking-wide">
          บ้านของเรา
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mt-0.5">
          บ้านเลขที่ {household?.house_number || "0"} หมู่{" "}
          {household?.moo || "1"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          ข้อมูลร่วมกันของครัวเรือน ใครในบ้านก็ช่วยบันทึกได้
        </p>
      </div>

      {/* 2. การ์ดสรุปผล 3 ช่อง */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* การ์ดที่ 1: คะแนนสะสม */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>คะแนนสะสม</span>
            <Trophy className="w-4 h-4 text-gray-400" />
          </div>
          <div className="my-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-gray-900">
              {loadingStats ? "0" : stats.totalPoints.toLocaleString()}
            </span>
            <span className="text-sm font-medium text-gray-700">คะแนน</span>
          </div>
          <p className="text-xs text-gray-500">ชนิดละ 1 คะแนน / วัน</p>
        </div>

        {/* การ์ดที่ 2: วันที่ร่วมคัดแยก */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>วันที่ร่วมคัดแยก</span>
            <Calendar className="w-4 h-4 text-gray-400" />
          </div>
          <div className="my-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-gray-900">
              {loadingStats ? "0" : stats.activeDays.toLocaleString()}
            </span>
            <span className="text-sm font-medium text-gray-700">วัน</span>
          </div>
          <p className="text-xs text-gray-500">ทุกวันที่ลงมือมีความหมาย</p>
        </div>

        {/* การ์ดที่ 3: ชนิดขยะที่เคยแยก */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>ชนิดขยะที่เคยแยก</span>
            <Recycle className="w-4 h-4 text-gray-400" />
          </div>
          <div className="my-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-gray-900">
              {loadingStats ? "0" : stats.uniqueCategories}
            </span>
            <span className="text-sm font-medium text-gray-700">จาก 8 ชนิด</span>
          </div>
          <p className="text-xs text-gray-500">เริ่มจากสิ่งที่บ้านเรามี</p>
        </div>
      </div>

      {/* 3. ส่วนล่าง: ข้อมูลบ้าน (ซ้าย) และ แจ้งข้อมูลบ้านไม่ถูกต้อง (ขวา) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* กล่องซ้าย: ข้อมูลบ้าน */}
        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-2xl p-6 flex flex-col justify-between space-y-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">ข้อมูลบ้าน</h3>

            <div className="space-y-1">
              <p className="text-sm text-gray-900">
                บ้านเลขที่{" "}
                <span className="font-bold">
                  {household?.house_number || "0"}
                </span>{" "}
                · หมู่ที่{" "}
                <span className="font-bold">{household?.moo || "1"}</span>
              </p>
              <p className="text-xs text-gray-500">
                ตำบลสันกลาง อำเภอสันกำแพง จังหวัดเชียงใหม่
              </p>
            </div>

            {/* แถบแสดงสถานะการปักหมุดบ้าน (เช็คจาก lat/lng ในฐานข้อมูล) */}
            {hasPinnedLocation ? (
              <div className="bg-[#eef6ec] border border-[#c5e1be] rounded-xl px-4 py-3 flex items-center justify-between gap-2 text-xs text-[#1b4d2e]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <MapPin className="w-4 h-4 text-[#085f46] shrink-0" />
                  <span className="truncate font-medium">
                    ปักหมุดบ้านแล้ว ({Number(household?.lat).toFixed(5)},{" "}
                    {Number(household?.lng).toFixed(5)})
                  </span>
                </div>
                <a
                  href={`https://www.google.com/maps?q=${household?.lat},${household?.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[#085f46] font-semibold hover:underline shrink-0"
                >
                  <span>ดูแผนที่</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              <div className="bg-[#fdf6e2] border border-[#f5e2a8] rounded-xl px-4 py-3 flex items-center gap-2.5 text-xs text-gray-800">
                <MapPin className="w-4 h-4 text-gray-700 shrink-0" />
                <span>ไม่ได้ปักหมุดบ้าน</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* ปุ่มกดเพื่อเปิด Google Maps และขอตำแหน่ง / ปักหมุดบ้าน */}
            <button
              type="button"
              onClick={handleOpenMapModal}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors"
            >
              เปลี่ยนบ้านที่บันทึก
            </button>

            <Link
              href="/"
              className="text-xs text-gray-500 hover:text-[#085f46] hover:underline"
            >
              สลับเลขที่บ้านอื่น
            </Link>
          </div>
        </div>

        {/* กล่องขวา: แจ้งข้อมูลบ้านไม่ถูกต้อง */}
        <form
          onSubmit={handleReportSubmit}
          className="lg:col-span-5 bg-white border border-gray-200 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
        >
          {/* Honeypot ดักบอท */}
          <input
            type="text"
            name="website_hp"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
          />

          <div className="space-y-3">
            <h3 className="font-bold text-gray-900 text-lg">
              แจ้งข้อมูลบ้านไม่ถูกต้อง
            </h3>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-800">
                รายละเอียดที่ต้องการแก้ไข
              </label>
              <textarea
                rows={4}
                maxLength={500}
                value={issueDetail}
                onChange={(e) => {
                  setIssueDetail(e.target.value);
                  setIssueFeedback(null);
                }}
                placeholder="เช่น บ้านเลขที่พิมพ์ผิด หรือข้อมูลซ้ำ"
                className="w-full bg-white border border-gray-300 rounded-xl p-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#085f46]/20 focus:border-[#085f46] resize-y"
              />
            </div>

            {issueFeedback && (
              <p
                className={`text-xs px-3 py-2 rounded-lg ${
                  issueFeedback.type === "success"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {issueFeedback.text}
              </p>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={submittingIssue}
              className="inline-flex items-center gap-2 bg-[#085f46] hover:bg-[#064e39] disabled:opacity-60 text-white font-semibold text-xs px-5 py-3 rounded-xl transition-colors"
            >
              {submittingIssue && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>ส่งแจ้งเจ้าหน้าที่</span>
            </button>
          </div>
        </form>
      </div>

      {/* =========================================================
          Modal: เปิด Google Maps เพื่อดึงตำแหน่ง GPS หรือเลือกตำแหน่งเอง
      ========================================================= */}
      {showMapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px]">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl relative space-y-4 max-h-[92vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowMapModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="pr-6">
              <h3 className="text-lg font-bold text-gray-900">
                ปักหมุดตำแหน่งบ้านของคุณ
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                บ้านเลขที่ {household?.house_number} หมู่ที่ {household?.moo} ·
                กดใช้ตำแหน่งปัจจุบัน หรือเลือกจุดบน Google Maps
              </p>
            </div>

            {/* ปุ่มขอเข้าถึงตำแหน่งปัจจุบัน (GPS) และปุ่มเปิดแอป Google Maps */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={requestCurrentGpsLocation}
                disabled={locatingGps}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-[#eef3e3] hover:bg-[#e2ecd0] text-[#085f46] font-semibold text-xs py-2.5 px-4 rounded-xl transition-colors"
              >
                {locatingGps ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
                <span>
                  {locatingGps
                    ? "กำลังค้นหาตำแหน่ง..."
                    : "ใช้ตำแหน่งปัจจุบันของฉัน (GPS)"}
                </span>
              </button>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${draftLat},${draftLng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs py-2.5 px-4 rounded-xl transition-colors"
              >
                <span>เปิดแอป Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* แผนที่ Google Maps แสดงจุดที่ปักหมุดแบบสดๆ */}
            <div className="w-full h-64 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 relative">
              <iframe
                title="Google Maps Location"
                key={`${draftLat}-${draftLng}`}
                src={`https://maps.google.com/maps?q=${draftLat},${draftLng}&z=17&hl=th&output=embed`}
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            {/* ช่องปรับแต่งพิกัดด้วยตัวเอง หรือวางพิกัดจาก Google Maps */}
            <div className="space-y-2 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
              <label className="block text-xs font-bold text-gray-800">
                ตำแหน่งพิกัด (ละติจูด, ลองจิจูด) หรือวางพิกัดจาก Google Maps
              </label>
              <input
                type="text"
                value={coordInput}
                onChange={(e) => handleCoordInputChange(e.target.value)}
                placeholder="เช่น 18.784500, 99.048500"
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#085f46]/20 focus:border-[#085f46]"
              />

              {/* ปุ่มเลื่อนหมุดละเอียด (เผื่อชาวบ้านต้องการขยับหมุดให้ตรงหลังคาบ้าน) */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-gray-500">
                <span>ขยับหมุดละเอียด:</span>
                {/* <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const nextLat = Number((draftLat + 0.0002).toFixed(6));
                      setDraftLat(nextLat);
                      setCoordInput(`${nextLat}, ${draftLng}`);
                    }}
                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
                  >
                    ⬆️ เหนือ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextLat = Number((draftLat - 0.0002).toFixed(6));
                      setDraftLat(nextLat);
                      setCoordInput(`${nextLat}, ${draftLng}`);
                    }}
                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
                  >
                    ⬇️ ใต้
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextLng = Number((draftLng - 0.0002).toFixed(6));
                      setDraftLng(nextLng);
                      setCoordInput(`${draftLat}, ${nextLng}`);
                    }}
                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
                  >
                    ⬅️ ตะวันตก
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextLng = Number((draftLng + 0.0002).toFixed(6));
                      setDraftLng(nextLng);
                      setCoordInput(`${draftLat}, ${nextLng}`);
                    }}
                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
                  >
                    ➡️ ตะวันออก
                  </button>
                </div> */}
              </div>
            </div>

            {mapError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3.5 py-2.5 rounded-xl">
                {mapError}
              </div>
            )}

            {/* ปุ่มบันทึกตำแหน่งบ้าน */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveLocation}
                disabled={savingLocation}
                className="inline-flex items-center gap-2 bg-[#085f46] hover:bg-[#064e39] disabled:opacity-60 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors"
              >
                {savingLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>บันทึกตำแหน่งบ้าน</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}