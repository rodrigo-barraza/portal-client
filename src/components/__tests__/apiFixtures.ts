/**
 * Complete portal-service response bodies for tests that mock ApiService.
 * Each builder returns a full, realistic object; tests pass only the fields
 * they care about as overrides, so a mock keeps compiling against the real
 * contract when the service adds or renames a field.
 */

import type {
  ContainerActionResponse,
  ContainerMetricsResponse,
  ContainerStatsHistoryResponse,
  Device,
  DeviceSystemInfo,
  DiskUsage,
  DockerContainerStats,
  ExternalApiUsage,
  ExternalApiUsageData,
  LoggableContainer,
  ProjectAnalysis,
  ServiceActionResponse,
  SessionDetail,
  SessionHeatmap,
  SessionLive,
  SessionReport,
  SessionReportSummary,
  SessionsEnvelope,
  SessionsPage,
  SessionSummary,
  StorageBucket,
  StorageObject,
  StorageObjectStat,
} from "@/types/portal";

const GIB = 1024 ** 3;
const FETCHED_AT = "2026-09-22T00:00:00.000Z";

/** A running container on `device` (GET /stats/containers). */
export function dockerContainer(
  overrides: Partial<DockerContainerStats> & Pick<DockerContainerStats, "name">,
): DockerContainerStats {
  return {
    id: "0123456789ab",
    image: `${overrides.name}:latest`,
    state: "running",
    status: "Up 3 hours",
    created: 1_758_499_200,
    command: "node dist/index.js",
    ports: [],
    mounts: [],
    labels: {},
    device: "synology",
    cpu: { percent: 12, cores: 4 },
    cpuThrottling: { periods: 0, throttledPeriods: 0, throttledTimeNs: 0 },
    memory: { used: 256 * 1024 ** 2, limit: 16 * GIB, percent: 1.5 },
    memoryDetail: {
      rss: 0,
      cache: 0,
      swap: 0,
      maxUsage: 0,
      pgfault: 0,
      pgmajfault: 0,
    },
    network: { rx: 10, tx: 20 },
    blockIO: { read: 0, write: 0 },
    pids: 12,
    ...overrides,
  };
}

/** Docker disk usage with every category empty. */
export function diskUsage(overrides: Partial<DiskUsage> = {}): DiskUsage {
  return {
    images: { totalSize: 0, count: 0, sharedSize: 0, items: [] },
    volumes: { totalSize: 0, count: 0, items: [] },
    buildCache: { totalSize: 0, count: 0 },
    containers: { totalWritableSize: 0, count: 0 },
    totalReclaimable: 0,
    ...overrides,
  };
}

/** One host of GET /stats/system (without a device). */
export function deviceSystemInfo(
  overrides: Partial<DeviceSystemInfo> & Pick<DeviceSystemInfo, "deviceId">,
): DeviceSystemInfo {
  return {
    deviceName: overrides.deviceId,
    serverVersion: "28.0.0",
    os: "Ubuntu 24.04",
    architecture: "x86_64",
    totalMemory: 16 * GIB,
    cpus: 8,
    containersRunning: 0,
    containersStopped: 0,
    containersPaused: 0,
    containersTotal: 0,
    hostDisk: null,
    disk: diskUsage(),
    fetchedAt: FETCHED_AT,
    ...overrides,
  };
}

/** A registered device (GET /devices) with nothing hosted on it. */
export function device(
  overrides: Partial<Device> & Pick<Device, "id" | "name">,
): Device {
  return {
    hostname: "",
    os: "",
    type: "",
    notes: "",
    specs: null,
    services: [],
    infrastructure: [],
    serviceCount: 0,
    healthyCount: 0,
    ...overrides,
  };
}

/** A container in the Logs page's list (GET /logs). */
export function loggableContainer(
  overrides: Partial<LoggableContainer> &
    Pick<LoggableContainer, "name" | "device">,
): LoggableContainer {
  return {
    id: overrides.name,
    image: `${overrides.name}:latest`,
    state: "running",
    status: "Up 3 hours",
    deviceName: overrides.device,
    ...overrides,
  };
}

export function storageBucket(
  overrides: Partial<StorageBucket> & Pick<StorageBucket, "name">,
): StorageBucket {
  return { creationDate: null, objectCount: 0, totalSize: 0, ...overrides };
}

export function storageObject(
  overrides: Partial<StorageObject> & Pick<StorageObject, "name">,
): StorageObject {
  return { size: 0, lastModified: null, etag: null, ...overrides };
}

export function storageObjectStat(
  overrides: Partial<StorageObjectStat> &
    Pick<StorageObjectStat, "bucket" | "object">,
): StorageObjectStat {
  return {
    size: 0,
    contentType: "application/octet-stream",
    etag: "etag",
    lastModified: null,
    metadata: {},
    ...overrides,
  };
}

/** A code analysis that found nothing, with GitHub healthy. */
export function projectAnalysis(
  overrides: Partial<ProjectAnalysis> = {},
): ProjectAnalysis {
  return {
    dependencies: {},
    repoSizes: {},
    owners: {},
    analyzedAt: FETCHED_AT,
    github: {
      tokenConfigured: true,
      status: "ok",
      stats: {
        requests: 0,
        failures: 0,
        unauthorized: 0,
        rateLimited: 0,
        notFound: 0,
      },
    },
    ...overrides,
  };
}

export function externalApiUsage(
  overrides: Partial<ExternalApiUsage> &
    Pick<ExternalApiUsage, "serviceIdentifier">,
): ExternalApiUsage {
  return {
    displayName: overrides.serviceIdentifier,
    category: "Other",
    consumer: "",
    documentationUrl: "",
    totalRequests: 0,
    successRequests: 0,
    errorRequests: 0,
    errorRate: 0,
    dailySeries: [],
    ...overrides,
  };
}

