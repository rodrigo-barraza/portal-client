/**
 * The pure filtering behind the Integrations page, over the /integrations
 * response (shapes in `@/types/portal`).
 */

import type { IntegrationCategory } from "@/types/portal";


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
