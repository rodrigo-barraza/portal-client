import PageLayoutComponent from "@/components/PageLayoutComponent";
import ProjectsComponent from "@/components/ProjectsComponent";

export const metadata = {
  title: "Projects — Portal",
};

export default function ProjectsPage() {
  return (
    <PageLayoutComponent>
      <ProjectsComponent />
    </PageLayoutComponent>
  );
}