/** GET /external-apis with every source reachable. */
export function externalApiUsageData(
  overrides: Partial<ExternalApiUsageData> = {},
): ExternalApiUsageData {
  return {
    services: [],
    totalRequests: 0,
    totalErrors: 0,
    period: "30d",
    projectId: "",
    projectIds: [],
    unreachableProjectIds: [],
    unreachableSources: [],
    fetchedAt: FETCHED_AT,
    ...overrides,
  };
}

export const EMPTY_METRICS: ContainerMetricsResponse = {
  containers: {},
  range: "1h",
  samples: 0,
};

export const EMPTY_STATS_HISTORY: ContainerStatsHistoryResponse = {
  history: {},
  samples: 0,
};

export function serviceActionResponse(service: string): ServiceActionResponse {
  return { success: true, service, device: "synology", message: "OK" };
}

export function containerActionResponse(
  container: string,
  device = "synology",
): ContainerActionResponse {
  return { success: true, container, device, message: "OK" };
}

// ── Session analytics (sessions-service /stats, via portal-service) ──

/** A body in sessions-service's `{ success, data }` envelope. */
export function envelope<T>(data: T): SessionsEnvelope<T> {
  return { success: true, data };
}

/** One row of GET /session-analytics/sessions: a returning Canadian on Chrome. */
export function sessionSummary(
  overrides: Partial<SessionSummary> = {},
): SessionSummary {
  return {
    sessionId: "session-aaaaaaaaaaaa",
    projectId: "rod-dev-client",
    visitorId: "visitor-1234567890",
    userId: null,
    startedAt: "2026-09-22T10:00:00.000Z",
    lastSeenAt: "2026-09-22T10:05:00.000Z",
    pageviews: 3,
    engagedMs: 65_000,
    isEngaged: true,
    sessionNumber: 3,
    entryPath: "/",
    exitPath: "/pricing",
    channel: "Organic Search",
    source: "google",
    referrerHost: "www.google.com",
    campaign: null,
    country: "CA",
    region: "BC",
    city: "Vancouver",
    ip: "203.0.113.5",
    device: "desktop",
    browser: "Chrome",
    os: "macOS",
    screen: "1920x1080",
    hasReplay: false,
    ...overrides,
  };
}

export function sessionsPage(
  sessions: SessionSummary[],
  overrides: Partial<SessionsPage> = {},
): SessionsPage {
  return {
    sessions,
    total: sessions.length,
    limit: 50,
    offset: 0,
    ...overrides,
  };
}

/** GET /session-analytics/sessions/:id for {@link sessionSummary}'s session. */
export function sessionDetail(
  overrides: Partial<SessionDetail> = {},
): SessionDetail {
  return {
    ...sessionSummary(),
    hostname: "rod.dev",
    referrer: "https://www.google.com/",
    medium: "organic",
    term: null,
    content: null,
    clickId: null,
    browserVersion: "140",
    osVersion: "15",
    viewport: "1280x800",
    timezone: "America/Vancouver",
    language: "en-CA",
    userAgent: "Mozilla/5.0 (Macintosh) Chrome/140",
    replay: null,
    views: [
      {
        id: "pv-1",
        path: "/",
        title: "Home",
        at: "2026-09-22T10:00:00.000Z",
        engagedMs: 20_000,
        scroll: 80,
      },
      {
        id: "pv-2",
        path: "/pricing",
        title: "Pricing",
        at: "2026-09-22T10:02:00.000Z",
        engagedMs: 45_000,
        scroll: 35,
      },
    ],
    events: [
      {
        name: "outbound",
        props: { url: "https://github.com/rod" },
        path: "/",
        at: "2026-09-22T10:01:00.000Z",
      },
    ],
    visitor: { sessions: 7, firstSeenAt: "2026-09-01T08:00:00.000Z" },
    ...overrides,
  };
}

export function sessionReportSummary(
  overrides: Partial<SessionReportSummary> = {},
): SessionReportSummary {
  return {
    visitors: 0,
    newVisitors: 0,
    sessions: 0,
    engagedSessions: 0,
    pageviews: 0,
    engagedMs: 0,
    avgEngagedMs: 0,
    engagementRate: 0,
    bounceRate: 0,
    pagesPerSession: 0,
    ...overrides,
  };
}

/** GET /session-analytics/report for a project with no visits yet. */
export function sessionReport(
  overrides: Partial<SessionReport> = {},
): SessionReport {
  return {
    range: {
      from: "2026-08-24T07:00:00.000Z",
      to: "2026-09-23T07:00:00.000Z",
      bucket: "day",
      tz: "America/Vancouver",
    },
    summary: sessionReportSummary(),
    previous: sessionReportSummary(),
    series: [],
    pages: [],
    channels: [],
    referrers: [],
    campaigns: [],
    countries: [],
    cities: [],
    devices: [],
    browsers: [],
    os: [],
    screens: [],
    languages: [],
    events: [],
    hours: [],
    ...overrides,
  };
}

export function sessionLive(overrides: Partial<SessionLive> = {}): SessionLive {
  return { active: 0, sessions: [], pages: [], ...overrides };
}

export function sessionHeatmap(
  overrides: Partial<SessionHeatmap> = {},
): SessionHeatmap {
  return {
    path: "/",
    band: "desktop",
    type: "click",
    grid: 50,
    max: 0,
    total: 0,
    sessions: 0,
    aspect: 1,
    cells: [],
    ...overrides,
  };
}
