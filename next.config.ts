import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "cheerio",
    "puppeteer-extra",
    "puppeteer-extra-plugin-stealth",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
