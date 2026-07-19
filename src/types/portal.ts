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
  | "Tool";

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

/** A service/project entry from the portal-service registry API. */
export interface PortalService {
  id: string;
  name: string;
  description?: string;
  healthy: boolean;
  projectType?: ProjectType | string;
  deployTier?: DeployTier | number;
  device?: string;
  url?: string;
  domain?: string;
  port?: number;
  visibility?: "external" | "internal";
  environment?: string;
  responseTimeMs?: number;
  error?: string;
  repo?: string;
  dockerProject?: string;
  restartable?: boolean;
  checkedAt?: string;
  /** Watchdog state (portal-service /watchdog): pending | up | down. */
  watchdogStatus?: "pending" | "up" | "down";
  /** Last push heartbeat received (dead-man's-switch services only). */
  lastHeartbeatAt?: string | null;
  /** Start of the current unhealthy stretch, if any. */
  downSince?: string | null;
  isInfrastructure?: boolean;
  essential?: boolean;
  db?: string;
  npmPackage?: string;
  dependsOn?: DependsOnEntry[];
  metadata?: ServiceMetadata;
  analyticsPropertyId?: string;
}

/** Service metadata from health check responses. */
export interface ServiceMetadata {
  version?: string;
  uptime?: number;
  connections?: number;
  databases?: number;
  buckets?: number;
  bucketNames?: string[];
  nodeVersion?: string;
  pythonVersion?: string;
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

/** A merged container row — project registry data + Docker stats. */
export interface ContainerRow {
  id: string;
  containerName: string;
  healthy: boolean;
  registered: boolean;
  visibility: string | null;
  port: number | null;
  url: string | null;
  domain: string | null;
  responseTimeMs: number | null;
  device: string | null;
  restartable: boolean;
  controllable: boolean;
  dockerProject: string;
  projectType: "client" | "service" | "bot";
  _stats: ContainerStats | null;
}

/** Per-container sparkline history for CPU and memory. */
export interface ContainerHistory {
  cpu: number[];
  mem: number[];
}

/** Sparkline history including network data (used in detail panel). */
export interface ContainerDetailHistory {
  cpu: number[];
  mem: number[];
  netRx: number[];
  netTx: number[];
}

// ─── System Info ────────────────────────────────────────────

export interface DiskCategory {
  totalSize: number;
  count: number;
  items?: DiskItem[];
}

export interface DiskContainersCategory {
  totalWritableSize: number;
  count: number;
}

export interface DiskItem {
  id?: string;
  name?: string;
  tags?: string[];
  size: number;
}

export interface DiskUsage {
  images: DiskCategory;
  volumes: DiskCategory;
  buildCache: DiskCategory;
  containers: DiskContainersCategory;
  totalReclaimable: number;
}

export interface SystemInfo {
  deviceId: string;
  serverVersion?: string;
  containersRunning?: number;
  containersStopped?: number;
  totalMemory?: number;
  disk?: DiskUsage;
}

// ─── Storage / Object Store ─────────────────────────────────

export interface StorageBucket {
  name: string;
  creationDate?: string;
  /** null while stats are still being collected for this bucket */
  objectCount: number | null;
  totalSize: number | null;
}

export interface StorageObject {
  name: string;
  size: number;
  lastModified?: string;
  etag?: string;
  contentType?: string;
}

export interface StorageSummary {
  buckets: StorageBucket[];
  totalObjects: number;
  totalSize: number;
}

export interface BucketStreamEvent {
  type: "init" | "bucket" | "done" | "error";
  totalBuckets?: number;
  /** init now carries every bucket's name/date up front (stats null) */
  buckets?: StorageBucket[];
  bucket?: StorageBucket;
  message?: string;
}

export interface StorageSearchResult extends StorageObject {
  bucket: string;
}

export interface StorageSearchResponse {
  results: StorageSearchResult[];
  totalScanned: number;
  truncated: boolean;
}

// ─── Project Analysis (Topology) ────────────────────────────

export interface DetectedImport {
  target: string;
  type?: string;
}

export interface DetectedApiCall {
  target: string;
  endpoint?: string;
}

export interface ProjectDependencies {
  imports: DetectedImport[];
  apiCalls: DetectedApiCall[];
}

export interface GitHubAnalysisHealth {
  tokenConfigured: boolean;
  status: "ok" | "degraded" | "unavailable";
  stats?: {
    requests: number;
    failures: number;
    unauthorized: number;
    rateLimited: number;
    notFound: number;
  };
}

export interface ProjectAnalysis {
  dependencies: Record<string, ProjectDependencies>;
  repoSizes?: Record<string, RepoSize>;
  owners?: Record<string, string>;
  analyzedAt?: string;
  /** Health of the GitHub-backed code analysis — lets the UI distinguish
   *  "no detected edges" from "detection was unavailable". */
  github?: GitHubAnalysisHealth;
}

export interface RepoSize {
  sizeKB: number;
  sizeBytes: number;
}

/** Response shape from the /services API endpoint. */
export interface ServicesResponse {
  services: PortalService[];
  infrastructure: PortalService[];
  deployTierColors?: Record<number, DeployTierColor>;
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

export interface DragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

export interface ClusterDragState {
  startX: number;
  startY: number;
  memberIds: string[];
  origPositions: Record<string, NodePosition>;
}

// ─── Google Analytics ───────────────────────────────────────

export interface GAProperty {
  id: string;
  label: string;
  measurementId: string;
  /** Registry project id (e.g. "rod-dev-client") — joins a GA property to its sessions-service projectId. */
  serviceId?: string;
  domain?: string | null;
}

export interface GAOverview {
  totalUsers: number;
  newUsers: number;
  pageviews: number;
  sessions: number;
  engagedSessions: number;
  avgSessionDuration: number;
  engagementRate: number;
  bounceRate: number;
  deltas?: {
    totalUsers?: number;
    pageviews?: number;
    sessions?: number;
    avgSessionDuration?: number;
    engagementRate?: number;
  };
}

export interface GAPageRow {
  pagePath: string;
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
}

export interface GASource {
  source: string;
  medium: string;
  sessions: number;
}

export interface GALocation {
  country: string;
  city?: string;
  users: number;
}

export interface GADeviceCategory {
  category: string;
  sessions: number;
}

export interface GABrowser {
  browser: string;
  sessions: number;
}

export interface GAOperatingSystem {
  os: string;
  sessions: number;
}

export interface GAScreenResolution {
  resolution: string;
  sessions: number;
}

export interface GADevices {
  categories: GADeviceCategory[];
  browsers: GABrowser[];
  operatingSystems: GAOperatingSystem[];
  screenResolutions: GAScreenResolution[];
}

export interface GAChannel {
  channel: string;
  sessions: number;
}

export interface GAHeatmapCell {
  day: string;
  hour: number;
  users: number;
}

export interface GANewVsReturningSegment {
  segment: "new" | "returning" | string;
  users: number;
}

export interface GAEvent {
  eventName: string;
  eventCount: number;
}

export interface GATimeSeriesPoint {
  date?: string;
  pageviews: number;
  users: number;
  sessions: number;
}

// ─── Chart / Visualization ──────────────────────────────────

export interface DonutSegment {
  value: number;
  color: string;
  label: string;
  objectCount?: number;
}

export interface SparklineMetric {
  key: string;
  color: string;
}

// ─── Integrations ───────────────────────────────────────────

export interface Integration {
  id: string;
  name: string;
  description?: string;
  configured: boolean;
  category?: string;
  provider?: string;
  status?: "active" | "inactive" | "error";
  services?: string[];
}

// ─── Device ─────────────────────────────────────────────────

export interface Device {
  id: string;
  name: string;
  hostname?: string;
  ip?: string;
  os?: string;
  arch?: string;
  type?: string;
  notes?: string;
  services?: PortalService[];
}

// ─── Component Props Patterns ───────────────────────────────

// ─── Breadcrumb ─────────────────────────────────────────────

export interface BreadcrumbSegment {
  label: string;
  prefix: string | null;
}

// ─── Container Metrics (persistent MongoDB time-series) ─────

export interface ContainerMetricsPoint {
  cpu: number;
  mem: number;
  netRx?: number;
  netTx?: number;
  timestamp?: string;
}

export interface ContainerMetricsData {
  points: ContainerMetricsPoint[];
}

// ─── Settings ───────────────────────────────────────────────

export interface PortalSettings {
  theme?: "light" | "dark" | "system";
  [key: string]: unknown;
}

// ─── Library Catalog ────────────────────────────────────────

export interface LibraryExport {
  name: string;
  type: "component" | "hook" | "service" | "utility" | string;
  description?: string;
  source?: string;
}

export interface LibraryCatalog {
  name: string;
  exports: LibraryExport[];
}

// ─── Session Analytics (First-Party) ────────────────────────

/** A tracked project from sessions-service. */
export interface SessionProject {
  projectId: string;
  sessionCount: number;
  uniqueVisitors: number;
  lastActivity: string;
}

/** Overview stats from sessions-service. */
export interface SessionOverview {
  totalSessions: number;
  uniqueVisitors: number;
  totalPageViews: number;
  totalDuration: number;
  avgSessionDuration: number;
  engagedSessions: number;
  /** Percentage 0–100 (unlike GA's 0–1 ratios). */
  engagementRate: number;
  /** Percentage 0–100 (unlike GA's 0–1 ratios). */
  bounceRate: number;
}

/** Geo location from IP geolocation. */
export interface SessionGeo {
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
}

/** A full session record from sessions-service. */
export interface SessionRecord {
  sessionId: string;
  visitorId: string | null;
  projectId: string | null;
  ip: string;
  fingerprintId: string | null;
  userAgent: string;
  locale: string | null;
  browser: {
    name: string | null;
    version: string | null;
    major: string | null;
  };
  os: { name: string | null; version: string | null };
  device: { type: string; vendor: string | null; model: string | null };
  engine: { name: string | null; version: string | null };
  geo: SessionGeo;
  viewport: { width: number; height: number } | null;
  referrer: string | null;
  utm: Record<string, string> | null;
  duration: number;
  createdAt: string;
  updatedAt: string;
}

/** Paginated sessions response. */
export interface SessionsListResponse {
  sessions: SessionRecord[];
  total: number;
  limit: number;
  offset: number;
}

/** A single event record. */
export interface SessionEventRecord {
  sessionId: string;
  visitorId: string | null;
  projectId: string | null;
  category: string;
  action: string;
  label: string | null;
  value: unknown;
  timestamp: string;
}

/** Paginated events feed response. */
export interface EventsFeedResponse {
  events: SessionEventRecord[];
  total: number;
  limit: number;
  offset: number;
}

/** Top page entry from sessions-service. */
export interface SessionPageRow {
  path: string;
  views: number;
  uniqueVisitors: number;
}

/** Referrer entry. */
export interface SessionReferrerRow {
  referrer: string;
  sessions: number;
}

/** Geo breakdown entry. */
export interface SessionGeoRow {
  country: string | null;
  countryCode: string | null;
  city: string | null;
  sessions: number;
  uniqueVisitors: number;
}

/** Device breakdown from sessions-service. */
export interface SessionDeviceBreakdown {
  browsers: { name: string; sessions: number }[];
  operatingSystems: { name: string; sessions: number }[];
  deviceTypes: { type: string; sessions: number }[];
}

/** Time series point. */
export interface SessionTimeSeriesPoint {
  date: string;
  sessions: number;
  uniqueVisitors: number;
  pageViews: number;
}

/** Live sessions response. */
export interface SessionLiveResponse {
  activeSessions: number;
  sessions: SessionRecord[];
}

/** Top event entry. */
export interface SessionTopEvent {
  category: string;
  action: string;
  count: number;
}

/** Cross-client visitor entry. */
export interface CrossClientVisitor {
  fingerprintId: string;
  projects: string[];
  projectCount: number;
  totalSessions: number;
  totalDuration: number;
  firstSeen: string;
  lastSeen: string;
  ips: string[];
  browsers: string[];
  oses: string[];
  devices: string[];
  geo: { countries: string[]; cities: string[] };
}
