import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import ComponentsComponent from "@/components/ComponentsComponent";
import catalog from "@/generated/component-catalog.json";

export const metadata = {
  title: "Components — Portal",
};

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
