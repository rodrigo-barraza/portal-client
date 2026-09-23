import { Anchor, Cog, Plug, Wrench, type LucideIcon } from "lucide-react";
import LibraryCatalogComponent, {
  type CatalogNoun,
} from "./LibraryCatalogComponent";
import {
  catalogEntriesOfType,
  type CatalogEntryType,
} from "@/lib/libraryCatalog";

type LibrarySection = Exclude<CatalogEntryType, "component">;

interface SectionConfig {
  title: string;
  noun: CatalogNoun;
  /** Subtitle after the count, e.g. "12 custom React hooks". */
  description: string;
  icon: LucideIcon;
  accentColor: string;
}

const SECTIONS: Record<LibrarySection, SectionConfig> = {
  hook: {
    title: "Hooks",
    noun: { singular: "hook", plural: "hooks" },
    description: "custom React hooks",
    icon: Anchor,
    accentColor: "var(--component-category-indicators)",
  },
  provider: {
    title: "Providers",
    noun: { singular: "provider", plural: "providers" },
    description: "context providers",
    icon: Plug,
    accentColor: "var(--component-category-actions)",
  },
  service: {
    title: "Services",
    noun: { singular: "service", plural: "services" },
    description: "shared services",
    icon: Cog,
    accentColor: "var(--component-category-containment)",
  },
  utility: {
    title: "Utilities",
    noun: { singular: "utility", plural: "utilities" },
    description: "shared utility modules",
    icon: Wrench,
    accentColor: "var(--component-category-inputs)",
  },
};

/**
 * Server-side shell of the Hooks/Providers/Services/Utilities pages: picks
 * the section's entries out of the generated catalog, so only those are
 * serialized to the client catalog component.
 */
export default function LibraryCatalogSectionComponent({
  type,
}: {
  type: LibrarySection;
}) {
  const { title, noun, description, icon: Icon, accentColor } = SECTIONS[type];
  const items = catalogEntriesOfType(type);

  return (
    <LibraryCatalogComponent
      items={items}
      noun={noun}
      title={title}
      subtitle={`${items.length} ${description}`}
      icon={<Icon size={18} />}
      accentColor={accentColor}
    />
  );
}
