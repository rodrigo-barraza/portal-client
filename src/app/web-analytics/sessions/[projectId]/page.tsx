import type { Metadata } from "next";
import SessionAnalyticsPage from "./SessionAnalyticsPage";

export const metadata: Metadata = {
  title: "Session Analytics — Portal",
  description:
    "First-party visitor analytics: sessions, IPs, geolocation, device fingerprints, and interaction events.",
};

export default function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return <SessionAnalyticsPage params={params} />;
}
