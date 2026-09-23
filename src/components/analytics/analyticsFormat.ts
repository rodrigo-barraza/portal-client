/**
 * Formatting helpers for the web-analytics pages. Pure — no React, no I/O.
 *
 * Unit conventions the two sources disagree on:
 *   - durations: sessions-service sends MILLISECONDS, GA4 sends SECONDS
 *   - rates: sessions-service sends 0–100 percentages, GA4 sends 0–1 ratios
 */

import {
  formatDateTime,
  formatElapsedTime,
  formatPercent,
  pluralize,
} from "@rodrigo-barraza/utilities-library";

/** GA and sessions-service both report unknown cities as "(not set)". */
export const NOT_SET = "(not set)";

export interface LocationLike {
  city?: string | null;
  country?: string | null;
}

/** "City, Country" — drops an unknown city; `fallback` when nothing is known. */
export function formatLocation(
  location: LocationLike | null | undefined,
  fallback = "—",
): string {
  const country = location?.country || null;
  const city =
    location?.city && location.city !== NOT_SET ? location.city : null;
  if (city && country) return `${city}, ${country}`;
  return country || city || fallback;
}

/** A sessions-service duration (milliseconds) as "4m 12s". */
export function formatDurationMs(
  milliseconds: number | null | undefined,
): string {
  return formatElapsedTime(milliseconds == null ? null : milliseconds / 1000);
}

/**
 * An event timestamp as "Sep 22, 14:05:09" (year added outside the current
 * year). `hourCycle: "h23"`, not `hour12: false`: the latter renders
 * midnight as "24:05:09" in Chromium.
 */
export function formatTimestamp(
  value: string | Date | null | undefined,
): string {
  return formatDateTime(value, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

/**
 * An exact, grouped integer: "1,204". The shared formatCompact abbreviates
 * ("1.5K" for 1,499) — fine for a stat card, wrong for a count a user
 * reads as exact.
 */
export function formatExact(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString("en-US");
}

/** "1 session" / "1,204 sessions". */
export function formatCount(
  count: number,
  singular: string,
  plural?: string,
): string {
  return `${formatExact(count)} ${pluralize(singular, count, plural)}`;
}

/** First `length` characters of an id, with an ellipsis only when truncated. */
export function shortId(id: string | null | undefined, length: number): string {
  if (!id) return "—";
  return id.length > length ? `${id.slice(0, length)}…` : id;
}

/** A GA4 ratio (0–1) as a percentage; "—" when missing. */
export function formatRatioPercent(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  return formatPercent(ratio * 100);
}

/** A sessions-service percentage (already 0–100); "—" when missing. */
export function formatWholePercent(
  percentage: number | null | undefined,
): string {
  if (percentage == null || !Number.isFinite(percentage)) return "—";
  return `${percentage}%`;
}

/**
 * Relative change from `baseline` to `value` as a ratio (0.25 = +25%).
 * Null when the baseline is zero or missing — a change from nothing has no
 * meaningful percentage, and Infinity/NaN must never reach a badge.
 */
export function percentChange(
  value: number | null | undefined,
  baseline: number | null | undefined,
): number | null {
  if (value == null || baseline == null) return null;
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0)
    return null;
  return (value - baseline) / Math.abs(baseline);
}

/**
 * An error's message when it is real text, else null. The shared API
 * client throws `new Error(body.error || body.message)`, and a proxied
 * sessions-service failure body is `{ error: true, message }` — so the
 * thrown message can be the literal "true". Callers show generic wording
 * instead of that.
 */
export function readableErrorMessage(
  error: Error | null | undefined,
): string | null {
  const message = error?.message?.trim();
  if (!message || message === "true" || message === "false") return null;
  return message;
}

/** Join the non-empty parts with a middle dot: "Rod Dev · G-XXXX". */
export function joinMeta(
  ...parts: (string | null | undefined | false)[]
): string {
  return parts.filter(Boolean).join(" · ");
}
