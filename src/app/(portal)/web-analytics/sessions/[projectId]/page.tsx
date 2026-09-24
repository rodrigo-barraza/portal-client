import type { Metadata } from "next";
import PropertyDashboardComponent from "@/components/PropertyDashboardComponent";
import { decodeRouteParam } from "@/lib/routeParams";

export const metadata: Metadata = {
  title: "Session Analytics — Portal",
  description:
    "First-party analytics: sessions, pages, acquisition, geography, devices, heatmaps and replays.",
};

export default async function SessionAnalyticsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <PropertyDashboardComponent projectId={decodeRouteParam(projectId)} />;
}
