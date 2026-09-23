import type { PortalSettings } from "@/lib/settings";

/**
 * Usage severity shared by every container metric in the portal — table
 * cells, cards, drawers and the Logs statistics panel all colour CPU and
 * memory the same way. The warn floor is fixed; the alert ceiling is the
 * user's threshold from Settings → Monitoring.
 */

export type Severity = "success" | "warning" | "danger";

/** Usage above this is "warning" (below the user's alert threshold). */
export const CPU_WARN_PERCENT = 40;
export const MEMORY_WARN_PERCENT = 60;

/** [warnAt, alertAt] — usage strictly above each bound escalates. */
export type SeverityBounds = readonly [warnAt: number, alertAt: number];

export interface SeverityThresholds {
  cpu: SeverityBounds;
  memory: SeverityBounds;
}

export function thresholdsFromSettings(
  settings: Pick<PortalSettings, "alertThresholdCpu" | "alertThresholdMemory">,
): SeverityThresholds {
  return {
    cpu: [CPU_WARN_PERCENT, settings.alertThresholdCpu],
    memory: [MEMORY_WARN_PERCENT, settings.alertThresholdMemory],
  };
}

export function severityOf(
  percent: number,
  [warnAt, alertAt]: SeverityBounds,
): Severity {
  if (percent > alertAt) return "danger";
  if (percent > warnAt) return "warning";
  return "success";
}

/** Theme colour token for a usage percentage. */
export function severityColor(percent: number, bounds: SeverityBounds): string {
  return `var(--color-${severityOf(percent, bounds)})`;
}
