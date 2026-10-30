import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Event audience",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function AudienceLinkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
