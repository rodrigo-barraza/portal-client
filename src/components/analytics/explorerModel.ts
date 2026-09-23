/**
 * Session explorer data model — the shapes sessions-service returns for
 * its explorer endpoints (/stats/ips, /visitors, /sessions, /ip/:ip,
 * /session/:id; proxied by portal-service), plus the pure search and
 * timeline logic the explorer runs on them.
 *
 * Nullable where the service can send null: a visitorId, a geo lookup, a
 * parsed browser/OS/device can each be missing on real sessions.
 */

export interface NamedVersion {
  name: string | null;
  version: string | null;
}

export interface DeviceInfo {
  type: string | null;
  vendor: string | null;
}

export interface GeoInfo {
  country: string | null;
  city: string | null;
  countryCode: string | null;
}

export interface Viewport {
  width: number;
  height: number;
}

/** GET /stats/ips row — sessions grouped by IP (a "pseudo-user"). */
export interface IpUser {
  ip: string;
  visitorIds: string[];
  /** Newest 30 only; `sessionCount` is the real total. */
  sessionIds: string[];
  sessionCount: number;
  /** Milliseconds. */
  totalDuration: number;
  firstSeen: string;
  lastSeen: string;
  projects: string[];
  lastBrowser: NamedVersion | null;
  lastOs: NamedVersion | null;
  lastDevice: DeviceInfo | null;
  lastGeo: GeoInfo | null;
  lastFingerprintId: string | null;
  lastReferrer: string | null;
  lastViewport: Viewport | null;
}

/** GET /stats/visitors row — sessions grouped by client visitorId. */
export interface Visitor {
  visitorId: string;
  sessionCount: number;
  /** Milliseconds. */
  totalDuration: number;
  firstSeen: string;
  lastSeen: string;
  lastIp: string | null;
  lastBrowser: NamedVersion | null;
  lastOs: NamedVersion | null;
  lastDevice: DeviceInfo | null;
  lastGeo: GeoInfo | null;
  lastReferrer: string | null;
  lastViewport: Viewport | null;
  /** Newest 20 only; `sessionCount` is the real total. */
  sessionIds: string[];
}

/** GET /stats/sessions row (also the `sessions` of an IP detail). */
export interface ExplorerSession {
  sessionId: string;
  visitorId: string | null;
  projectId: string | null;
  /** Logged-in identity linked by the tracker (portal/prism/reels/music). */
  userId?: string | null;
  /** Crawler traffic — kept in explorer lists so it can be inspected. */
  isBot?: boolean;
  ip: string;
  fingerprintId: string | null;
  browser: NamedVersion | null;
  os: NamedVersion | null;
  device: DeviceInfo | null;
  geo: GeoInfo | null;
  viewport: Viewport | null;
  referrer: string | null;
  /** Milliseconds. */
  duration: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageViewRecord {
  sessionId?: string;
  url: string;
  path: string;
  title: string | null;
  timestamp: string;
}

export interface EventRecord {
  sessionId?: string;
  category: string;
  action: string;
  label: string | null;
  value?: unknown;
  timestamp: string;
}

export interface TimelineEntry {
  type: "pageview" | "event";
  timestamp: string;
  sessionId?: string;
  path?: string;
  title?: string | null;
  url?: string;
  category?: string;
  action?: string;
  label?: string | null;
}

/** GET /stats/session/:id */
export interface SessionDetail extends ExplorerSession {
  userAgent: string | null;
  locale: string | null;
  utm: Record<string, string> | null;
  pageViews: PageViewRecord[];
  events: EventRecord[];
  timeline: TimelineEntry[];
  /** True when an rrweb recording exists (play-button gate). */
  hasReplay?: boolean;
}

/**
 * GET /stats/ip/:ip — at most the newest 100 sessions. Unlike the /ips
 * listing it sends no lastFingerprintId/lastReferrer/lastViewport, and its
 * merged `timeline` drops each entry's sessionId (see buildTimeline).
 */
export interface IpDetail {
  ip: string;
  visitorIds: string[];
  projects: string[];
  sessionCount: number;
  totalDuration: number;
  firstSeen: string | null;
  lastSeen: string | null;
  lastBrowser: NamedVersion | null;
  lastOs: NamedVersion | null;
  lastDevice: DeviceInfo | null;
  lastGeo: GeoInfo | null;
  lastLocale?: string | null;
  sessions: ExplorerSession[];
  pageViews: PageViewRecord[];
  events: EventRecord[];
  timeline: TimelineEntry[];
}

export interface IpUsersPage {
  ips: IpUser[];
  total: number;
}

export interface VisitorsPage {
  visitors: Visitor[];
  total: number;
}

export interface SessionsPage {
  sessions: ExplorerSession[];
  total: number;
}

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

/** Stable React key for a timeline row. */
export function timelineKey(entry: TimelineEntry, index: number): string {
  return `${entry.timestamp}|${entry.type}|${entry.sessionId ?? ""}|${index}`;
}
