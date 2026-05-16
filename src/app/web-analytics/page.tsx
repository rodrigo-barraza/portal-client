import PageLayoutComponent from "@/components/PageLayoutComponent";
import GoogleAnalyticsComponent from "@/components/GoogleAnalyticsComponent";

export const metadata = {
  title: "Web Analytics — Portal",
  description: "Google Analytics (GA4) reports and real-time visitor data.",
};

export default function WebAnalyticsPage() {
  return (
    <PageLayoutComponent>
      <GoogleAnalyticsComponent />
    </PageLayoutComponent>
  );
}
