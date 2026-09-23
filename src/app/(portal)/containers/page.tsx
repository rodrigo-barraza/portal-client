import type { Metadata } from "next";
import ContainerStatsComponent from "@/components/ContainerStatsComponent";

export const metadata: Metadata = {
  title: "Containers — Portal",
};

export default function ContainersPage() {
  return <ContainerStatsComponent />;
}
