import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import TopologyComponent from "@/components/TopologyComponent";

export const metadata = {
  title: "Topology — Portal",
};

export default function TopologyPage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content" style={{ padding: 0, display: "flex", flexDirection: "column" }}>
        <TopologyComponent />
      </main>
    </div>
  );
}
