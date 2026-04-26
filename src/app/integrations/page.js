import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import IntegrationsComponent from "@/components/IntegrationsComponent";

export const metadata = {
  title: "Integrations — Portal",
};

export default function IntegrationsPage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <IntegrationsComponent />
      </main>
    </div>
  );
}
