import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import AnalyticsComponent from "@/components/AnalyticsComponent";

export const metadata = {
  title: "Analytics — Portal",
};

export default function AnalyticsPage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <AnalyticsComponent />
      </main>
    </div>
  );
}
