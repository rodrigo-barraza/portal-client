import type { Metadata } from "next";
import IntegrationsComponent from "@/components/IntegrationsComponent";

export const metadata: Metadata = {
  title: "Integrations — Portal",
};

export default function IntegrationsPage() {
  return <IntegrationsComponent />;
}
