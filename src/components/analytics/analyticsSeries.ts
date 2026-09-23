/**
 * Period, date-series and chart-shaping math for the web-analytics pages.
 * Pure — no React, no I/O — so every edge (gaps, DST, zero baselines,
 * malformed dates) is unit-tested in __tests__/analyticsSeries.test.ts.
 *
 * Dates are "YYYY-MM-DD" strings handled as UTC calendar days, so stepping
 * a day is always exactly 24h — no DST drift from local-time arithmetic.
 */

import { formatExact } from "./analyticsFormat";
import { CHART_COLORS, SOURCE_COLORS, chartColor } from "./palette";
import type { DonutSegment } from "../../types/portal";

const DAY_MS = 86_400_000;
/** Refuse to fill more than ~10 years of days — guards against junk dates. */
const MAX_FILLED_DAYS = 3660;

// ── Calendar days ─────────────────────────────────────────────

const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** UTC-midnight epoch ms for a "YYYY-MM-DD" day, or null when malformed. */
export function parseIsoDay(day: string | null | undefined): number | null {
  const match = day ? ISO_DAY_PATTERN.exec(day) : null;
  if (!match) return null;
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  // Reject rollovers like 2026-02-31 → 2026-03-03
  return formatIsoDay(time) === day ? time : null;
}

