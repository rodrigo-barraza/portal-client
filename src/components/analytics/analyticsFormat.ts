/**
 * Formatting helpers for the web-analytics pages. Pure — no React, no I/O.
 *
 * Units: both sources send rates as 0–1 ratios, but durations differ —
 * sessions-service sends MILLISECONDS, GA4 sends SECONDS. Scroll depth
 * (sessions-service) is already a 0–100 percentage.
 */

import {
  formatDateTime,
  formatElapsedTime,
  formatPercent,
  pluralize,
} from "@rodrigo-barraza/utilities-library";

/** GA reports an unknown city as "(not set)". */
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

/**
 * The flag emoji of an ISO 3166-1 alpha-2 code ("CA" → 🇨🇦): two regional
 * indicator symbols. "" for anything that is not a two-letter code.
 */
export function countryFlag(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map(
      (letter) => 0x1f1e6 + letter.charCodeAt(0) - 65,
    ),
  );
}

const REGION_NAMES = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

/** English name of an ISO country code ("CA" → "Canada"); the code when unknown. */
export function countryName(code: string | null | undefined): string {
  if (!code) return "";
  const upper = code.toUpperCase();
  try {
    const name = REGION_NAMES?.of(upper);
    return name && name !== "Unknown Region" ? name : upper;
  } catch {
    return upper;
  }
}

/** A session's place, "Vancouver, Canada", from its ISO country code. */
export function formatSessionLocation(
  location: { city?: string | null; country?: string | null } | null,
  fallback = "—",
): string {
  return formatLocation(
    location && {
      city: location.city,
      country: location.country ? countryName(location.country) : null,
    },
    fallback,
  );
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

/** A 0–1 ratio (GA4 or sessions-service) as a percentage; "—" when missing. */
export function formatRatioPercent(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  return formatPercent(ratio * 100);
}

/** A scroll depth (already 0–100) as a whole percentage; "—" when missing. */
export function formatScrollDepth(
  percentage: number | null | undefined,
): string {
  if (percentage == null || !Number.isFinite(percentage)) return "—";
  return `${Math.round(Math.min(Math.max(percentage, 0), 100))}%`;
}

/** One decimal place ("2.4"); "—" when missing. */
export function formatDecimal(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
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
 * An error's message when it is real text, else null. A failure body
 * that carried no text (a bare `{ error: true }`) must never surface as
 * the literal "true" — callers show generic wording instead.
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
