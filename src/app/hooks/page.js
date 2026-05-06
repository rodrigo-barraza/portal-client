import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import LibraryCatalogComponent from "@/components/LibraryCatalogComponent";
import catalog from "@/generated/component-catalog.json";
import { Anchor } from "lucide-react";

export const metadata = {
  title: "Hooks — Portal",
};

export const dynamic = "force-dynamic";

export default function HooksPage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <LibraryCatalogComponent
          catalog={catalog}
          type="hook"
          title="Hooks"
          subtitle={`${catalog.filter((c) => c.type === "hook").length} custom React hooks`}
          icon={<Anchor size={18} />}
          accentColor="#06b6d4"
          accentSubtle="rgba(6, 182, 212, 0.1)"
        />
      </main>
    </div>
  );
}
