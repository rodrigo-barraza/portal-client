import PageLayoutComponent from "@/components/PageLayoutComponent";
import CloudUsageComponent from "@/components/CloudUsageComponent";

export const metadata = {
  title: "Cloud Usage — Portal",
};

export default function CloudUsagePage() {
  return (
    <PageLayoutComponent>
      <CloudUsageComponent />
    </PageLayoutComponent>
  );
}
