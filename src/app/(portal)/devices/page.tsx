import type { Metadata } from "next";
import DevicesComponent from "@/components/DevicesComponent";

export const metadata: Metadata = {
  title: "Devices — Portal",
};

export default function DevicesPage() {
  return <DevicesComponent />;
}
