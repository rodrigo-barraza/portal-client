import type { Metadata } from "next";
import TopologyComponent from "@/components/TopologyComponent";

export const metadata: Metadata = {
  title: "Topology — Portal",
};

export default function TopologyPage() {
  return <TopologyComponent />;
}
