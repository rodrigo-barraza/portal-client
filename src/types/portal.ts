// ============================================================
// Portal Client — Domain Type Definitions
// ============================================================
// Central domain types for the portal dashboard infrastructure.
// These model the backend API responses (portal-service) and
// component-local state shapes used across the UI.
// ============================================================

// ─── Project Type Taxonomy ──────────────────────────────────

/** Canonical project type classification from the vault-service registry. */
export type ProjectType =
  | "Service"
  | "Client"
  | "Bot"
  | "Database"
  | "Store"
  | "Library"
  | "Kit"
  | "Tool"
  | "Inference";

/** Deploy tier from the vault-service registry (0=Foundation, 1=Services, 2=Bots). */
export type DeployTier = 0 | 1 | 2;

// ─── Color Tokens ───────────────────────────────────────────

/** Service type color configuration — mirrors vault-service projectTypeColors. */
export interface ServiceTypeColor {
  color: string;
  subtle: string;
}

/** Deploy tier color configuration — mirrors vault-service deployTierColors. */
export interface DeployTierColor {
  color: string;
  subtle: string;
  stroke: string;
  fill: string;
}

// ─── Service / Project Registry ─────────────────────────────

/** Dependency reference — can be a plain string ID or a structured reference. */
export interface DependencyRef {
  id: string;
  name: string;
  criticality?: "required" | "optional";
  /** Edge provenance: "registry" (hand-declared), "derived" (computed from
   *  db/minioBucket registry fields), or "detected" (found by code analysis). */
  source?: "detected" | "registry" | "derived";
}

export type DependsOnEntry = string | DependencyRef;

/**
 * A service or infrastructure entry from portal-service `GET /services`
 * (registry fields + the latest probe + watchdog state). One shape for
 * both lists: fields only one kind carries are optional, and nullable
 * wherever the service sends null for "not set".
 */
export interface PortalService {
  id: string;
  name: string;
  description?: string | null;
  healthy: boolean;
  projectType?: ProjectType | string | null;
  deployTier?: DeployTier | number | null;
  device?: string;
  url?: string;
  domain?: string | null;
  port?: number | null;
  visibility?: "external" | "internal" | (string & {});
  environment?: string;
  responseTimeMs?: number | null;
  /** Why the last health check failed (null when healthy). */
  error?: string | null;
  repo?: string | null;
  dockerProject?: string | null;
  restartable?: boolean;
  /** null until the first health check completes, and for infrastructure
   *  that has no health probe. */
  checkedAt?: string | null;
  /** Watchdog state (portal-service /watchdog): pending | up | down. */
  watchdogStatus?: "pending" | "up" | "down";
  /** Last push heartbeat received (dead-man's-switch services only). */
  lastHeartbeatAt?: string | null;
  /** Start of the current unhealthy stretch, if any. */
  downSince?: string | null;
  isInfrastructure?: boolean;
  essential?: boolean;
  db?: string | null;
  /** MinIO bucket(s) the project owns (services only). */
  minioBucket?: string | string[] | null;
  npmPackage?: string | null;
  /** Registry infrastructure type, e.g. "mongodb" (infrastructure only). */
  type?: string;
  dependsOn?: DependsOnEntry[];
  /** Inverse of `dependsOn`: who depends on this entry. */
  dependedOnBy?: DependencyRef[];
  /** The health endpoint's own JSON body — arbitrary per service. */
  metadata?: Record<string, unknown> | null;
  /** GA4 property id when the project is tracked in Google Analytics (services only). */
  analyticsPropertyId?: string | null;
}

// ─── Container Stats ────────────────────────────────────────

export interface CpuStats {
  percent: number;
  cores: number;
}

export interface CpuThrottling {
  periods: number;
  throttledPeriods: number;
  throttledTimeNs: number;
}

export interface MemoryStats {
  used: number;
  limit: number;
  percent: number;
}

export interface MemoryDetail {
  rss: number;
  cache: number;
  swap: number;
  maxUsage: number;
  pgfault: number;
  pgmajfault: number;
}

export interface NetworkStats {
  rx: number;
  tx: number;
  rxPackets?: number;
  txPackets?: number;
  rxDropped?: number;
  txDropped?: number;
  rxErrors?: number;
  txErrors?: number;
  interfaces?: Record<string, NetworkInterface>;
}

