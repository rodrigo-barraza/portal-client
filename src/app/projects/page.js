import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import ProjectsComponent from "@/components/ProjectsComponent";

export const metadata = {
  title: "Projects — Portal",
};

export default function ProjectsPage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <ProjectsComponent />
      </main>
    </div>
  );
}
