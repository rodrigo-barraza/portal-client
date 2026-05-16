import PageLayoutComponent from "@/components/PageLayoutComponent";
import TopologyComponent from "@/components/TopologyComponent";

export const metadata = {
  title: "Topology — Portal",
};

export default function TopologyPage() {
  return (
    <PageLayoutComponent mainStyle={{ padding: 0, display: "flex", flexDirection: "column" }}>
      <TopologyComponent />
    </PageLayoutComponent>
  );
}
