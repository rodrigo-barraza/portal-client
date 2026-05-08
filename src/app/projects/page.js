import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import ServicesComponent from "@/components/ServicesComponent";

export const metadata = {
  title: "Projects — Portal",
};

export default function ProjectsPage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <ServicesComponent />
      </main>
    </div>
  );
}