export interface NetworkInterface {
  rxBytes: number;
  txBytes: number;
}

export interface BlockIOStats {
  read: number;
  write: number;
}

export interface PortMapping {
  ip?: string;
  publicPort?: number;
  privatePort: number;
  type: string;
}

export interface VolumeMount {
  type: string;
  name?: string;
  source?: string;
  destination: string;
  rw: boolean;
}

/** Full Docker container stats (attached as _stats on container rows). */
export interface ContainerStats {
  cpu: CpuStats;
  cpuThrottling?: CpuThrottling;
  memory: MemoryStats;
  memoryDetail?: MemoryDetail;
  network?: NetworkStats;
  blockIO?: BlockIOStats;
  pids?: number;
  image?: string;
  state?: string;
  status?: string;
  created?: number;
  command?: string;
  ports?: PortMapping[];
  mounts?: VolumeMount[];
  labels?: Record<string, string>;
}

/**
 * One container as `GET /stats/containers` reports it from the Docker
 * Engine. A stopped container carries zeroed stats.
 */
export interface DockerContainerStats {
  /** Short (12-char) container id. */
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  /** Unix seconds. */
  created: number;
  command: string;
  ports: PortMapping[];
  mounts: VolumeMount[];
  labels: Record<string, string>;
  /** Device id of the Docker host. */
  device: string;
  cpu: CpuStats;
  cpuThrottling: CpuThrottling;
  memory: MemoryStats;
  memoryDetail: MemoryDetail;
  network: NetworkStats;
  blockIO: BlockIOStats;
  pids: number;
}

/** GET /stats/containers */
export interface ContainerStatsResponse {
  containers: DockerContainerStats[];
  fetchedAt: string;
}

/** One container's sample in the in-memory ring buffer. */
export interface ContainerSnapshotSample {
  cpu: number;
  memoryUsed: number;
  memoryLimit: number;
  memoryPercent: number;
  blockRead: number;
  blockWrite: number;
  netRx: number;
  netTx: number;
  pids: number;
}

/** One ring-buffer tick (every 5 s): every container on the device. */
export interface ContainerSnapshot {
  timestamp: string;
  containers: Record<string, ContainerSnapshotSample>;
}

/** GET /stats/containers/history — ring buffer keyed by device id. */
export interface ContainerStatsHistoryResponse {
  history: Record<string, ContainerSnapshot[]>;
  samples: number;
}

/** Health status shown for a container row. `unknown` means the service is
 * registered but its first health check hasn't completed yet. */
export type ContainerStatusKind = "healthy" | "down" | "unknown";

/** A merged container row — project registry data + Docker stats. */
export interface ContainerRow {
  /** Unique per Docker host + container name (names repeat across devices). */
  id: string;
  /** Registry project id when the container belongs to a registered service. */
  serviceId: string | null;
  containerName: string;
  healthy: boolean;
  statusKind: ContainerStatusKind;
  registered: boolean;
  visibility: string | null;
  port: number | null;
  url: string | null;
  domain: string | null;
  responseTimeMs: number | null;
  device: string | null;
  restartable: boolean;
  dockerProject: string;
  projectType: "client" | "service" | "bot";
  _stats: ContainerStats | null;
}

/** Per-container sparkline history for CPU and memory. */
export interface ContainerHistory {
  cpu: number[];
  mem: number[];
}

// ─── System Info ────────────────────────────────────────────

export interface DiskCategory {
  totalSize: number;
  count: number;
}

export interface DiskImage {
  /** Short (12-char) image id. */
  id: string;
  tags: string[];
  size: number;
  sharedSize: number;
  /** Unix seconds. */
  created: number;
  containers: number;
}

export interface DiskVolume {
  name: string;
  driver: string;
  size: number;
  refCount: number;
}

export interface DiskContainersCategory {
  totalWritableSize: number;
  count: number;
}

export interface DiskUsage {
  /** The 20 largest images. */
  images: DiskCategory & { sharedSize: number; items: DiskImage[] };
  volumes: DiskCategory & { items: DiskVolume[] };
  buildCache: DiskCategory;
  containers: DiskContainersCategory;
  totalReclaimable: number;
}

