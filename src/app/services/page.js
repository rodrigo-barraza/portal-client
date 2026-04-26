import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import ServicesComponent from "@/components/ServicesComponent";

export const metadata = {
  title: "Services — Portal",
};

export default function ServicesPage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <ServicesComponent />
      </main>
    </div>
  );
}
