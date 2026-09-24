import type { Metadata } from "next";
import { DemoForm } from "./demo-form";

export const metadata: Metadata = {
  title: "Demo your project",
  description: "Apply to show your AI project at an upcoming AI Discussion Club builder demo night in Washington, DC.",
};

export default function DemoPage() {
  return <div className="wrap page-content settings-page"><div className="page-heading"><h1>Demo your project.</h1><p>We host builder demo nights where people show what they are making with AI. Tell us about your project and we will reach out if it is a fit for an upcoming event.</p></div><DemoForm /></div>;
}
