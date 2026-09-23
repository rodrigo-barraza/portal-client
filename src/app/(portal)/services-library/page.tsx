import type { Metadata } from "next";
import LibraryCatalogSectionComponent from "@/components/LibraryCatalogSectionComponent";

export const metadata: Metadata = {
  title: "Services Library — Portal",
};

export default function ServicesLibraryPage() {
  return <LibraryCatalogSectionComponent type="service" />;
}
