import PageLayoutComponent from "@/components/PageLayoutComponent";
import StorageComponent from "@/components/StorageComponent";

export const metadata = {
  title: "Object Store — Portal",
};

export default function ObjectStorePage() {
  return (
    <PageLayoutComponent>
      <StorageComponent />
    </PageLayoutComponent>
  );
}
