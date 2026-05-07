import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import StorageComponent from "@/components/StorageComponent";

export const metadata = {
  title: "Storage — Portal",
};

export default function StoragePage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <StorageComponent />
      </main>
    </div>
  );
}
