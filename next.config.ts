/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  experimental: {
    agentUpgrade: "security",
    // ... การตั้งค่าอื่นๆ ที่คุณมีอยู่
  },
  images: {
    unoptimized: true, // แนะนำให้ใส่เพิ่มไว้ด้วย กันปัญหาเรื่องรูปภาพตอนทำ Static Export
  },
};

export default nextConfig;