/**
 * /integrations response shape and the pure filtering behind the page.
 *
 * The service never sends key material: a configured key is reported as
 * `configured: true` plus `fingerprint` — the first 8 hex chars of its
 * SHA-256, enough to tell keys apart or confirm a rotation landed.
 */

export interface IntegrationItem {
  provider: string;
  envKey: string;
  category: string;
  configured: boolean;
  docs?: string;
  fingerprint?: string | null;
}

export interface IntegrationCategory {
  category: string;
  integrations: IntegrationItem[];
  configuredCount: number;
  totalCount: number;
}

export interface IntegrationsData {
  categories: IntegrationCategory[];
  totalCount: number;
  configuredCount: number;
}

export type CategoryStatus = "complete" | "partial" | "none";

export function categoryStatus({ configuredCount, totalCount }: IntegrationCategory): CategoryStatus {
  if (configuredCount === totalCount) return "complete";
  return configuredCount === 0 ? "none" : "partial";
}

/**
 * Keep integrations whose provider, env key or category matches the query
 * (case-insensitive), recount each category, and drop emptied categories.
 */
export function filterCategories(categories: IntegrationCategory[], query: string): IntegrationCategory[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return categories;
  return categories
    .map((category) => {
      const integrations = category.integrations.filter((item) =>
        [item.provider, item.envKey, item.category].some((field) => field.toLowerCase().includes(needle)),
      );
      return {
        ...category,
        integrations,
        configuredCount: integrations.filter((item) => item.configured).length,
        totalCount: integrations.length,
      };
    })
    .filter((category) => category.integrations.length > 0);
}
