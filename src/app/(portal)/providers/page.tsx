import type { Metadata } from "next";
import LibraryCatalogSectionComponent from "@/components/LibraryCatalogSectionComponent";

export const metadata: Metadata = {
  title: "Providers — Portal",
};

export default function ProvidersPage() {
  return <LibraryCatalogSectionComponent type="provider" />;
}
