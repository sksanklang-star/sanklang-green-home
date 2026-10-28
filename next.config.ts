import type { NextConfig } from "next";

const isProdBuild = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  ...(isProdBuild ? { output: "export" } : {}),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;