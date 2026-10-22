'use client';
import React from 'react';
import { Home, Check, ChevronDown, MessageCircle, Bot } from 'lucide-react';
import { useRouter } from "next/navigation";

const fontStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap');
  .font-kanit {
    font-family: 'Kanit', sans-serif;
  }
`;



export default function App() {
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/home"); // สั่งให้เด้งไปหน้า /home ทันที
  };

  return (
    <>
      {}
      <style>{fontStyles}</style>
      
      {}
      <div className="min-h-screen flex flex-col md:flex-row font-kanit bg-white relative">
        
        {}
        <div className="w-full md:w-1/2 bg-[#125B41] text-white flex flex-col justify-center items-center md:items-start p-8 md:p-16 lg:p-24 min-h-[50vh] md:min-h-screen">
          
          <div className="max-w-md w-full">
            {/* Header Text */}
            <h3 className="text-sm md:text-base font-light mb-2 tracking-wide opacity-90">
              เทศบาลตำบลสันกลาง
            </h3>
            <h1 className="text-4xl md:text-5xl font-semibold mb-6 leading-tight">
              เริ่มจากบ้านเรา<br />
              ให้สันกลางเขียวขึ้น
            </h1>
            <p className="text-sm md:text-base opacity-80 mb-12 font-light leading-relaxed">
              ระบบบันทึกข้อมูลการคัดแยกขยะ<br />
              อำเภอสันกำแพง จังหวัดเชียงใหม่
            </p>

            {/* Mascot Image Placeholder */}
            <div className="bg-[#EAF5EF] rounded-3xl w-64 h-64 mx-auto md:mx-0 flex flex-col items-center justify-center shadow-lg relative overflow-hidden group">
              <img src={'nong-asa.png'} />
            </div>
          </div>

        </div>

        {}
        <div className="w-full md:w-1/2 bg-white flex flex-col justify-center items-center p-8 md:p-16 lg:p-24 relative min-h-[50vh] md:min-h-screen">
          
          <div className="max-w-md w-full">
            
            {}
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

            {}
            <form className="space-y-6" onSubmit={(e)=>handleSubmit(e)}>
              
              {/* House Number Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  บ้านเลขที่
                </label>
                <input 
                  type="text" 
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
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-[#125B41] focus:border-transparent transition-all bg-white"
                    defaultValue=""
                  >
                    <option value="" disabled>เลือกหมู่บ้าน</option>
                    <option value="1">หมู่ที่ 1</option>
                    <option value="2">หมู่ที่ 2</option>
                    <option value="3">หมู่ที่ 3</option>
                    {/* Add more options as needed */}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                    <ChevronDown size={18} />
                  </div>
                </div>
              </div>

              {}
              <button 
                type="submit"
                className="w-full bg-[#6C9D86] hover:bg-[#5B8C75] text-white font-medium py-3.5 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 mt-4 shadow-sm"
              >
                <Check size={20} />
                เข้าใช้งาน
              </button>

            </form>

            {}
            <div className="mt-8 text-center">
              <p className="text-[13px] text-gray-400 leading-relaxed mb-6">
                บันทึกแทนกันได้ ผู้ที่เลือกบ้านเดียวกันจะดูประวัติและรูปของบ้านนั้นได้<br className="hidden md:block" />
                กรุณาตรวจบ้านก่อนบันทึก
              </p>
              
              <div className="flex items-center justify-center gap-6">
                <a href="#" className="text-[#125B41] font-semibold text-sm hover:underline">
                  ดูแดชบอร์ด
                </a>
                <a href="#" className="text-[#125B41] font-semibold text-sm hover:underline">
                  เจ้าหน้าที่
                </a>
              </div>
            </div>

          </div>

        </div>

      </div>
    </>
  );
}