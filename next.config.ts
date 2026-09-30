import type { NextConfig } from "next";
import { WORKSHOPS } from "./lib/workshops";

// Renamed workshops keep their old links working (query such as ?step=N is carried over).
const workshopRedirects = WORKSHOPS.flatMap(w => (w.previousSlugs ?? []).map(old => ({ source: `/workshops/${old}`, destination: `/workshops/${w.slug}`, permanent: true })));

const config: NextConfig = { serverExternalPackages: ["firebase-admin", "exceljs", "sharp"], images: { remotePatterns: [{ protocol: "https", hostname: "images.lumacdn.com" }] }, async redirects() { return workshopRedirects; } };
export default config;
