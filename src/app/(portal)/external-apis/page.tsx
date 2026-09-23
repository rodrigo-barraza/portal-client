import type { Metadata } from "next";
import ExternalApisComponent from "@/components/ExternalApisComponent";

export const metadata: Metadata = {
  title: "External APIs — Portal",
};

export default function ExternalApisPage() {
  return <ExternalApisComponent />;
}
