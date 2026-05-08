import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import GoogleAnalyticsComponent from "@/components/GoogleAnalyticsComponent";

export const metadata = {
  title: "Web Analytics — Portal",
  description: "Google Analytics (GA4) reports and real-time visitor data.",
};

export default function WebAnalyticsPage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <GoogleAnalyticsComponent />
      </main>
    </div>
  );
}