/** `df` of the host root — only for a local (unix-socket) Docker host. */
export interface HostDiskStats {
  total: number;
  used: number;
  available: number;
  percent: number;
}

/** One Docker host's `/info` + `/system/df`, as `GET /stats/system?device=` returns it. */
export interface SystemInfo {
  deviceId: string;
  serverVersion: string;
  os: string;
  architecture: string;
  totalMemory: number;
  cpus: number;
  containersRunning: number;
  containersStopped: number;
  containersPaused: number;
  containersTotal: number;
  hostDisk: HostDiskStats | null;
  disk: DiskUsage;
  fetchedAt: string;
}

/** One entry of `GET /stats/system` without a device (every host that answered). */
export interface DeviceSystemInfo extends SystemInfo {
  deviceName: string;
}

/** `GET /stats/system`: one host's object with `?device=`, else every host's. */
export type SystemInfoResponse = SystemInfo | DeviceSystemInfo[];

// ─── Storage / Object Store ─────────────────────────────────

export interface StorageBucket {
  name: string;
  creationDate: string | null;
  /** null while stats are still being collected for this bucket */
  objectCount: number | null;
  totalSize: number | null;
}

/** One object in a bucket listing. */
export interface StorageObject {
  name: string;
  size: number;
  lastModified: string | null;
  etag: string | null;
}

/** GET /object-store/buckets/:name — objects and sub-folders at a prefix. */
export interface StorageObjectListing {
  bucket: string;
  prefix: string;
  objects: StorageObject[];
  /** Virtual folders ("a/b/"), sorted. */
  prefixes: string[];
}

/** GET /object-store/buckets/:name/stat/* — one object's full metadata. */
export interface StorageObjectStat {
  bucket: string;
  /** The object key. */
  object: string;
  size: number;
  contentType: string;
  etag: string;
  lastModified: string | null;
  /** MinIO user/system metadata headers. */
  metadata: Record<string, string>;
}

/** DELETE /object-store/buckets/:name/* */
export interface StorageDeleteResponse {
  success: true;
  bucket: string;
  object: string;
}

/** GET /stats/storage — every bucket's usage (its counts are never null here). */
export interface StorageSummary {
  buckets: StorageBucket[];
  totalObjects: number;
  totalSize: number;
  fetchedAt: string;
}

/**
 * GET /object-store/buckets/stream, one SSE frame at a time: `init` names
 * every bucket up front (stats null), each `bucket` fills one in, and the
 * stream ends with `done` — or `error` (a server frame or a lost connection).
 */
export type BucketStreamEvent =
  | { type: "init"; totalBuckets: number; buckets: StorageBucket[] }
  | { type: "bucket"; bucket: StorageBucket }
  | { type: "done" }
  | { type: "error"; message: string };

export interface StorageSearchResult extends StorageObject {
  bucket: string;
}

/** GET /object-store/search */
export interface StorageSearchResponse {
  results: StorageSearchResult[];
  totalScanned: number;
  truncated: boolean;
}

// ─── Project Analysis (Topology) ────────────────────────────

/** An internal package import found by code analysis. */
export interface DetectedImport {
  target: string;
  /** The npm package name the import resolved through. */
  package: string;
}

/** An HTTP call to another service found by code analysis. */
export interface DetectedApiCall {
  target: string;
  /** The env var holding the target's base URL. */
  envVar: string;
}

export interface ProjectDependencies {
  imports: DetectedImport[];
  apiCalls: DetectedApiCall[];
}

export interface GitHubAnalysisHealth {
  tokenConfigured: boolean;
  status: "ok" | "degraded" | "unavailable";
  stats: {
    requests: number;
    failures: number;
    unauthorized: number;
    rateLimited: number;
    notFound: number;
  };
}

/** GET /services/analysis */
export interface ProjectAnalysis {
  dependencies: Record<string, ProjectDependencies>;
  repoSizes: Record<string, RepoSize>;
  /** Project id → GitHub owner. */
  owners: Record<string, string>;
  analyzedAt: string;
  /** Health of the GitHub-backed code analysis — lets the UI distinguish
   *  "no detected edges" from "detection was unavailable". */
  github: GitHubAnalysisHealth;
}

export interface RepoSize {
  sizeKB: number;
  sizeBytes: number;
}

