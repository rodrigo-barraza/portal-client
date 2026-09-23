import type { Metadata } from "next";
import SettingsComponent from "@/components/SettingsComponent";

export const metadata: Metadata = {
  title: "Settings — Portal",
};

export default function SettingsPage() {
  return <SettingsComponent />;
}
