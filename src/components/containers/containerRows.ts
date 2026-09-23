import type {
  ContainerRow,
  ContainerStatusKind,
  DockerContainerStats,
  MemoryStats,
  PortalService,
  SystemInfo,
  SystemInfoResponse,
} from "@/types/portal";
import { containerKey } from "../monitoring/containerHistory";

/**
 * What the table reads from a `GET /stats/containers` entry: the name it
 * joins on, plus whichever stats fields are there to copy onto the row.
 */
export type DockerContainer = Pick<DockerContainerStats, "name"> &
  Partial<DockerContainerStats>;

export type ContainerType = ContainerRow["projectType"];
export const CONTAINER_TYPES: readonly ContainerType[] = [
  "client",
  "service",
  "bot",
];

export function classifyContainer(
  name: string,
  projectType?: string | null,
): ContainerType {
  const registryType = (projectType || "").toLowerCase();
  const lowerName = name.toLowerCase();
  if (registryType === "client" || lowerName.includes("client"))
    return "client";
  if (registryType === "bot" || lowerName.includes("bot")) return "bot";
  return "service";
}

/**
 * Status of one container row. Docker's own state wins when the container
 * isn't running — the registry health cache lags a stop by up to two
 * 60 s rounds. A running, registered service defers to its health check;
 * one that hasn't been checked yet (portal-service just booted) is
 * "unknown", not "down".
 */
export function containerStatusKind(
  state: string | undefined,
  service: PortalService | null,
): ContainerStatusKind {
  if (state !== "running") return "down";
  if (!service) return "healthy";
  if (service.checkedAt == null) return "unknown";
  return service.healthy ? "healthy" : "down";
}

/** Join Docker containers with the project registry (by `dockerProject`). */
export function buildContainerRows(
  containers: DockerContainer[],
  services: PortalService[],
): ContainerRow[] {
  const serviceByDockerProject = new Map<string, PortalService>();
  for (const service of services) {
    if (service.dockerProject)
      serviceByDockerProject.set(service.dockerProject, service);
  }

  const rows = containers.map((container): ContainerRow => {
    const service = serviceByDockerProject.get(container.name) ?? null;
    const device = container.device || null;
    const statusKind = containerStatusKind(container.state, service);
    return {
      id: containerKey(device, container.name),
      serviceId: service?.id ?? null,
      containerName: container.name,
      healthy: statusKind === "healthy",
      statusKind,
      registered: service !== null,
      visibility: service?.visibility ?? null,
      port: service?.port ?? null,
      url: service?.url || null,
      domain: service?.domain || null,
      responseTimeMs: service?.responseTimeMs ?? null,
      device,
      // A registered container is by construction a containerized service,
      // so the /services/:id actions (rollback) apply to it.
      restartable: service !== null,
      dockerProject: container.name,
      projectType: classifyContainer(container.name, service?.projectType),
      _stats: {
        cpu: container.cpu ?? { percent: 0, cores: 0 },
        cpuThrottling: container.cpuThrottling,
        memory: container.memory ?? { used: 0, limit: 0, percent: 0 },
        memoryDetail: container.memoryDetail,
        network: container.network,
        blockIO: container.blockIO,
        pids: container.pids,
        image: container.image,
        state: container.state,
        status: container.status,
        created: container.created,
        command: container.command,
        ports: container.ports,
        mounts: container.mounts,
        labels: container.labels,
      },
    };
  });

  return rows.sort(
    (first, second) =>
      first.containerName.localeCompare(second.containerName) ||
      (first.device || "").localeCompare(second.device || ""),
  );
}

export interface ContainerFilters {
  devices: string[];
  types: string[];
  query: string;
}

export function filterContainerRows(
  rows: ContainerRow[],
  filters: ContainerFilters,
): ContainerRow[] {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (
      filters.devices.length > 0 &&
      !(row.device && filters.devices.includes(row.device))
    ) {
      return false;
    }
    if (filters.types.length > 0 && !filters.types.includes(row.projectType))
      return false;
    if (!query) return true;
    return (
      row.containerName.toLowerCase().includes(query) ||
      (row.device?.toLowerCase().includes(query) ?? false) ||
      row.projectType.includes(query) ||
      (row.port != null && String(row.port).includes(query)) ||
      (row.domain?.toLowerCase().includes(query) ?? false)
    );
  });
}

