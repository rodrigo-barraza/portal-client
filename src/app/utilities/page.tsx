import PageLayoutComponent from "@/components/PageLayoutComponent";
import LibraryCatalogComponent from "@/components/LibraryCatalogComponent";
import catalog from "@/generated/component-catalog.json";
import { Wrench } from "lucide-react";

export const metadata = {
  title: "Utilities — Portal",
};

export const dynamic = "force-dynamic";

export default function UtilitiesPage() {
  return (
    <PageLayoutComponent>
      <LibraryCatalogComponent
        catalog={catalog}
        type="utility"
        title="Utilities"
        subtitle={`${catalog.filter((c) => c.type === "utility").length} shared utility modules`}
        icon={<Wrench size={18} />}
        accentColor="#10b981"
        accentSubtle="rgba(16, 185, 129, 0.1)"
      />
    </PageLayoutComponent>
  );
}
