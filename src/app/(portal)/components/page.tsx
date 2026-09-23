import type { Metadata } from "next";
import ComponentsComponent from "@/components/ComponentsComponent";
import { catalogEntriesOfType } from "@/lib/libraryCatalog";

export const metadata: Metadata = {
  title: "Components — Portal",
};

// Render at request time — the live previews render library components
// that cannot all be statically prerendered.
export const dynamic = "force-dynamic";

export default function ComponentsPage() {
  return <ComponentsComponent components={catalogEntriesOfType("component")} />;
}