/** `/stats/system` answers an object (one device) or an array (all). */
export function normalizeSystemInfo(
  response: SystemInfoResponse,
): SystemInfo[] | null {
  const devices = Array.isArray(response) ? response : [response];
  // Empty = every Docker host failed; null lets the next poll retry.
  return devices.length > 0 ? devices : null;
}

/** The host RAM figures the container table needs from `/stats/system`. */
export type HostMemory = Pick<SystemInfo, "deviceId" | "totalMemory">;

export function hostRamByDevice(
  systemInfo: HostMemory[] | null,
): Record<string, number> {
  const ram: Record<string, number> = {};
  for (const device of systemInfo ?? [])
    ram[device.deviceId] = device.totalMemory || 0;
  return ram;
}

/**
 * Memory usage as the table shows it. An uncapped container reports the
 * host's RAM as its cgroup limit, so only a limit clearly below the host
 * RAM counts as a real cap.
 */
export function memoryUsage(memory: MemoryStats, hostRam: number) {
  const capped =
    memory.limit > 0 && hostRam > 0 && memory.limit < hostRam * 0.99;
  return {
    capped,
    percent: capped ? (memory.used / memory.limit) * 100 : memory.percent,
  };
}

export interface ContainerSummary {
  total: number;
  healthy: number;
  running: number;
  stopped: number;
  totalCpu: number;
  averageCpu: number;
  memoryUsed: number;
  /** Host RAM across the shown devices (0 when unknown). */
  memoryLimit: number;
  memoryPercent: number;
  networkRx: number;
  networkTx: number;
  /** Rows that carry a registry response time. */
  responseSamples: number;
  averageResponseMs: number;
}

export function summarizeContainers(
  rows: ContainerRow[],
  systemInfo: HostMemory[] | null,
  activeDevices: string[],
): ContainerSummary {
  let healthy = 0;
  let running = 0;
  let totalCpu = 0;
  let memoryUsed = 0;
  let networkRx = 0;
  let networkTx = 0;
  let responseSamples = 0;
  let responseTotal = 0;
  const cgroupLimitByDevice: Record<string, number> = {};

  for (const row of rows) {
    const stats = row._stats;
    if (row.statusKind === "healthy") healthy++;
    if (stats?.state === "running") running++;
    totalCpu += stats?.cpu?.percent || 0;
    memoryUsed += stats?.memory?.used || 0;
    networkRx += stats?.network?.rx || 0;
    networkTx += stats?.network?.tx || 0;
    if (row.responseTimeMs != null) {
      responseSamples++;
      responseTotal += row.responseTimeMs;
    }
    const device = row.device || "_default";
    cgroupLimitByDevice[device] = Math.max(
      cgroupLimitByDevice[device] || 0,
      stats?.memory?.limit || 0,
    );
  }

  // Prefer real host RAM; without /stats/system, an uncapped container's
  // cgroup limit is the host RAM, so the per-device max approximates it.
  const memoryLimit = systemInfo
    ? systemInfo
        .filter(
          (device) =>
            activeDevices.length === 0 ||
            activeDevices.includes(device.deviceId),
        )
        .reduce((sum, device) => sum + (device.totalMemory || 0), 0)
    : Object.values(cgroupLimitByDevice).reduce((sum, limit) => sum + limit, 0);

  return {
    total: rows.length,
    healthy,
    running,
    stopped: rows.length - running,
    totalCpu,
    averageCpu: rows.length > 0 ? totalCpu / rows.length : 0,
    memoryUsed,
    memoryLimit,
    memoryPercent: memoryLimit > 0 ? (memoryUsed / memoryLimit) * 100 : 0,
    networkRx,
    networkTx,
    responseSamples,
    averageResponseMs:
      responseSamples > 0 ? Math.round(responseTotal / responseSamples) : 0,
  };
}
