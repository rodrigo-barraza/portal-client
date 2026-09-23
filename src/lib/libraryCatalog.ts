/**
 * The components-library catalog generated at prebuild
 * (scripts/generate-component-catalog.mjs → src/generated/component-catalog.json),
 * typed, plus the naming/search helpers the catalog pages share.
 */
import catalogJson from "@/generated/component-catalog.json";

export type CatalogEntryType =
  "component" | "provider" | "hook" | "service" | "utility";

/** One library export, as written by the catalog generator. */
export interface CatalogEntry {
  name: string;
  type: CatalogEntryType;
  /** Component category (actions, inputs, …) or the type's plural. */
  category: string;
  /** References Material Design 3 in its source. */
  m3: boolean;
  hasTests: boolean;
  files: number;
  sizeKb: number;
  description: string;
}

const LIBRARY_CATALOG = catalogJson as CatalogEntry[];

/** Catalog entries of one type, in name order. */
export function catalogEntriesOfType(type: CatalogEntryType): CatalogEntry[] {
  return LIBRARY_CATALOG.filter((entry) => entry.type === type);
}

/**
 * Human-readable name from an export name: drops the Component/Service
 * suffix and spaces camel case. A zero-width space after a hook's "use"
 * lets long hook names wrap there without showing a gap.
 */
export function humanizeExportName(name: string): string {
  return name
    .replace(/Component$/, "")
    .replace(/Service$/, "")
    .replace(/^use(?=[A-Z])/, "use​")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** Case-insensitive match of a search query against name, description and
 *  the humanized name. An empty query matches everything. */
export function matchesCatalogQuery(
  entry: CatalogEntry,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    entry.name,
    entry.description,
    humanizeExportName(entry.name).replace(/​/g, ""),
  ].some((text) => text.toLowerCase().includes(needle));
}

/** Total size and tested count of a set of entries (for header pills). */
export function summarizeCatalog(entries: readonly CatalogEntry[]): {
  totalSizeKb: number;
  testedCount: number;
  m3Count: number;
} {
  let totalSizeKb = 0;
  let testedCount = 0;
  let m3Count = 0;
  for (const entry of entries) {
    totalSizeKb += entry.sizeKb;
    if (entry.hasTests) testedCount++;
    if (entry.m3) m3Count++;
  }
  return { totalSizeKb, testedCount, m3Count };
}
