import PageLayoutComponent from "@/components/PageLayoutComponent";
import AnalyticsComponent from "@/components/AnalyticsComponent";

export const metadata = {
  title: "Metrics — Portal",
};

export default function AnalyticsPage() {
  return (
    <PageLayoutComponent>
      <AnalyticsComponent />
    </PageLayoutComponent>
  );
}
