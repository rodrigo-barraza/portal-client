import PageLayoutComponent from "@/components/PageLayoutComponent";
import ExternalApisComponent from "@/components/ExternalApisComponent";

export const metadata = {
  title: "External APIs — Portal",
};

export default function ExternalApisPage() {
  return (
    <PageLayoutComponent>
      <ExternalApisComponent />
    </PageLayoutComponent>
  );
}
