/**
 * Period, date-series and chart-shaping math for the web-analytics pages.
 * Pure — no React, no I/O — so every edge (gaps, DST, zero baselines,
 * malformed dates) is unit-tested in __tests__/analyticsSeries.test.ts.
 *
 * Dates are "YYYY-MM-DD" strings handled as UTC calendar days, so stepping
 * a day is always exactly 24h — no DST drift from local-time arithmetic.
 */

import { formatExact, percentChange } from "./analyticsFormat";
import { CHART_COLORS, SOURCE_COLORS, chartColor } from "./palette";
import type {
  DonutSegment,
  SessionHourCell,
  SessionRange,
} from "../../types/portal";

const DAY_MS = 86_400_000;
/** Refuse to fill more than ~10 years of days — guards against junk dates. */
const MAX_FILLED_DAYS = 3660;

// ── Calendar days ─────────────────────────────────────────────

const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** UTC-midnight epoch ms for a "YYYY-MM-DD" day, or null when malformed. */
export function parseIsoDay(day: string | null | undefined): number | null {
  const match = day ? ISO_DAY_PATTERN.exec(day) : null;
  if (!match) return null;
  const time = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
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
export function parseCustomPeriod(
  period: string,
): { from: string; to: string } | null {
  const match = CUSTOM_PATTERN.exec(period);
  if (
    !match ||
    parseIsoDay(match[1]) === null ||
    parseIsoDay(match[2]) === null
  )
    return null;
  return { from: match[1], to: match[2] };
}

export function isCustomPeriod(period: string): boolean {
  return parseCustomPeriod(period) !== null;
}

/**
 * Turn a DatePicker selection into a custom period, "YYYY-MM-DD_YYYY-MM-DD".
 * The picker can emit datetimes ("2026-09-01T08:30") and ranges in either
 * order; GA (and portal-service's validator) and sessions-service take
 * whole days only, start first. Null when the selection is empty or
 * unusable.
 */
export function toCustomPeriod(from: string, to: string): string | null {
  const fromDay = from.slice(0, 10);
  const toDay = to.slice(0, 10);
  const fromTime = parseIsoDay(fromDay);
  const toTime = parseIsoDay(toDay);
  if (fromTime === null || toTime === null) return null;
  return fromTime <= toTime ? `${fromDay}_${toDay}` : `${toDay}_${fromDay}`;
}

/**
 * The dashboard's period as a sessions-service range: a custom period is
 * its two calendar days (`to` inclusive, read in the request's tz), a
 * preset ("30d", "all") is passed through as a rolling period.
 */
export function toSessionRange(period: string): SessionRange {
  const custom = parseCustomPeriod(period);
  return custom ? { from: custom.from, to: custom.to } : { period };
}

/** "Last 30 days", "2026-09-01 → 2026-09-10", "2026-09-22", "All time". */
export function describePeriod(period: string): string {
  if (period === "all") return "All time";
  const custom = parseCustomPeriod(period);
  if (custom)
    return custom.from === custom.to
      ? custom.from
      : `${custom.from} → ${custom.to}`;
  const days = presetDays(period);
  if (days === 1) return "Last day";
  return days ? `Last ${days} days` : period;
}

export interface DayWindow {
  start: string;
  end: string;
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
 * whose metrics are all zero, so without this a quiet week collapses into
 * its neighbours and the sparkline reads as continuous traffic.
 * (sessions-service zero-fills its own series.)
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

const HOUR_BUCKET_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2})$/;

/** Whether a series point's date is an hour bucket, "YYYY-MM-DDTHH". */
export function isHourBucket(date: unknown): boolean {
  return typeof date === "string" && HOUR_BUCKET_PATTERN.test(date);
}

/** A series bucket for people: "2026-09-22 14:00" for an hour, the day as-is. */
export function formatBucket(bucket: string): string {
  const hour = HOUR_BUCKET_PATTERN.exec(bucket);
  return hour ? `${hour[1]} ${hour[2]}:00` : bucket;
}

/**
 * One-sentence text alternative for a stacked sparkline panel, e.g.
 * "30 days, 2026-08-24 to 2026-09-22. Pageviews: 1,204 total, peak 98 on 2026-09-01."
 * Points dated "YYYY-MM-DDTHH" read as hours.
 */
export function describeSeries(
  series: readonly Record<string, unknown>[],
  metrics: readonly { key: string; label: string }[],
): string {
  if (series.length === 0) return "No data.";
  const dateOf = (point: Record<string, unknown>) =>
    typeof point.date === "string" ? formatBucket(point.date) : null;
  const firstDate = dateOf(series[0]);
  const lastDate = dateOf(series[series.length - 1]);
  const unit = isHourBucket(series[0].date) ? "hour" : "day";
  const span =
    firstDate && lastDate
      ? `${series.length} ${series.length === 1 ? unit : `${unit}s`}, ${firstDate} to ${lastDate}.`
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
        peakDate = dateOf(point);
      }
    }
    const peakText = peakDate
      ? `, peak ${formatExact(peak)} on ${peakDate}`
      : "";
    return `${metric.label}: ${formatExact(total)} total${peakText}.`;
  });

  return [span, ...parts].join(" ");
}

// ── Hour-of-week traffic grid ─────────────────────────────────

