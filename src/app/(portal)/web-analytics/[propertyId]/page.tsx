import type { Metadata } from "next";
import PropertyDashboardComponent from "@/components/PropertyDashboardComponent";

export const metadata: Metadata = {
  title: "Property Analytics — Portal",
  description:
    "Unified property analytics: Google Analytics (GA4) reports plus first-party session tracking.",
};

export default async function WebAnalyticsDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  return <PropertyDashboardComponent propertyId={propertyId} />;
}
