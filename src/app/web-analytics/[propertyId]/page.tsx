import PageLayoutComponent from "@/components/PageLayoutComponent";
import GoogleAnalyticsComponent from "@/components/GoogleAnalyticsComponent";

export const metadata = {
  title: "Property Analytics — Portal",
  description: "Google Analytics (GA4) detailed reports for a single property.",
};

export default async function WebAnalyticsDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;

  return (
    <PageLayoutComponent>
      <GoogleAnalyticsComponent propertyId={propertyId} />
    </PageLayoutComponent>
  );
}
