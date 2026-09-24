import type { NextConfig } from "next";
const config: NextConfig = { serverExternalPackages: ["firebase-admin", "exceljs", "sharp"], images: { remotePatterns: [{ protocol: "https", hostname: "images.lumacdn.com" }] } };
export default config;
