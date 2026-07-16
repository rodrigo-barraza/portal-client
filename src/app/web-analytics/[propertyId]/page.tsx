import PageLayoutComponent from "@/components/PageLayoutComponent";
import PropertyDashboardComponent from "@/components/PropertyDashboardComponent";

export const metadata = {
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

  return (
    <PageLayoutComponent>
      <PropertyDashboardComponent propertyId={propertyId} />
    </PageLayoutComponent>
  );
}
