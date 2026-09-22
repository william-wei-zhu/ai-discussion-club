import type { Metadata } from "next";
import { PreferencesClient } from "./preferences-client";

export const metadata: Metadata = { title: "Email and directory preferences", robots: { index: false, follow: false } };

export default function PreferencesPage() {
  return <div className="wrap page-content settings-page"><div className="page-heading"><h1>Your inbox.<br />Your choice.</h1><p>Request a private link to manage club email and event directory preferences. No account is needed.</p></div><PreferencesClient /></div>;
}
