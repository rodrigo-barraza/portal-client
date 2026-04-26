import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import DevicesComponent from "@/components/DevicesComponent";

export const metadata = {
  title: "Devices — Portal",
};

export default function DevicesPage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <DevicesComponent />
      </main>
    </div>
  );
}
