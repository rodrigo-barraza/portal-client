import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import LibraryCatalogComponent from "@/components/LibraryCatalogComponent";
import catalog from "@/generated/component-catalog.json";
import { Cog } from "lucide-react";

export const metadata = {
  title: "Services Library — Portal",
};

export const dynamic = "force-dynamic";

export default function ServicesLibraryPage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <LibraryCatalogComponent
          catalog={catalog}
          type="service"
          title="Services"
          subtitle={`${catalog.filter((c) => c.type === "service").length} shared services`}
          icon={<Cog size={18} />}
          accentColor="#a855f7"
          accentSubtle="rgba(168, 85, 247, 0.1)"
        />
      </main>
    </div>
  );
}
