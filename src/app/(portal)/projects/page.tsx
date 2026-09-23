import type { Metadata } from "next";
import ProjectsComponent from "@/components/ProjectsComponent";

export const metadata: Metadata = {
  title: "Projects — Portal",
};

export default function ProjectsPage() {
  return <ProjectsComponent />;
}
