import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import ComponentsComponent from "@/components/ComponentsComponent";
import catalog from "@/generated/component-catalog.json";

export const metadata = {
  title: "Components — Portal",
};

// Render at request time — the client component renders live previews
// from the component library which cannot be statically prerendered.
export const dynamic = "force-dynamic";

export default function ComponentsPage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <ComponentsComponent catalog={catalog} />
      </main>
    </div>
  );
}
