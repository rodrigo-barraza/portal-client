import PageLayoutComponent from "@/components/PageLayoutComponent";
import WebAnalyticsComponent from "@/components/WebAnalyticsComponent";

export const metadata = {
  title: "Web Analytics — Portal",
  description:
    "Unified web analytics: Google Analytics (GA4) and first-party session tracking per property.",
};

export default function WebAnalyticsPage() {
  return (
    <PageLayoutComponent>
      <WebAnalyticsComponent />
    </PageLayoutComponent>
  );
}
