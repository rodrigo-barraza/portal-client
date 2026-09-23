/**
 * Web-analytics chart palette — categorical data colors shared by the GA4
 * and first-party reports (and ExternalApis, via AnalyticsPrimitives).
 * These are data-viz series colors, not UI chrome, so they stay fixed
 * across themes; chrome colors come from theme variables in the CSS.
 */

export const CHART_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#f97316",
];

export const SPARKLINE_COLORS = {
  pageviews: "#6366f1",
  users: "#10b981",
  sessions: "#f59e0b",
};

/** Source accents — GA4 (indigo) vs first-party sessions (green). */
export const SOURCE_COLORS = {
  ga: "#6366f1",
  sessions: "#10b981",
};

/** The palette color for series `index`, starting `offset` entries in. */
export function chartColor(index: number, offset = 0): string {
  return CHART_COLORS[(index + offset) % CHART_COLORS.length];
}
