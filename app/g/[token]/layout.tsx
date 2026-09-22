import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Private event directory",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function DirectoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
