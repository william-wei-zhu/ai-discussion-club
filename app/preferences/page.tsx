import type { Metadata } from "next";
import { PreferencesClient } from "./preferences-client";

export const metadata: Metadata = { title: "Your profile and preferences", robots: { index: false, follow: false } };

export default function PreferencesPage() {
  return <div className="wrap page-content settings-page"><div className="page-heading"><h1>Your profile.<br />Your choice.</h1><p>Request a private link to fix your photo and LinkedIn, and to manage club email and event directory preferences. No account is needed.</p></div><PreferencesClient /></div>;
}
