import type { Metadata } from "next";
import LibraryCatalogSectionComponent from "@/components/LibraryCatalogSectionComponent";

export const metadata: Metadata = {
  title: "Utilities — Portal",
};

export default function UtilitiesPage() {
  return <LibraryCatalogSectionComponent type="utility" />;
}
