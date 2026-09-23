import type { Metadata } from "next";
import LibraryCatalogSectionComponent from "@/components/LibraryCatalogSectionComponent";

export const metadata: Metadata = {
  title: "Hooks — Portal",
};

export default function HooksPage() {
  return <LibraryCatalogSectionComponent type="hook" />;
}
