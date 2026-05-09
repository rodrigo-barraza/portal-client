import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import ContainerStatsComponent from "@/components/ContainerStatsComponent";

export const metadata = {
  title: "Containers — Portal",
};

export default function ContainersPage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <ContainerStatsComponent />
      </main>
    </div>
  );
}
