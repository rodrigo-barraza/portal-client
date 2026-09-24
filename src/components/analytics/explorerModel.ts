/**
 * Session explorer model — the pure state, filter, sort and journey logic
 * behind the first-party session explorer (sessions-service /stats/sessions
 * and /stats/sessions/:id, proxied by portal-service). Filtering, sorting
 * and paging all happen server-side; this only shapes what is sent and
 * shown. The response shapes live in `@/types/portal`.
 */

import { countryFlag, countryName } from "./analyticsFormat";
import type {
  SessionEvent,
  SessionFilters,
  SessionSort,
  SessionView,
} from "@/types/portal";

// ── Explorer state ────────────────────────────────────────────

/** What the explorer shows — owned by the report, so its panels can drill in. */
export interface ExplorerState {
  filters: SessionFilters;
  /** Search every session (period=all) instead of the dashboard's range. */
  allTime: boolean;
  /** The session open in the detail view; null shows the list. */
  sessionId: string | null;
}

export const INITIAL_EXPLORER_STATE: ExplorerState = {
  filters: {},
  allTime: false,
  sessionId: null,
};

// ── Filters ───────────────────────────────────────────────────

/** The filters that take a typed value (the rest are on/off toggles). */
export type TextFilterKey =
  "country" | "channel" | "path" | "visitorId" | "userId" | "ip";

export const TEXT_FILTERS: {
  key: TextFilterKey;
  label: string;
  placeholder: string;
}[] = [
  { key: "path", label: "Page", placeholder: "/pricing" },
  { key: "channel", label: "Channel", placeholder: "Organic Search" },
  { key: "country", label: "Country", placeholder: "ISO code, e.g. CA" },
  { key: "visitorId", label: "Visitor", placeholder: "Visitor id" },
  { key: "userId", label: "User", placeholder: "User id" },
  { key: "ip", label: "IP", placeholder: "203.0.113.5" },
];

const TEXT_FILTER_LABELS = Object.fromEntries(
  TEXT_FILTERS.map((filter) => [filter.key, filter.label]),
) as Record<TextFilterKey, string>;

/**
 * `filters` with `key` set to `value`, trimmed — an empty value removes
 * the filter. Country codes are ISO alpha-2, matched exactly, so they are
 * upper-cased.
 */
export function setTextFilter(
  filters: SessionFilters,
  key: TextFilterKey,
  value: string,
): SessionFilters {
  const trimmed = value.trim();
  const next = { ...filters };
  if (!trimmed) delete next[key];
  else next[key] = key === "country" ? trimmed.toUpperCase() : trimmed;
  return next;
}

/** `filters` without `key`. */
export function removeFilter(
  filters: SessionFilters,
  key: keyof SessionFilters,
): SessionFilters {
  const next = { ...filters };
  delete next[key];
  return next;
}

/** One active typed filter, as a removable chip. */
export interface FilterChip {
  key: TextFilterKey;
  label: string;
  /** The value for people ("🇨🇦 Canada" for a country code). */
  display: string;
  value: string;
}

/** The active typed filters, in the order the filter picker lists them. */
export function filterChips(filters: SessionFilters): FilterChip[] {
  return TEXT_FILTERS.flatMap(({ key }) => {
    const value = filters[key];
    if (!value) return [];
    const display =
      key === "country"
        ? [countryFlag(value), `${countryName(value)} (${value})`]
            .filter(Boolean)
            .join(" ")
        : value;
    return [{ key, label: TEXT_FILTER_LABELS[key], display, value }];
  });
}

/** True when any filter narrows the list. */
export function hasFilters(filters: SessionFilters): boolean {
  return (
    filterChips(filters).length > 0 || !!filters.replay || !!filters.engaged
  );
}

/** A stable key for the filters (insertion order must not matter). */
export function filtersKey(filters: SessionFilters): string {
  return JSON.stringify(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined && value !== false)
      .sort(([first], [second]) => first.localeCompare(second)),
  );
}

// ── Sort ──────────────────────────────────────────────────────

export const DEFAULT_SORT: SessionSort = { sort: "startedAt", order: "desc" };

/** Every server-side sort, as the sort picker lists it. */
export const SORT_OPTIONS: { sort: SessionSort; label: string }[] = [
  { sort: { sort: "startedAt", order: "desc" }, label: "Newest first" },
  { sort: { sort: "startedAt", order: "asc" }, label: "Oldest first" },
  { sort: { sort: "lastSeenAt", order: "desc" }, label: "Recently active" },
  {
    sort: { sort: "lastSeenAt", order: "asc" },
    label: "Least recently active",
  },
  { sort: { sort: "engagedMs", order: "desc" }, label: "Most engaged time" },
  { sort: { sort: "engagedMs", order: "asc" }, label: "Least engaged time" },
  { sort: { sort: "pageviews", order: "desc" }, label: "Most pages" },
  { sort: { sort: "pageviews", order: "asc" }, label: "Fewest pages" },
];

/** A sort as one `<select>` value, "engagedMs:desc". */
export function sortValue(sort: SessionSort): string {
  return `${sort.sort}:${sort.order}`;
}

/** The sort a `<select>` value names; the default for anything unknown. */
export function parseSortValue(value: string): SessionSort {
  return (
    SORT_OPTIONS.find((option) => sortValue(option.sort) === value)?.sort ??
    DEFAULT_SORT
  );
}

// ── Journey ───────────────────────────────────────────────────

export type JourneyEntry =
  | {
      kind: "view";
      at: string;
      view: SessionView;
      /** 1-based position among the session's pageviews. */
      step: number;
    }
  | { kind: "event"; at: string; event: SessionEvent };

function timestampOf(value: string): number {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * A session's pageviews in order with its events interleaved by time.
 * Stable: an event stamped the same instant as a pageview comes after it
 * (the event happened on that page), and equal events keep their order.
 */
export function buildJourney(
  views: readonly SessionView[],
  events: readonly SessionEvent[],
): JourneyEntry[] {
  const orderedViews = views
    .map((view, index) => ({ view, index, time: timestampOf(view.at) }))
    .sort(
      (first, second) => first.time - second.time || first.index - second.index,
    );

  const entries: { entry: JourneyEntry; time: number; rank: number }[] = [
    ...orderedViews.map(({ view, time }, index) => ({
      entry: { kind: "view" as const, at: view.at, view, step: index + 1 },
      time,
      rank: 0,
    })),
    ...events.map((event) => ({
      entry: { kind: "event" as const, at: event.at, event },
      time: timestampOf(event.at),
      rank: 1,
    })),
  ];

  return entries
    .map((item, index) => ({ ...item, index }))
    .sort(
      (first, second) =>
        first.time - second.time ||
        first.rank - second.rank ||
        first.index - second.index,
    )
    .map(({ entry }) => entry);
}

/** Stable React key for a journey row. */
export function journeyKey(entry: JourneyEntry, index: number): string {
  return entry.kind === "view"
    ? `view|${entry.view.id}`
    : `event|${entry.at}|${entry.event.name}|${index}`;
}

/** An event's props as "key: value" pairs, nulls and empties dropped. */
export function eventProps(event: SessionEvent): [string, string][] {
  return Object.entries(event.props ?? {}).flatMap(([key, value]) =>
    value === null || value === undefined || value === ""
      ? []
      : [
          [
            key,
            typeof value === "object" ? JSON.stringify(value) : String(value),
          ],
        ],
  );
}
