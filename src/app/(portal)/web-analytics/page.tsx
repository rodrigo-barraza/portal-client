import type { Metadata } from "next";
import WebAnalyticsComponent from "@/components/WebAnalyticsComponent";

export const metadata: Metadata = {
  title: "Web Analytics — Portal",
  description:
    "Unified web analytics: Google Analytics (GA4) and first-party session tracking per property.",
};

export default function WebAnalyticsPage() {
  return <WebAnalyticsComponent />;
}