/** GET /services/sizes — projects whose repository size GitHub answered. */
export interface RepoSizesResponse {
  sizes: Record<string, RepoSize>;
  fetchedAt: string;
}

/** A repository's GitHub Linguist breakdown, largest language first. */
export interface LanguageBreakdown {
  /** null for a repository with no detected code. */
  primary: string | null;
  breakdown: { language: string; bytes: number; percent: number }[];
  totalBytes: number;
}

/** GET /services/languages */
export interface LanguagesResponse {
  languages: Record<string, LanguageBreakdown>;
  fetchedAt: string;
}

/** Response shape from the /services API endpoint. */
export interface ServicesResponse {
  services: PortalService[];
  infrastructure: PortalService[];
}

/** POST /services/:id/{start,stop,restart,rollback} */
export interface ServiceActionResponse {
  success: true;
  /** The project's display name. */
  service: string;
  device: string;
  message: string;
}

/** POST /containers/:name/{start,stop,restart}?device= */
export interface ContainerActionResponse {
  success: true;
  container: string;
  device: string;
  message: string;
}

/** The `:previous` image a rollback would restore. */
export interface PreviousImageInfo {
  tag: string;
  created: string | null;
  size: number;
  gitSha: string | null;
  gitBranch: string | null;
  buildTime: string | null;
}

/**
 * GET /services/:id/rollback-status (and each value of the keyed batch at
 * /services/rollback-status). `reason` says why when `available` is false;
 * service/device/previousImage come with `available: true`.
 */
export interface ServiceRollbackStatus {
  available: boolean;
  reason?: string;
  service?: string;
  device?: string;
  previousImage?: PreviousImageInfo;
}

// ─── Topology ───────────────────────────────────────────────

export type EdgeType = "api" | "import" | "tooling" | "infra";

export interface TopologyEdge {
  source: string;
  target: string;
  criticality: "required" | "optional" | string;
  type: EdgeType;
}

export interface NodePosition {
  x: number;
  y: number;
}

// ─── Google Analytics ───────────────────────────────────────

export interface GAProperty {
  id: string;
  label: string;
  measurementId: string;
  /** Registry project id (e.g. "rod-dev-client") — joins a GA property to its sessions-service projectId. */
  serviceId: string;
  domain: string | null;
}

/** GET /google-analytics/properties */
export interface GAPropertiesResponse {
  properties: GAProperty[];
}

/** GET /google-analytics/:id/realtime — active users now, top 10 screens. */
export interface GARealtimeReport {
  activeUsers: number;
  topPages: { pagePath: string; activeUsers: number }[];
  fetchedAt: string;
}

/** Every period report carries the period it covers and when GA answered. */
export interface GAReportMeta {
  period: string;
  fetchedAt: string;
}

/** One date range's overview totals. Rates and durations are fractional (0–1, seconds). */
export interface GAOverviewTotals {
  sessions: number;
  pageviews: number;
  activeUsers: number;
  totalUsers: number;
  newUsers: number;
  bounceRate: number;
  avgSessionDuration: number;
  engagedSessions: number;
  engagementRate: number;
}

/** GET /google-analytics/:id/overview — the period, the one before it, and the change. */
export interface GAOverview extends GAOverviewTotals, GAReportMeta {
  previous: GAOverviewTotals;
  /** Relative change vs `previous` (a zero previous period reads as 1). */
  deltas: {
    sessions: number;
    pageviews: number;
    totalUsers: number;
    avgSessionDuration: number;
    engagementRate: number;
  };
}

export interface GAPageRow {
  pagePath: string;
  /** Top pages group by path AND title, so a path can repeat. */
  pageTitle: string;
  pageviews: number;
  users: number;
  avgDuration: number;
  bounceRate: number;
}

export interface GALandingPageRow {
  landingPage: string;
  sessions: number;
  users: number;
  avgDuration: number;
  bounceRate: number;
  engagedSessions: number;
}

export interface GASource {
  source: string;
  medium: string;
  sessions: number;
  users: number;
  engagementRate: number;
}

export interface GALocation {
  country: string;
  /** "" when GA has no city for the row. */
  city: string;
  users: number;
  sessions: number;
}

export interface GADeviceCategory {
  category: string;
  users: number;
  sessions: number;
}

