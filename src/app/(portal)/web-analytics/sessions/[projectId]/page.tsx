import type { Metadata } from "next";
import PropertyDashboardComponent from "@/components/PropertyDashboardComponent";
import { decodeRouteParam } from "@/lib/routeParams";

export const metadata: Metadata = {
  title: "Session Analytics — Portal",
  description:
    "First-party visitor analytics: sessions, IPs, geolocation, device fingerprints, and interaction events.",
};

export default async function SessionAnalyticsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <PropertyDashboardComponent projectId={decodeRouteParam(projectId)} />;
}
