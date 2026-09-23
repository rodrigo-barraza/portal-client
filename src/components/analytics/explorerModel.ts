/**
 * Session explorer model — the pure search and timeline logic the explorer
 * runs on sessions-service's explorer responses (/stats/ips, /visitors,
 * /sessions, /ip/:ip, /session/:id; proxied by portal-service). The
 * response shapes themselves live in `@/types/portal`.
 */

import type {
  DeviceInfo,
  EventRecord,
  ExplorerSession,
  GeoInfo,
  IpDetail,
  IpUser,
  NamedVersion,
  PageViewRecord,
  TimelineEntry,
  Visitor,
} from "@/types/portal";


// ── Search ────────────────────────────────────────────────────

type SearchField = string | null | undefined;

function matchesQuery(fields: SearchField[], normalizedQuery: string): boolean {
  return fields.some((field) => !!field && field.toLowerCase().includes(normalizedQuery));
}

function filterByQuery<T>(
  items: readonly T[],
  query: string,
  fields: (item: T) => SearchField[],
): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [...items];
  return items.filter((item) => matchesQuery(fields(item), normalizedQuery));
}

function clientFields(
  browser: NamedVersion | null | undefined,
  os: NamedVersion | null | undefined,
  device: DeviceInfo | null | undefined,
  geo: GeoInfo | null | undefined,
): SearchField[] {
  return [
    browser?.name,
    browser?.version,
    os?.name,
    os?.version,
    device?.type,
    device?.vendor,
    geo?.country,
    geo?.city,
  ];
}

export function filterIpUsers(items: readonly IpUser[], query: string): IpUser[] {
  return filterByQuery(items, query, (item) => [
    item.ip,
    ...(item.visitorIds ?? []),
    ...clientFields(item.lastBrowser, item.lastOs, item.lastDevice, item.lastGeo),
  ]);
}

export function filterVisitors(items: readonly Visitor[], query: string): Visitor[] {
  return filterByQuery(items, query, (item) => [
    item.visitorId,
    item.lastIp,
    ...clientFields(item.lastBrowser, item.lastOs, item.lastDevice, item.lastGeo),
  ]);
}

export function filterSessions(items: readonly ExplorerSession[], query: string): ExplorerSession[] {
  return filterByQuery(items, query, (item) => [
    item.sessionId,
    item.visitorId,
    item.userId,
    item.ip,
    ...clientFields(item.browser, item.os, item.device, item.geo),
  ]);
}

// ── Timeline ──────────────────────────────────────────────────

function timestampOf(value: string): number {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Merge page views and events into one chronological timeline, keeping
 * each entry's sessionId. sessions-service's own merged `timeline` drops
 * sessionId, so on an IP's cross-session timeline every row would lose
 * its session tag. Stable: equal timestamps keep page views first.
 */
export function buildTimeline(
  pageViews: readonly PageViewRecord[],
  events: readonly EventRecord[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...pageViews.map(
      (pageView): TimelineEntry => ({
        type: "pageview",
        timestamp: pageView.timestamp,
        sessionId: pageView.sessionId,
        path: pageView.path,
        title: pageView.title,
        url: pageView.url,
      }),
    ),
    ...events.map(
      (event): TimelineEntry => ({
        type: "event",
        timestamp: event.timestamp,
        sessionId: event.sessionId,
        category: event.category,
        action: event.action,
        label: event.label,
      }),
    ),
  ];
  return entries
    .map((entry, index) => ({ entry, index, time: timestampOf(entry.timestamp) }))
    .sort((first, second) => first.time - second.time || first.index - second.index)
    .map(({ entry }) => entry);
}

/** The IP's cross-session timeline — rebuilt so entries keep their sessionId. */
export function ipTimeline(detail: IpDetail): TimelineEntry[] {
  if (detail.pageViews?.length || detail.events?.length) {
    return buildTimeline(detail.pageViews ?? [], detail.events ?? []);
  }
  return detail.timeline ?? [];
}

/** The most recent fingerprint seen on this IP (the detail endpoint omits it). */
export function ipFingerprint(detail: IpDetail): string | null {
  return detail.sessions?.find((session) => session.fingerprintId)?.fingerprintId ?? null;
}

/**
 * The IP's latest activity. sessions-service reports the newest-CREATED
 * session's updatedAt, which misses an older session (a long-lived tab)
 * that was active more recently; take the max over the sessions instead.
 */
export function ipLastSeen(detail: IpDetail): string | null {
  let latest: string | null = detail.lastSeen ?? null;
  let latestTime = latest ? timestampOf(latest) : 0;
  for (const session of detail.sessions ?? []) {
    const time = timestampOf(session.updatedAt);
    if (time > latestTime) {
      latest = session.updatedAt;
      latestTime = time;
    }
  }
  return latest;
}

/** Stable React key for a timeline row. */
export function timelineKey(entry: TimelineEntry, index: number): string {
  return `${entry.timestamp}|${entry.type}|${entry.sessionId ?? ""}|${index}`;
}
