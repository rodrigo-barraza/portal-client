import PageLayoutComponent from "@/components/PageLayoutComponent";
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
    <PageLayoutComponent>
      <ComponentsComponent catalog={catalog} />
    </PageLayoutComponent>
  );
}
