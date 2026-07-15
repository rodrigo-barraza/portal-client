import PageLayoutComponent from "@/components/PageLayoutComponent";
import LibraryCatalogComponent from "@/components/LibraryCatalogComponent";
import catalog from "@/generated/component-catalog.json";
import { Cog } from "lucide-react";

export const metadata = {
  title: "Services Library — Portal",
};

export const dynamic = "force-dynamic";

export default function ServicesLibraryPage() {
  return (
    <PageLayoutComponent>
      <LibraryCatalogComponent
        catalog={catalog}
        type="service"
        title="Services"
        subtitle={`${catalog.filter((c) => c.type === "service").length} shared services`}
        icon={<Cog size={18} />}
        accentColor="var(--component-category-containment)"
      />
    </PageLayoutComponent>
  );
}
