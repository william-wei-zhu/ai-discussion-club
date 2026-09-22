import type { Metadata } from "next";
import { EventsClient } from "@/components/events-client";

export const metadata: Metadata = {
  title: "Event admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <EventsClient />
    </div>
  );
}