export interface GABrowser {
  browser: string;
  users: number;
  sessions: number;
}

export interface GAOperatingSystem {
  os: string;
  users: number;
  sessions: number;
}

export interface GAScreenResolution {
  resolution: string;
  sessions: number;
}

/** GET /google-analytics/:id/devices */
export interface GADevices extends GAReportMeta {
  categories: GADeviceCategory[];
  browsers: GABrowser[];
  operatingSystems: GAOperatingSystem[];
  screenResolutions: GAScreenResolution[];
}

export interface GAChannel {
  channel: string;
  sessions: number;
  totalUsers: number;
  newUsers: number;
  engagementRate: number;
}

export interface GAHeatmapCell {
  day: string;
  hour: number;
  users: number;
}

export interface GANewVsReturningSegment {
  segment: "new" | "returning" | (string & {});
  users: number;
  sessions: number;
  engagementRate: number;
}

export interface GAEvent {
  eventName: string;
  eventCount: number;
  users: number;
}

export interface GATimeSeriesPoint {
  /** YYYY-MM-DD */
  date: string;
  pageviews: number;
  users: number;
  sessions: number;
}

/** The body of each GET /google-analytics/:id/<report>?period=, by report. */
export interface GAReportsByName {
  overview: GAOverview;
  pages: GAReportMeta & { pages: GAPageRow[] };
  sources: GAReportMeta & { sources: GASource[] };
  geography: GAReportMeta & { locations: GALocation[] };
  devices: GADevices;
  timeseries: GAReportMeta & { series: GATimeSeriesPoint[] };
  channels: GAReportMeta & { channels: GAChannel[] };
  "landing-pages": GAReportMeta & { pages: GALandingPageRow[] };
  heatmap: GAReportMeta & { cells: GAHeatmapCell[] };
  "new-vs-returning": GAReportMeta & { segments: GANewVsReturningSegment[] };
  events: GAReportMeta & { events: GAEvent[] };
}

// ─── Chart / Visualization ──────────────────────────────────

export interface DonutSegment {
  value: number;
  color: string;
  label: string;
  objectCount?: number;
}

// ─── Device ─────────────────────────────────────────────────

/** A registered service hosted on a device (GET /devices). */
export interface DeviceHostedService {
  id: string;
  name: string;
  url: string;
  port: number | null;
  environment: string;
  visibility: string;
  dockerProject: string | null;
  deployTier: number | null;
  healthy: boolean;
  responseTimeMs: number | null;
  error: string | null;
  checkedAt: string | null;
}

/** An infrastructure entry hosted on a device (GET /devices). */
export interface DeviceHostedInfrastructure {
  id: string;
  name: string;
  type: string;
  projectType: string | null;
  url: string;
  port: number | null;
  environment: string;
  visibility: string;
  healthy: boolean;
  responseTimeMs: number | null;
  metadata: Record<string, unknown> | null;
  error: string | null;
  checkedAt: string | null;
  isInfrastructure: true;
}

/**
 * A physical device from GET /devices. The registry fields are "" when
 * unset; `specs` is null for a device without a reachable Docker API.
 */
export interface Device {
  id: string;
  name: string;
  hostname: string;
  os: string;
  type: string;
  notes: string;
  specs: DeviceSpecs | null;
  services: DeviceHostedService[];
  infrastructure: DeviceHostedInfrastructure[];
  /** Hosted services + infrastructure. */
  serviceCount: number;
  healthyCount: number;
}

/** GET /devices */
export interface DevicesResponse {
  devices: Device[];
}

/** Live hardware specs collected server-side from the device's Docker Engine. */
export interface DeviceSpecs {
  cpus: number;
  memoryBytes: number;
  os: string;
  architecture: string;
  dockerVersion: string;
  collectedAt: string;
}

// ─── Container Metrics (persistent MongoDB time series) ─────

/** One persisted sample; `t` is an ISO timestamp. */
export interface ContainerMetricsPoint {
  t: string;
  cpu: number;
  mem: number;
  memLimit: number;
  netRx: number;
  netTx: number;
  pids: number;
}

/** One container's series on one device. */
export interface ContainerMetricsSeries {
  container: string;
  device: string;
  points: ContainerMetricsPoint[];
}

