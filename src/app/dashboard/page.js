import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import DashboardComponent from "@/components/DashboardComponent";

export const metadata = {
  title: "Dashboard — Portal",
};

export default function DashboardPage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <DashboardComponent />
      </main>
    </div>
  );
}