/** The UTC calendar day of an epoch-ms instant. */
export function formatIsoDay(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/** `day` shifted by `offset` whole days. */
export function shiftIsoDay(day: string, offset: number): string {
  const time = parseIsoDay(day);
  if (time === null) throw new RangeError(`Invalid day: ${day}`);
  return formatIsoDay(time + offset * DAY_MS);
}

// ── Periods ───────────────────────────────────────────────────

export const PRESET_PERIODS = ["7d", "30d", "90d"] as const;

const PRESET_PATTERN = /^(\d+)d$/;
const CUSTOM_PATTERN = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/;

/** Days in a preset period ("7d" → 7); null for custom ranges and junk. */
export function presetDays(period: string): number | null {
  const match = PRESET_PATTERN.exec(period);
  const days = match ? Number(match[1]) : 0;
  return days > 0 ? days : null;
}

/** The {from, to} of a custom "YYYY-MM-DD_YYYY-MM-DD" period, else null. */
export function parseCustomPeriod(period: string): { from: string; to: string } | null {
  const match = CUSTOM_PATTERN.exec(period);
  if (!match || parseIsoDay(match[1]) === null || parseIsoDay(match[2]) === null) return null;
  return { from: match[1], to: match[2] };
}

export function isCustomPeriod(period: string): boolean {
  return parseCustomPeriod(period) !== null;
}

/**
 * Turn a DatePicker selection into GA's custom period, "YYYY-MM-DD_YYYY-MM-DD".
 * The picker can emit datetimes ("2026-09-01T08:30") and ranges in either
 * order; GA (and portal-service's validator) accept whole days only, start
 * first. Null when the selection is empty or unusable.
 */
export function toCustomPeriod(from: string, to: string): string | null {
  const fromDay = from.slice(0, 10);
  const toDay = to.slice(0, 10);
  const fromTime = parseIsoDay(fromDay);
  const toTime = parseIsoDay(toDay);
  if (fromTime === null || toTime === null) return null;
  return fromTime <= toTime ? `${fromDay}_${toDay}` : `${toDay}_${fromDay}`;
}

export interface DayWindow {
  start: string;
  end: string;
}

/**
 * The calendar days a sessions-service series can span. Its "Nd" window is
 * a rolling N×24h ending now, bucketed by UTC day (`$dateToString` on UTC
 * dates) — so the first and last buckets are partial days.
 */
export function sessionsSeriesWindow(period: string, now: number = Date.now()): DayWindow | null {
  const days = presetDays(period);
  if (days === null) return null;
  return { start: formatIsoDay(now - days * DAY_MS), end: formatIsoDay(now) };
}

/**
 * The calendar days a GA series spans. Only custom ranges are exact: a GA
 * preset is `NdaysAgo → today` in the PROPERTY's timezone, which the client
 * does not know — extending to the browser's "today" could invent a
 * trailing zero day, so presets are gap-filled between their own points.
 */
export function gaSeriesWindow(period: string): DayWindow | null {
  const custom = parseCustomPeriod(period);
  return custom ? { start: custom.from, end: custom.to } : null;
}

// ── Daily series ──────────────────────────────────────────────

/**
 * Insert zero points for days missing from a daily series. GA omits rows
 * whose metrics are all zero and sessions-service only groups days that
 * have documents, so without this a quiet week collapses into its
 * neighbours and the sparkline reads as continuous traffic.
 *
 * Fills every day between the first and last point, widened to `window`
 * when given. A series with any undated/malformed point is returned as-is.
 */
export function fillDailySeries<T extends { date?: string }>(
  points: readonly T[],
  emptyPoint: (date: string) => T,
  window?: DayWindow | null,
): T[] {
  if (points.length === 0 && !window) return [...points];

  const byDay = new Map<number, T>();
  for (const point of points) {
    const time = parseIsoDay(point.date);
    if (time === null) return [...points];
    byDay.set(time, point);
  }

  const times = [...byDay.keys()];
  const windowStart = window ? parseIsoDay(window.start) : null;
  const windowEnd = window ? parseIsoDay(window.end) : null;
  if (windowStart !== null) times.push(windowStart);
  if (windowEnd !== null) times.push(windowEnd);
  if (times.length === 0) return [...points];

  const first = Math.min(...times);
  const last = Math.max(...times);
  if ((last - first) / DAY_MS > MAX_FILLED_DAYS) return [...points];

  const filled: T[] = [];
  for (let time = first; time <= last; time += DAY_MS) {
    filled.push(byDay.get(time) ?? emptyPoint(formatIsoDay(time)));
  }
  return filled;
}

/**
 * One-sentence text alternative for a stacked sparkline panel, e.g.
 * "30 days, 2026-08-24 to 2026-09-22. Pageviews: 1,204 total, peak 98 on 2026-09-01."
 */
export function describeSeries(
  series: readonly Record<string, unknown>[],
  metrics: readonly { key: string; label: string }[],
): string {
  if (series.length === 0) return "No data.";
  const firstDate = typeof series[0].date === "string" ? series[0].date : null;
  const lastDate =
    typeof series[series.length - 1].date === "string"
      ? (series[series.length - 1].date as string)
      : null;
  const span =
    firstDate && lastDate
      ? `${series.length} days, ${firstDate} to ${lastDate}.`
      : `${series.length} points.`;

  const parts = metrics.map((metric) => {
    let total = 0;
    let peak = -Infinity;
    let peakDate: string | null = null;
    for (const point of series) {
      const value = Number(point[metric.key]) || 0;
      total += value;
      if (value > peak) {
        peak = value;
        peakDate = typeof point.date === "string" ? point.date : null;
      }
    }
    const peakText = peakDate ? `, peak ${formatExact(peak)} on ${peakDate}` : "";
    return `${metric.label}: ${formatExact(total)} total${peakText}.`;
  });

  return [span, ...parts].join(" ");
}

// ── GA hourly traffic grid ────────────────────────────────────

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export interface HourlyGrid {
  /** values[dayIndex][hour], Monday-first. */
  values: number[][];
  max: number;
  total: number;
  peak: { day: string; hour: number; users: number } | null;
}

/**
 * Fold GA's (dayOfWeekName × hour) rows into a Monday-first 7×24 matrix.
 * Rows for an unknown day or an out-of-range hour are dropped.
 */
export function buildHourlyGrid(
  cells: readonly { day: string; hour: number; users: number }[],
): HourlyGrid {
  const values = WEEKDAYS.map(() => new Array<number>(24).fill(0));
  for (const cell of cells) {
    const dayIndex = WEEKDAYS.indexOf(cell.day as (typeof WEEKDAYS)[number]);
    const hour = Number(cell.hour);
    if (dayIndex < 0 || !Number.isInteger(hour) || hour < 0 || hour > 23) continue;
    values[dayIndex][hour] += Number(cell.users) || 0;
  }

  let max = 0;
  let total = 0;
  let peak: HourlyGrid["peak"] = null;
  values.forEach((row, dayIndex) =>
    row.forEach((users, hour) => {
      total += users;
      if (users > max) {
        max = users;
        peak = { day: WEEKDAYS[dayIndex], hour, users };
      }
    }),
  );
  return { values, max, total, peak };
}

// ── Donut segments ────────────────────────────────────────────

/** Map rows to donut segments, colored from the palette starting at `colorOffset`. */
export function toDonutSegments<T>(
  rows: readonly T[] | null | undefined,
  label: (row: T) => string,
  value: (row: T) => number,
  colorOffset = 0,
): DonutSegment[] {
  return (rows ?? []).map((row, index) => ({
    label: label(row),
    value: value(row),
    color: chartColor(index, colorOffset),
  }));
}

const NEW_VS_RETURNING: Record<string, { label: string; color: string }> = {
  new: { label: "New Users", color: SOURCE_COLORS.ga },
  returning: { label: "Returning Users", color: SOURCE_COLORS.sessions },
};

/**
 * GA's newVsReturning rows as donut segments. Colored by segment NAME, not
 * position: GA sorts rows by users, so index-based colors swapped "new"
 * and "returning" whenever returning users outnumbered new ones.
 */
export function newVsReturningSegments(
  segments: readonly { segment: string; users: number }[] | null | undefined,
): DonutSegment[] {
  let otherIndex = 0;
  return (segments ?? []).map((segment) => {
    const known = NEW_VS_RETURNING[segment.segment];
    return {
      label: known?.label ?? segment.segment,
      value: segment.users,
      // Skip the two palette entries reserved for new/returning
      color: known?.color ?? CHART_COLORS[(2 + otherIndex++) % CHART_COLORS.length],
    };
  });
}