/** GET /stats/containers/metrics — series keyed `<device>/<container>`
 *  (container names repeat across devices). */
export interface ContainerMetricsResponse {
  containers: Record<string, ContainerMetricsSeries>;
  range: string;
  since?: string;
  samples: number;
}

// ─── Breadcrumb ─────────────────────────────────────────────

export interface BreadcrumbSegment {
  label: string;
  prefix: string | null;
}

// ─── Session Analytics (First-Party) ────────────────────────
// sessions-service GET /stats/*, passed through verbatim by portal-service
// at /session-analytics/*. Durations are MILLISECONDS; rates are 0–1
// ratios (like GA4). Timestamps are ISO strings; a session is "in range"
// by its startedAt, pageviews/events by their own time.

/** The viewport band a heatmap point was recorded in (width <768 | ≤1200 | >1200). */
export type SessionBand = "mobile" | "tablet" | "desktop";

/** Which interaction a page heatmap counts. */
export type SessionHeatmapType = "click" | "move";

/**
 * The window a ranged stats request covers: a rolling `period` ending now
 * (`all`, `<n>h`, `<n>d`), or whole calendar days `from`–`to` (YYYY-MM-DD,
 * `to` inclusive) in the request's `tz`.
 */
export type SessionRange = { period: string } | { from: string; to: string };

/** GET /stats/projects row — every project ever seen, with the range's numbers. */
export interface SessionProjectSummary {
  projectId: string;
  visitors: number;
  sessions: number;
  pageviews: number;
  engagedMs: number;
  /** Sessions seen in the last 5 minutes. */
  live: number;
  /** All-time. */
  firstSeenAt: string;
  lastSeenAt: string;
}

/** The totals of one range (a report's `summary`, or its `previous`). */
export interface SessionReportSummary {
  visitors: number;
  /** Visitors whose FIRST session is in the range. */
  newVisitors: number;
  sessions: number;
  engagedSessions: number;
  pageviews: number;
  engagedMs: number;
  /** engagedMs / sessions. */
  avgEngagedMs: number;
  engagementRate: number;
  /** 1 − engagementRate (0 when there are no sessions). */
  bounceRate: number;
  pagesPerSession: number;
}

export interface SessionSeriesPoint {
  /** "YYYY-MM-DD" (day buckets) or "YYYY-MM-DDTHH" (hour buckets), in the report's tz. */
  bucket: string;
  visitors: number;
  sessions: number;
  pageviews: number;
  engagedMs: number;
}

export interface SessionPageRow {
  path: string;
  views: number;
  visitors: number;
  avgEngagedMs: number;
  /** 0–100. */
  avgScroll: number;
  entries: number;
  exits: number;
}

export interface SessionChannelRow {
  /** GA4 default channel group ("Direct", "Organic Search", …). */
  channel: string;
  sessions: number;
  visitors: number;
  engagementRate: number;
}

export interface SessionReferrerRow {
  host: string;
  sessions: number;
  visitors: number;
}

export interface SessionCampaignRow {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  sessions: number;
  visitors: number;
}

export interface SessionCountryRow {
  /** ISO 3166-1 alpha-2. */
  country: string;
  name: string;
  sessions: number;
  visitors: number;
}

export interface SessionCityRow {
  country: string;
  region: string | null;
  city: string;
  sessions: number;
}

export interface SessionNamedCount {
  name: string;
  sessions: number;
}

export interface SessionEventRow {
  name: string;
  count: number;
  sessions: number;
}

/** Sessions started in one weekday × hour of the report's tz (non-zero cells only). */
export interface SessionHourCell {
  /** 0 = Sunday. */
  weekday: number;
  hour: number;
  sessions: number;
}

