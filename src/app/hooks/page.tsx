import PageLayoutComponent from "@/components/PageLayoutComponent";
import LibraryCatalogComponent from "@/components/LibraryCatalogComponent";
import catalog from "@/generated/component-catalog.json";
import { Anchor } from "lucide-react";

export const metadata = {
  title: "Hooks — Portal",
};

export const dynamic = "force-dynamic";

export default function HooksPage() {
  return (
    <PageLayoutComponent>
      <LibraryCatalogComponent
        catalog={catalog}
        type="hook"
        title="Hooks"
        subtitle={`${catalog.filter((c) => c.type === "hook").length} custom React hooks`}
        icon={<Anchor size={18} />}
        accentColor="var(--component-category-indicators)"
      />
    </PageLayoutComponent>
  );
}
