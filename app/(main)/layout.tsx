"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Camera,
  History,
  Users,
  BookOpen,
  TreePine,
  ShieldCheck,
  Recycle,
  PanelLeft,
  Bot,
  Menu,
  X,
} from "lucide-react";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: "หน้าหลัก", href: "/home", icon: Home },
    { name: "บันทึกขยะ", href: "/record", icon: Camera },
    { name: "ประวัติการบันทึก", href: "/history", icon: History },
    { name: "ผลรวมชุมชน", href: "/community", icon: Users },
    { name: "คู่มือคัดแยก", href: "/guide", icon: BookOpen },
    { name: "ข้อมูลครัวเรือน", href: "/household", icon: Home },
    { name: "แดชบอร์ดต้นไม้", href: "/tree-dashboard", icon: TreePine },
  ];

  return (
    <div className="min-h-screen flex bg-[#fbfcfa] text-gray-800 font-sans">
      {/* =========================================
          1. Sidebar สำหรับหน้าจอคอมพิวเตอร์ (Desktop)
      ========================================= */}
      <aside
        className={`${
          sidebarOpen ? "w-64 border-r border-gray-200" : "w-0 border-r-0"
        } hidden md:block bg-[#f8faf7] transition-all duration-300 ease-in-out shrink-0 sticky top-0 h-screen overflow-hidden`}
      >
        {/* กล่องครอบด้านใน ล็อกความกว้าง w-64 เสมอ เพื่อป้องกันข้อความบีบชนกันตอนพับ */}
        <div className="w-64 h-full flex flex-col justify-between">
          {/* ส่วนหัว Sidebar */}
          <div className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#085f46] flex items-center justify-center text-white shrink-0 mt-1">
                <Recycle className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-gray-900 text-lg leading-tight">
                  สันกลางคัด
                  <br />
                  แยก
                </h1>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed whitespace-nowrap">
                  บ้านสร้างสุข สันกลางรักษ์โลก
                </p>
              </div>
            </div>
          </div>

          {/* รายการเมนู */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <p className="px-3 text-xs font-medium text-gray-500 mb-2 whitespace-nowrap">
              ร่วมสร้างชุมชนน่าอยู่
            </p>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? "bg-[#e5efe3] text-[#085f46] font-semibold"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? "text-[#085f46]" : "text-gray-500"
                      }`}
                    />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* ส่วนท้าย Sidebar */}
          <div className="p-4 border-t border-gray-200 text-xs text-gray-500 space-y-2 whitespace-nowrap">
            <div>
              <p className="font-medium text-gray-600">เทศบาลตำบลสันกลาง</p>
              <p>อ.สันกำแพง จ.เชียงใหม่</p>
            </div>
            <Link
              href="/admin"
              className="flex items-center gap-2 text-[#085f46] font-semibold pt-1 hover:underline"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>สำหรับเจ้าหน้าที่</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* =========================================
          2. Sidebar สำหรับมือถือ (Mobile Slide Drawer)
      ========================================= */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-visibility duration-300 ${
          mobileMenuOpen ? "visible" : "invisible pointer-events-none"
        }`}
      >
        {/* พื้นหลังสีดำโปร่งแสง (Fade In / Fade Out) */}
        <div
          className={`fixed inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity duration-300 ease-in-out ${
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* ตัวเมนูสไลด์จากซ้าย (Slide In / Slide Out) */}
        <aside
          className={`fixed top-0 left-0 bottom-0 w-72 max-w-[80vw] bg-[#f8faf7] h-full flex flex-col justify-between z-10 shadow-2xl transform transition-transform duration-300 ease-in-out ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* ส่วนหัว Mobile Sidebar */}
          <div className="p-5 flex items-center justify-between border-b border-gray-200/70">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#085f46] flex items-center justify-center text-white shrink-0">
                <Recycle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-gray-900 text-sm truncate">
                  สันกลางคัดแยก
                </h1>
                <p className="text-[11px] text-gray-500 truncate">
                  บ้านสร้างสุข สันกลางรักษ์โลก
                </p>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-200/50 transition-colors shrink-0"
              aria-label="ปิดเมนู"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* รายการเมนูบนมือถือ */}
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <p className="px-3 text-xs font-medium text-gray-500 mb-2 whitespace-nowrap">
              ร่วมสร้างชุมชนน่าอยู่
            </p>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? "bg-[#e5efe3] text-[#085f46] font-semibold"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? "text-[#085f46]" : "text-gray-500"
                      }`}
                    />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* ส่วนท้าย Mobile Sidebar */}
          <div className="p-4 border-t border-gray-200 text-xs text-gray-500 space-y-2 whitespace-nowrap">
            <div>
              <p className="font-medium text-gray-600">เทศบาลตำบลสันกลาง</p>
              <p>อ.สันกำแพง จ.เชียงใหม่</p>
            </div>
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 text-[#085f46] font-semibold pt-1"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>สำหรับเจ้าหน้าที่</span>
            </Link>
          </div>
        </aside>
      </div>

      {/* =========================================
          3. พื้นที่เนื้อหาหลักด้านขวา (Main Content)
      ========================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar (ป้องกันข้อความชนกันบนจอมือถือด้วย min-w-0 และ truncate) */}
        <header className="h-14 border-b border-gray-200 bg-white/80 backdrop-blur-sm px-3 sm:px-6 flex items-center justify-between gap-2 sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* ปุ่มพับ Sidebar บน PC */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:flex p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
              title="ย่อ/ขยายเมนู"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            {/* ปุ่มเปิดเมนูบนมือถือ */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
              aria-label="เปิดเมนู"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs sm:text-sm font-medium text-gray-800 truncate">
              ระบบบันทึกข้อมูลการคัดแยกขยะ
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm shrink-0">
            <Home className="w-4 h-4 text-gray-600 hidden xs:block shrink-0" />
            <span className="text-gray-800 font-medium whitespace-nowrap">
              0 · หมู่ 1
            </span>
            <Link
              href="/"
              className="text-[#085f46] font-semibold hover:underline ml-0.5 sm:ml-1 whitespace-nowrap"
            >
              เปลี่ยนบ้าน
            </Link>
          </div>
        </header>

        {/* เนื้อหาของแต่ละหน้า (Page) จะถูกแสดงตรงนี้ */}
        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>

        {/* ส่วนท้ายหน้ากระดาษ */}
        <footer className="border-t border-gray-200 py-4 px-4 md:px-8 text-xs text-gray-500 max-w-6xl w-full mx-auto">
          เทศบาลตำบลสันกลาง • ร่วมคัดแยกด้วยภาพ ไม่ต้องชั่งน้ำหนัก
        </footer>
      </div>

      {/* ปุ่มลอย "ถามน้องอาสา" */}
      <button
        type="button"
        onClick={() => alert("เปิดหน้าต่างแชทถามน้องอาสา")}
        className="fixed bottom-5 right-6 z-40 flex items-center gap-2.5 bg-[#085f46] hover:bg-[#064e39] text-white pl-2 pr-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all"
      >
        <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0">
          <Bot className="w-6 h-6 text-[#085f46]" />
        </div>
        <span className="text-sm font-semibold">ถามน้องอาสา</span>
      </button>
    </div>
  );
}