/** GET /stats/report */
export interface SessionReport {
  range: {
    /** null for period=all. */
    from: string | null;
    to: string;
    /** "hour" when the range is ≤ 48 h. */
    bucket: "hour" | "day";
    tz: string;
  };
  summary: SessionReportSummary;
  /** The equal-length range right before `from`; null for period=all. */
  previous: SessionReportSummary | null;
  /** Every bucket of the range, zero-filled. */
  series: SessionSeriesPoint[];
  /** Top 50 by views. */
  pages: SessionPageRow[];
  channels: SessionChannelRow[];
  /** Top 25 external hosts. */
  referrers: SessionReferrerRow[];
  /** Top 25 utm source/medium/campaign combinations. */
  campaigns: SessionCampaignRow[];
  countries: SessionCountryRow[];
  /** Top 25. */
  cities: SessionCityRow[];
  /** Device type (desktop, mobile, tablet, …). */
  devices: SessionNamedCount[];
  browsers: SessionNamedCount[];
  os: SessionNamedCount[];
  /** Top 10. */
  screens: SessionNamedCount[];
  /** Top 10, as the browser sent them ("en-US"). */
  languages: SessionNamedCount[];
  /** Top 25 custom events. */
  events: SessionEventRow[];
  hours: SessionHourCell[];
}

/** A session seen in the last 5 minutes. */
export interface LiveSession {
  sessionId: string;
  projectId: string;
  visitorId: string;
  /** The page it is on now (its exit path). */
  path: string;
  country: string | null;
  city: string | null;
  device: string;
  browser: string | null;
  channel: string;
  referrerHost: string | null;
  startedAt: string;
  lastSeenAt: string;
  pageviews: number;
  engagedMs: number;
}

/** GET /stats/live */
export interface SessionLive {
  /** Sessions seen in the last 5 minutes (exact). */
  active: number;
  /** The 50 most recent. */
  sessions: LiveSession[];
  /** Active sessions by current page, busiest first. */
  pages: { path: string; active: number }[];
}

/** Exact-match filters of GET /stats/sessions. */
export interface SessionFilters {
  visitorId?: string;
  ip?: string;
  userId?: string;
  /** ISO 3166-1 alpha-2. */
  country?: string;
  channel?: string;
  /** Sessions that viewed this path in the range. */
  path?: string;
  /** Only sessions with a replay recording. */
  replay?: boolean;
  /** Only engaged sessions. */
  engaged?: boolean;
}

export type SessionSortKey =
  "startedAt" | "lastSeenAt" | "engagedMs" | "pageviews";

export interface SessionSort {
  sort: SessionSortKey;
  order: "asc" | "desc";
}

export interface SessionPaging {
  /** 1–200. */
  limit: number;
  offset: number;
}

/** GET /stats/sessions row. */
export interface SessionSummary {
  sessionId: string;
  projectId: string;
  visitorId: string;
  userId: string | null;
  startedAt: string;
  lastSeenAt: string;
  pageviews: number;
  engagedMs: number;
  isEngaged: boolean;
  /** 1 for the visitor's first session in this project. */
  sessionNumber: number;
  entryPath: string;
  exitPath: string;
  channel: string;
  source: string | null;
  referrerHost: string | null;
  campaign: string | null;
  /** ISO 3166-1 alpha-2. */
  country: string | null;
  region: string | null;
  city: string | null;
  ip: string | null;
  device: string;
  browser: string | null;
  os: string | null;
  screen: string | null;
  hasReplay: boolean;
}

/** GET /stats/sessions */
export interface SessionsPage {
  sessions: SessionSummary[];
  total: number;
  limit: number;
  offset: number;
}

/** One pageview of a session, in order. */
export interface SessionView {
  id: string;
  path: string;
  title: string | null;
  at: string;
  engagedMs: number;
  /** Max scroll depth, 0–100. */
  scroll: number;
}

/** One custom (or automatic, e.g. "outbound") event of a session. */
export interface SessionEvent {
  name: string;
  props: Record<string, unknown> | null;
  path: string | null;
  at: string;
}

/** GET /stats/sessions/:sessionId */
export interface SessionDetail extends SessionSummary {
  hostname: string;
  referrer: string | null;
  medium: string | null;
  term: string | null;
  content: string | null;
  clickId: string | null;
  browserVersion: string | null;
  osVersion: string | null;
  viewport: string | null;
  timezone: string | null;
  language: string | null;
  userAgent: string;
  /** null when nothing was recorded. */
  replay: { chunks: number; bytes: number } | null;
  views: SessionView[];
  events: SessionEvent[];
  /** This visitor across the project, all time. */
  visitor: { sessions: number; firstSeenAt: string };
}

