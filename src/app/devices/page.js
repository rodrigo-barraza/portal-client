import PageLayoutComponent from "@/components/PageLayoutComponent";
import DevicesComponent from "@/components/DevicesComponent";

export const metadata = {
  title: "Devices — Portal",
};

export default function DevicesPage() {
  return (
    <PageLayoutComponent>
      <DevicesComponent />
    </PageLayoutComponent>
  );
}
