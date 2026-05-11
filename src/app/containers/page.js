import PageLayoutComponent from "@/components/PageLayoutComponent";
import ContainerStatsComponent from "@/components/ContainerStatsComponent";

export const metadata = {
  title: "Containers — Portal",
};

export default function ContainersPage() {
  return (
    <PageLayoutComponent>
      <ContainerStatsComponent />
    </PageLayoutComponent>
  );
}