/** One recorded rrweb event, stored verbatim by sessions-service. */
export interface RrwebEvent {
  timestamp?: number;
  [key: string]: unknown;
}

/** GET /stats/sessions/:sessionId/replay — chunks in recording order, events by timestamp. */
export interface SessionReplay {
  sessionId: string;
  events: RrwebEvent[];
  eventCount: number;
  totalChunks: number;
  returnedChunks: number;
  /** True when the per-session byte budget cut the recording short. */
  truncated: boolean;
}

/** GET /stats/heatmap — a grid×grid density matrix over one page's full document. */
export interface SessionHeatmap {
  path: string;
  band: SessionBand;
  type: SessionHeatmapType;
  grid: number;
  /** The densest cell's count. */
  max: number;
  total: number;
  sessions: number;
  /** Median document height / width of the recorded batches (1 when none). */
  aspect: number;
  /** Non-empty cells only; gx, gy in [0, grid). */
  cells: { gx: number; gy: number; count: number }[];
}

/**
 * sessions-service wraps every successful /stats body (proxied verbatim by
 * portal-service's /session-analytics) as `{ success: true, data }`.
 */
export interface SessionsEnvelope<T> {
  success: true;
  data: T;
}

/** The `data` of each ranged GET /session-analytics/<route>, by route. */
export interface SessionStatsByRoute {
  projects: SessionProjectSummary[];
  report: SessionReport;
  live: SessionLive;
  sessions: SessionsPage;
  heatmap: SessionHeatmap;
}

// ─── Integrations ───────────────────────────────────────────

/**
 * One external API key the portal knows about. The service never sends key
 * material: a configured key is `configured: true` plus `fingerprint` — the
 * first 8 hex chars of its SHA-256, enough to tell keys apart or confirm a
 * rotation landed.
 */
export interface IntegrationItem {
  provider: string;
  envKey: string;
  category: string;
  configured: boolean;
  /** Provider dashboard / docs link. */
  docs: string;
  /** null when the key is not configured. */
  fingerprint: string | null;
}

export interface IntegrationCategory {
  category: string;
  integrations: IntegrationItem[];
  configuredCount: number;
  totalCount: number;
}

/** GET /integrations */
export interface IntegrationsData {
  categories: IntegrationCategory[];
  totalCount: number;
  configuredCount: number;
}

// ─── Logs ───────────────────────────────────────────────────

/** A container as `GET /logs` lists it. */
export interface LoggableContainer {
  /** The container name (names are the ids Docker log routes take). */
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  /** Device id of the Docker host. */
  device: string;
  /** The device's display name (its id when unregistered). */
  deviceName: string;
}

/** GET /logs */
export interface LoggableContainersResponse {
  containers: LoggableContainer[];
}

// ─── External APIs ──────────────────────────────────────────

export interface ExternalApiDailyCount {
  date: string;
  requests: number;
}

/** One external API's usage over the period, from whichever source tracks it. */
export interface ExternalApiUsage {
  /** `*.googleapis.com`, `llm:<provider>`, or a tools-service hostname. */
  serviceIdentifier: string;
  displayName: string;
  category: string;
  consumer: string;
  /** Empty for providers without a known docs page. */
  documentationUrl: string;
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  /** 0–1 */
  errorRate: number;
  /** Only sources that track spend (prism LLM requests). */
  estimatedCost?: number;
  dailySeries: ExternalApiDailyCount[];
}

/** GET /external-apis?period= */
export interface ExternalApiUsageData {
  services: ExternalApiUsage[];
  totalRequests: number;
  totalErrors: number;
  period: string;
  /** Primary GCP project ("" when Cloud Monitoring was unreachable). */
  projectId: string;
  projectIds: string[];
  /** GCP projects whose Monitoring query failed. */
  unreachableProjectIds: string[];
  /** Usage sources that failed — the numbers shown exclude them. */
  unreachableSources: string[];
  fetchedAt: string;
}

export interface ExternalApiTimeSeriesPoint {
  date: string;
  requests: number;
  successRequests: number;
  errorRequests: number;
}

/** GET /external-apis/timeseries?service=&period= */
export interface ExternalApiTimeSeries {
  serviceIdentifier: string;
  displayName: string;
  series: ExternalApiTimeSeriesPoint[];
  period: string;
  fetchedAt: string;
}
