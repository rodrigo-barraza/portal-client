import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import StorageComponent from "@/components/StorageComponent";

export const metadata = {
  title: "Object Store — Portal",
};

export default function ObjectStorePage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <StorageComponent />
      </main>
    </div>
  );
}
