import PageLayoutComponent from "@/components/PageLayoutComponent";
import LibraryCatalogComponent from "@/components/LibraryCatalogComponent";
import catalog from "@/generated/component-catalog.json";
import { Plug } from "lucide-react";

export const metadata = {
  title: "Providers — Portal",
};

export const dynamic = "force-dynamic";

export default function ProvidersPage() {
  return (
    <PageLayoutComponent>
      <LibraryCatalogComponent
        catalog={catalog}
        type="provider"
        title="Providers"
        subtitle={`${catalog.filter((c) => c.type === "provider").length} context providers`}
        icon={<Plug size={18} />}
        accentColor="#f97316"
        accentSubtle="rgba(249, 115, 22, 0.1)"
      />
    </PageLayoutComponent>
  );
}
