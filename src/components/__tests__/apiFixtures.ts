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
