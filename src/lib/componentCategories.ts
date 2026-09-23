/** Presentation of the component categories the catalog generator assigns
 *  (scripts/generate-component-catalog.mjs → CATEGORY_MAP). */
export interface ComponentCategory {
  label: string;
  description: string;
  emoji: string;
}

export const COMPONENT_CATEGORIES = {
  actions: {
    label: "Actions",
    description: "Buttons, FABs, and interactive triggers",
    emoji: "⚡",
  },
  communication: {
    label: "Communication",
    description: "Snackbars, toasts, tooltips, and badges",
    emoji: "💬",
  },
  containment: {
    label: "Containment",
    description: "Cards, dialogs, modals, and containers",
    emoji: "📦",
  },
  inputs: {
    label: "Inputs",
    description: "Text fields, selectors, toggles, and form controls",
    emoji: "✏️",
  },
  navigation: {
    label: "Navigation",
    description: "Sidebars, drawers, rails, tabs, and menus",
    emoji: "🧭",
  },
  indicators: {
    label: "Indicators",
    description: "Progress, loading, and status feedback",
    emoji: "📊",
  },
  layout: {
    label: "Layout",
    description: "Page structure, toolbars, dividers, and tables",
    emoji: "📐",
  },
} as const satisfies Record<string, ComponentCategory>;

export type ComponentCategoryKey = keyof typeof COMPONENT_CATEGORIES;

export const COMPONENT_CATEGORY_KEYS = Object.keys(
  COMPONENT_CATEGORIES,
) as ComponentCategoryKey[];

export function getComponentCategory(
  key: string,
): ComponentCategory | undefined {
  return key in COMPONENT_CATEGORIES
    ? COMPONENT_CATEGORIES[key as ComponentCategoryKey]
    : undefined;
}