/** The grid's rows, Monday-first (ISO week). */
export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** Sunday-first names, indexed like `Date#getDay` and sessions-service's `weekday`. */
const SUNDAY_FIRST = [WEEKDAYS[6], ...WEEKDAYS.slice(0, 6)];

/** One weekday × hour count, whatever the source. */
export interface HourlyCell {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  hour: number;
  value: number;
}

export interface HourlyGrid {
  /** values[dayIndex][hour], Monday-first. */
  values: number[][];
  max: number;
  total: number;
  peak: { day: string; hour: number; value: number } | null;
}

/** GA's (dayOfWeekName × hour) active-user rows; unknown day names are dropped. */
export function gaHourlyCells(
  cells: readonly { day: string; hour: number; users: number }[],
): HourlyCell[] {
  return cells.flatMap((cell) => {
    const weekday = SUNDAY_FIRST.indexOf(cell.day as (typeof WEEKDAYS)[number]);
    return weekday < 0 ? [] : [{ weekday, hour: cell.hour, value: cell.users }];
  });
}

/** sessions-service's sessions-started cells (weekday 0 = Sunday, in the report's tz). */
export function sessionHourlyCells(
  cells: readonly SessionHourCell[],
): HourlyCell[] {
  return cells.map((cell) => ({
    weekday: cell.weekday,
    hour: cell.hour,
    value: cell.sessions,
  }));
}

/**
 * Fold weekday × hour cells into a Monday-first 7×24 matrix. Cells with
 * an out-of-range weekday or hour are dropped.
 */
export function buildHourlyGrid(cells: readonly HourlyCell[]): HourlyGrid {
  const values = WEEKDAYS.map(() => new Array<number>(24).fill(0));
  for (const cell of cells) {
    const weekday = Number(cell.weekday);
    const hour = Number(cell.hour);
    if (
      !Number.isInteger(weekday) ||
      weekday < 0 ||
      weekday > 6 ||
      !Number.isInteger(hour) ||
      hour < 0 ||
      hour > 23
    )
      continue;
    // Sunday (0) is the last row of a Monday-first week
    values[(weekday + 6) % 7][hour] += Number(cell.value) || 0;
  }

  let max = 0;
  let total = 0;
  let peak: HourlyGrid["peak"] = null;
  values.forEach((row, dayIndex) =>
    row.forEach((value, hour) => {
      total += value;
      if (value > max) {
        max = value;
        peak = { day: WEEKDAYS[dayIndex], hour, value };
      }
    }),
  );
  return { values, max, total, peak };
}

// ── Page heatmap ──────────────────────────────────────────────

/** A page heatmap taller than this (height / width) is drawn compressed. */
export const HEATMAP_MAX_ASPECT = 8;
const HEATMAP_MIN_ASPECT = 0.25;

/**
 * The height / width a page heatmap is drawn at: the page's own median
 * aspect, bounded so a very long (or junk) value stays a usable canvas.
 * Square when unknown.
 */
export function heatmapDisplayAspect(
  aspect: number | null | undefined,
): number {
  if (!aspect || !Number.isFinite(aspect) || aspect <= 0) return 1;
  return Math.min(Math.max(aspect, HEATMAP_MIN_ASPECT), HEATMAP_MAX_ASPECT);
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
  new: { label: "New", color: SOURCE_COLORS.ga },
  returning: { label: "Returning", color: SOURCE_COLORS.sessions },
};

/**
 * New vs returning rows as donut segments ("New Users", or "New Visitors"
 * with `noun`). Colored by segment NAME, not position: GA sorts rows by
 * users, so index-based colors swapped "new" and "returning" whenever
 * returning users outnumbered new ones.
 */
export function newVsReturningSegments(
  segments: readonly { segment: string; users: number }[] | null | undefined,
  noun = "Users",
): DonutSegment[] {
  let otherIndex = 0;
  return (segments ?? []).map((segment) => {
    const known = NEW_VS_RETURNING[segment.segment];
    return {
      label: known ? `${known.label} ${noun}` : segment.segment,
      value: segment.users,
      // Skip the two palette entries reserved for new/returning
      color:
        known?.color ?? CHART_COLORS[(2 + otherIndex++) % CHART_COLORS.length],
    };
  });
}

// ── GA overview deltas ────────────────────────────────────────

export type GADeltaMetric =
  | "totalUsers"
  | "pageviews"
  | "sessions"
  | "avgSessionDuration"
  | "engagementRate";

export interface GAOverviewWithPrevious {
  totalUsers: number;
  pageviews: number;
  sessions: number;
  avgSessionDuration: number;
  engagementRate: number;
  /** The comparison window's totals (portal-service sends these). */
  previous?: Partial<Record<GADeltaMetric, number>>;
  deltas?: Partial<Record<GADeltaMetric, number>>;
}

/**
 * Period-over-period change for one GA overview metric, from the raw
 * current/previous totals. portal-service's precomputed `deltas` report
 * a zero previous period as +100% (its `delta()` returns 1), which reads
 * as "doubled" for a brand-new site; from the totals, a zero baseline has
 * no percentage and the badge is hidden. Falls back to `deltas` when the
 * totals are absent.
 */
export function gaOverviewDelta(
  overview: GAOverviewWithPrevious,
  metric: GADeltaMetric,
): number | null {
  if (overview.previous)
    return percentChange(overview[metric], overview.previous[metric]);
  return overview.deltas?.[metric] ?? null;
}
