"use client";

import React, { useState } from "react";
import { Home, Check, ChevronDown, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const fontStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap');
  .font-kanit {
    font-family: 'Kanit', sans-serif;
  }
`;

export default function App() {
  const router = useRouter();

  const [houseNumber, setHouseNumber] = useState("");
  const [moo, setMoo] = useState("");
  const [honeypot, setHoneypot] = useState(""); // กับดักบอท

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);

  // บังคับรับเฉพาะตัวเลข 0-9 และเครื่องหมาย /
  const handleHouseNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^0-9/]/g, "");
    setHouseNumber(cleaned);
    setErrorMsg("");
  };

  // กดปุ่ม "เข้าใช้งาน" เพื่อเช็คบ้านในฐานข้อมูล
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // ป้องกันการรัวคลิก (Debounce 1.2 วินาที)
    const now = Date.now();
    if (now - lastSubmitTime < 1200) return;
    setLastSubmitTime(now);

    const trimmedHouse = houseNumber.trim();
    if (!trimmedHouse) {
      setErrorMsg("กรุณากรอกบ้านเลขที่");
      return;
    }
    if (!/^[0-9]{1,5}(\/[0-9]{1,4})?$/.test(trimmedHouse)) {
      setErrorMsg("รูปแบบบ้านเลขที่ไม่ถูกต้อง (เช่น 100 หรือ 125/3)");
      return;
    }
    if (!moo) {
      setErrorMsg("กรุณาเลือกหมู่บ้าน");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check",
          houseNumber: trimmedHouse,
          moo: Number(moo),
          website_hp: honeypot,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "ไม่สามารถตรวจสอบข้อมูลได้");
        setLoading(false);
        return;
      }

      if (data.exists && data.household) {
        // พบบ้านในระบบแล้ว -> เก็บข้อมูลและเด้งไปหน้า /home ทันที
        localStorage.setItem(
          "sanklang_household",
          JSON.stringify(data.household)
        );
        router.push("/home");
      } else {
        // ยังไม่พบบ้านนี้ในระบบ -> เปิด Modal ยืนยันครัวเรือนใหม่
        setShowConfirmModal(true);
      }
    } catch (error) {
      setErrorMsg("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  // กดปุ่ม "ยืนยันและเข้าใช้งาน" ใน Modal เพื่อเพิ่มบ้านใหม่ลงฐานข้อมูล
  const handleConfirmCreate = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          houseNumber: houseNumber.trim(),
          moo: Number(moo),
          website_hp: honeypot,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "ไม่สามารถเพิ่มข้อมูลบ้านได้");
        setShowConfirmModal(false);
        setLoading(false);
        return;
      }

      if (data.household) {
        localStorage.setItem(
          "sanklang_household",
          JSON.stringify(data.household)
        );
        setShowConfirmModal(false);
        router.push("/home");
      }
    } catch (error) {
      setErrorMsg("เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่");
      setShowConfirmModal(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{fontStyles}</style>

      <div className="min-h-screen flex flex-col md:flex-row font-kanit bg-white relative">
        {/* ฝั่งซ้าย */}
        <div className="w-full md:w-1/2 bg-[#125B41] text-white flex flex-col justify-center items-center md:items-start p-8 md:p-16 lg:p-24 min-h-[50vh] md:min-h-screen">
          <div className="max-w-md w-full">
            {/* Header Text */}
            <h3 className="text-sm md:text-base font-light mb-2 tracking-wide opacity-90">
              เทศบาลตำบลสันกลาง
            </h3>
            <h1 className="text-4xl md:text-5xl font-semibold mb-6 leading-tight">
              เริ่มจากบ้านเรา
              <br />
              ให้สันกลางเขียวขึ้น
            </h1>
            <p className="text-sm md:text-base opacity-80 mb-12 font-light leading-relaxed">
              ระบบบันทึกข้อมูลการคัดแยกขยะ
              <br />
              อำเภอสันกำแพง จังหวัดเชียงใหม่
            </p>

            {/* Mascot Image Placeholder */}
            <div className="bg-[#EAF5EF] rounded-3xl w-64 h-64 mx-auto md:mx-0 flex flex-col items-center justify-center shadow-lg relative overflow-hidden group">
              <img src={"nong-asa.png"} alt="น้องอาสา" />
            </div>
          </div>
        </div>

        {/* ฝั่งขวา */}
        <div className="w-full md:w-1/2 bg-white flex flex-col justify-center items-center p-8 md:p-16 lg:p-24 relative min-h-[50vh] md:min-h-screen">
          <div className="max-w-md w-full">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 bg-[#E9F3EE] text-[#196B4A] px-3 py-1.5 rounded-lg text-sm font-medium mb-6">
                <Home size={16} />
                <span>สำหรับทุกครัวเรือน</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                บ้านของคุณอยู่ที่ไหน?
              </h2>
              <p className="text-gray-500 text-sm">
                ระบุบ้านที่จะบันทึกข้อมูล ไม่ต้องใช้รหัสผ่าน
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* ช่องดักบอท (Honeypot) ซ่อนไว้ */}
              <input
                type="text"
                name="website_hp"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
              />

              {/* House Number Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  บ้านเลขที่
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={houseNumber}
                  onChange={handleHouseNumberChange}
                  placeholder="เช่น 125/3"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#125B41] focus:border-transparent transition-all placeholder:text-gray-400"
                />
                <p className="text-xs text-gray-500 mt-2">
                  ใช้เลขอารบิก 0-9 และเครื่องหมาย /
                </p>
              </div>

              {/* Village Dropdown Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  หมู่ที่
                </label>
                <div className="relative">
                  <select
                    value={moo}
                    onChange={(e) => {
                      setMoo(e.target.value);
                      setErrorMsg("");
                    }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-[#125B41] focus:border-transparent transition-all bg-white"
                  >
                    <option value="" disabled>
                      เลือกหมู่บ้าน
                    </option>
                    <option value="1">หมู่ที่ 1</option>
                    <option value="2">หมู่ที่ 2</option>
                    <option value="3">หมู่ที่ 3</option>
                    <option value="4">หมู่ที่ 4</option>
                    <option value="5">หมู่ที่ 5</option>
                    <option value="6">หมู่ที่ 6</option>
                    <option value="7">หมู่ที่ 7</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                    <ChevronDown size={18} />
                  </div>
                </div>
              </div>

              {/* ข้อความแจ้งเตือนกรณีกรอกไม่ครบหรือเกิดข้อผิดพลาด */}
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3.5 py-2.5 rounded-lg">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#6C9D86] hover:bg-[#5B8C75] disabled:opacity-60 text-white font-medium py-3.5 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 mt-4 shadow-sm"
              >
                {loading && !showConfirmModal ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Check size={20} />
                )}
                เข้าใช้งาน
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-[13px] text-gray-400 leading-relaxed mb-6">
                บันทึกแทนกันได้ ผู้ที่เลือกบ้านเดียวกันจะดูประวัติและรูปของบ้านนั้นได้
                <br className="hidden md:block" />
                กรุณาตรวจบ้านก่อนบันทึก
              </p>

              <div className="flex items-center justify-center gap-6">
                <Link
                  href="/community"
                  className="text-[#125B41] font-semibold text-sm hover:underline"
                >
                  ดูแดชบอร์ด
                </Link>
                <Link
                  href="/admin"
                  className="text-[#125B41] font-semibold text-sm hover:underline"
                >
                  เจ้าหน้าที่
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================
            Modal: ยืนยันครัวเรือนใหม่ (แสดงเมื่อยังไม่พบบ้านนี้ในระบบ)
        ========================================================= */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px]">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl relative space-y-5">
              {/* ปุ่มกากบาทมุมขวาบน */}
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5" />
              </button>

              {/* หัวข้อ Modal */}
              <div className="space-y-1.5 pr-6">
                <h3 className="text-xl font-bold text-gray-900">
                  ยืนยันครัวเรือนใหม่
                </h3>
                <p className="text-sm text-gray-500">
                  ยังไม่พบบ้านนี้ในระบบ กรุณาตรวจสอบก่อนเพิ่ม
                </p>
              </div>

              {/* แสดงบ้านเลขที่และหมู่ที่ขนาดใหญ่ */}
              <div className="py-1">
                <p className="text-2xl font-bold text-gray-900">
                  บ้านเลขที่ {houseNumber.trim()} หมู่ {moo}
                </p>
              </div>

              {/* คำอธิบายการเชื่อมพิกัด QGIS */}
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                พิกัดจะเชื่อมให้อัตโนมัติเมื่อมีข้อมูล QGIS ตรงกัน คุณบันทึกขยะได้ทันที
              </p>

              {/* ปุ่มยืนยันและเข้าใช้งาน */}
              <button
                type="button"
                onClick={handleConfirmCreate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#085f46] hover:bg-[#064e39] disabled:opacity-60 text-white font-medium text-sm py-3.5 px-6 rounded-xl transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>ยืนยันและเข้าใช้งาน</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}