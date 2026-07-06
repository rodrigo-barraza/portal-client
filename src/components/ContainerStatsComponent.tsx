"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Check,
  Clock,
  Container,
  Cpu,
  Globe,
  LayoutGrid,
  List,
  Lock,
  MemoryStick,
  Network,
  Play,
  RotateCcw,
  ScrollText,
  Server,
  Square,
  Undo2,
  X,
} from "lucide-react";
import {
  BadgeComponent,
  ButtonComponent,
  DrawerComponent,
  LoadingIndicatorComponent,
  SelectComponent,
  PageHeaderComponent,
  ChartLineComponent,
  TableComponent,
  SearchInputComponent,
} from "@rodrigo-barraza/components-library";
import {
  formatBytes,
  formatDuration,
  formatPercent,
  getRootDomain,
  ACTION_COOLDOWN_MILLISECONDS,
  ACTION_COOLDOWN_LONG_MILLISECONDS,
  HIGHLIGHT_DURATION_MILLISECONDS,
} from "@rodrigo-barraza/utilities-library";
import type {
  ContainerRow,
  ContainerHistory,
  ContainerStats,
  ContainerMetricsData,
  SystemInfo,
  PortalService,
} from "../types/portal";
import ApiService from "../services/ApiService";
import ContainerDetailPanel from "./ContainerDetailPanelComponent";
import styles from "./ContainerStatsComponent.module.css";

const POLL_INTERVAL = 5_000;
const HISTORY_MAX = 60; // 60 samples × 5s = 5 minutes

function severityColor(
  percentage: number,
  thresholds: [number, number] = [40, 80],
): string {
  if (percentage > thresholds[1]) return "var(--color-danger)";
  if (percentage > thresholds[0]) return "var(--color-warning)";
  return "var(--color-success)";
}

// ── Inline Percent Bar ──────────────────────────────────────────
function MiniBar({ percent, color }: { percent: number; color: string }) {
  const clamped = Math.min(percent, 100);
  return (
    <div className={styles['mini-bar-track']}>
      <div
        className={styles['mini-bar-fill']}
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}

// ── Action Cell ─────────────────────────────────────────────────

function ActionCell({
  service,
  onRestart,
  onStop,
  onStart,
  onRollback,
  rollbackAvailable,
}: {
  service: ContainerRow;
  onRestart?: (serviceId: string, row: ContainerRow) => Promise<void>;
  onStop?: (serviceId: string, row: ContainerRow) => Promise<void>;
  onStart?: (serviceId: string, row: ContainerRow) => Promise<void>;
  onRollback?: (serviceId: string, row: ContainerRow) => Promise<void>;
  rollbackAvailable?: boolean;
}) {
  const [restarting, setRestarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [starting, setStarting] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  const isHealthy = service.healthy;

  return (
    <div className={styles['action-row']}>
      {isHealthy ? (
        <ButtonComponent
          variant="destructive"
          size="small"
          icon={Square}
          iconSize={9}
          loading={stopping}
          disabled={stopping || restarting || rollingBack}
          title="Stop"
          className={styles['action-button']}
          onClick={(event: React.MouseEvent<HTMLElement>) => {
            event.stopPropagation();
            setStopping(true);
            (async () => {
              try {
                await onStop?.(service.id, service);
              } finally {
                setTimeout(() => setStopping(false), ACTION_COOLDOWN_MILLISECONDS);
              }
            })();
          }}
        />
      ) : (
        <ButtonComponent
          variant="tonal"
          size="small"
          icon={Play}
          iconSize={9}
          loading={starting}
          disabled={starting || restarting || rollingBack}
          title="Start"
          className={styles['action-button']}
          onClick={(event: React.MouseEvent<HTMLElement>) => {
            event.stopPropagation();
            setStarting(true);
            (async () => {
              try {
                await onStart?.(service.id, service);
              } finally {
                setTimeout(() => setStarting(false), ACTION_COOLDOWN_MILLISECONDS);
              }
            })();
          }}
        />
      )}

      <ButtonComponent
        variant="secondary"
        size="small"
        icon={ScrollText}
        iconSize={9}
        href={`/logs?container=${service.dockerProject || service.id}`}
        title="Logs"
        className={styles['action-button']}
        onClick={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}
      />

      {rollbackAvailable && (
        <ButtonComponent
          variant="secondary"
          size="small"
          icon={Undo2}
          iconSize={9}
          loading={rollingBack}
          disabled={rollingBack || restarting || stopping || starting}
          title="Rollback to previousStateious build"
          className={styles['action-button']}
          onClick={(event: React.MouseEvent<HTMLElement>) => {
            event.stopPropagation();
            setRollingBack(true);
            (async () => {
              try {
                await onRollback?.(service.id, service);
              } finally {
                setTimeout(() => setRollingBack(false), ACTION_COOLDOWN_LONG_MILLISECONDS);
              }
            })();
          }}
        />
      )}

      <ButtonComponent
        variant="secondary"
        size="small"
        icon={RotateCcw}
        iconSize={9}
        loading={restarting}
        disabled={restarting || stopping || starting || rollingBack}
        title="Restart"
        className={styles['action-button']}
        onClick={(event: React.MouseEvent<HTMLElement>) => {
          event.stopPropagation();
          setRestarting(true);
          (async () => {
            try {
              await onRestart?.(service.id, service);
            } finally {
              setTimeout(() => setRestarting(false), ACTION_COOLDOWN_MILLISECONDS);
            }
          })();
        }}
      />
    </div>
  );
}

// ── Column Definitions ──────────────────────────────────────────

function buildColumns({
  onRestart,
  onStop,
  onStart,
  onRollback,
  rollbackMap,
  systemInfo,
  containerHistory,
}: {
  onRestart: (serviceId: string, row: ContainerRow) => Promise<void>;
  onStop: (serviceId: string, row: ContainerRow) => Promise<void>;
  onStart: (serviceId: string, row: ContainerRow) => Promise<void>;
  onRollback: (serviceId: string) => Promise<void>;
  rollbackMap: Record<string, boolean>;
  systemInfo: SystemInfo | SystemInfo[] | null;
  containerHistory: Record<string, ContainerHistory>;
}) {
  // Build per-device host RAM lookup for detecting uncapped containers
  const sysDevices: SystemInfo[] = systemInfo
    ? Array.isArray(systemInfo)
      ? systemInfo
      : [systemInfo]
    : [];
  const hostRamByDevice: Record<string, number> = {};
  for (const deviceInfo of sysDevices) {
    hostRamByDevice[deviceInfo.deviceId] = deviceInfo.totalMemory || 0;
  }

  return [
    {
      key: "name",
      label: "Container",
      sortable: true,
      render: (row: ContainerRow) => (
        <div className={styles['name-cell']}>
          <Container
            size={14}
            strokeWidth={2.6}
            className={`${styles['type-icon']} ${row.healthy ? styles['icon-healthy'] : styles['icon-unhealthy']}`}
          />
          <span className={styles['container-name']}>{row.containerName}</span>
        </div>
      ),
      sortValue: (row: ContainerRow) => row.containerName || "",
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row: ContainerRow) => (
        <span
          className={`${styles['status-indicator']} ${row.healthy ? styles['status-healthy'] : styles['status-down']}`}
          title={row.healthy ? "Healthy" : "Down"}
        >
          {row.healthy ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
        </span>
      ),
      sortValue: (row: ContainerRow) => (row.healthy ? 1 : 0),
    },
    {
      key: "cpu",
      label: "CPU",
      sortable: true,
      render: (row: ContainerRow) => {
        const cpuPercent = row._stats?.cpu?.percent;
        if (cpuPercent == null) return <span className={styles['dim-text']}>—</span>;
        const color = severityColor(cpuPercent);
        return (
          <div className={styles['metric-cell']}>
            <span className={styles['metric-value']} style={{ color }}>
              {formatPercent(cpuPercent, "adaptive")}
            </span>
            <MiniBar percent={cpuPercent} color={color} />
          </div>
        );
      },
      sortValue: (row: ContainerRow) => row._stats?.cpu?.percent ?? -1,
    },
    {
      key: "cpuTrend",
      label: "CPU Trend",
      sortable: false,
      render: (row: ContainerRow) => {
        const history = containerHistory?.[row.containerName]?.cpu;
        if (!history || history.length < 2)
          return <span className={styles['dim-text']}>—</span>;
        return (
          <div className={styles['inline-sparkline']}>
            <ChartLineComponent
              data={history}
              color="#10b981"
              maxValue={100}
              height={24}
              historyMax={HISTORY_MAX}
              showGrid
              formatValue={(value: number) => formatPercent(value, "adaptive")}
            />
          </div>
        );
      },
    },
    {
      key: "ram",
      label: "RAM",
      sortable: true,
      render: (row: ContainerRow) => {
        const memoryStats = row._stats?.memory;
        if (!memoryStats) return <span className={styles['dim-text']}>—</span>;
        const hostRam = hostRamByDevice[row.device || ""] || 0;
        const isCapped =
          memoryStats.limit > 0 &&
          hostRam > 0 &&
          memoryStats.limit < hostRam * 0.99;
        const percentage = isCapped
          ? (memoryStats.used / memoryStats.limit) * 100
          : memoryStats.percent;
        const color = severityColor(percentage, [60, 85]);
        return (
          <div className={styles['metric-cell']}>
            <span className={styles['metric-value']} style={{ color }}>
              {formatBytes(memoryStats.used)}
              <span className={styles['metric-limit']}>
                {" "}
                / {isCapped ? formatBytes(memoryStats.limit) : "∞"}
              </span>
            </span>
            <MiniBar percent={percentage} color={color} />
          </div>
        );
      },
      sortValue: (row: ContainerRow) => row._stats?.memory?.used ?? -1,
    },
    {
      key: "ramTrend",
      label: "RAM Trend",
      sortable: false,
      render: (row: ContainerRow) => {
        const history = containerHistory?.[row.containerName]?.mem;
        if (!history || history.length < 2)
          return <span className={styles['dim-text']}>—</span>;
        const maximumValue = row._stats?.memory?.limit || Math.max(...history, 1);
        return (
          <div className={styles['inline-sparkline']}>
            <ChartLineComponent
              data={history}
              color="#3b82f6"
              maxValue={maximumValue}
              height={24}
              historyMax={HISTORY_MAX}
              showGrid
              formatValue={(value: number) => formatBytes(value)}
            />
          </div>
        );
      },
    },
    {
      key: "netio",
      label: "Net I/O",
      sortable: true,
      render: (row: ContainerRow) => {
        const networkStats = row._stats?.network;
        if (!networkStats || (networkStats.rx === 0 && networkStats.tx === 0))
          return <span className={styles['dim-text']}>—</span>;
        return (
          <div className={styles['input-output-cell']}>
            <span className={styles['input-output-compact']}>
              <span className={styles['input-output-arrow']}>↓</span>
              {formatBytes(networkStats.rx)}
            </span>
            <span className={styles['input-output-compact']}>
              <span className={styles['input-output-arrow']}>↑</span>
              {formatBytes(networkStats.tx)}
            </span>
          </div>
        );
      },
      sortValue: (row: ContainerRow) =>
        (row._stats?.network?.rx || 0) + (row._stats?.network?.tx || 0),
    },

    {
      key: "uptime",
      label: "Uptime",
      sortable: true,
      render: (row: ContainerRow) => {
        const created = row._stats?.created;
        if (!created) return <span className={styles['dim-text']}>—</span>;
        return (
          <BadgeComponent
            type="dateTime"
            date={created * 1000}
            showIcon={false}
          />
        );
      },
      sortValue: (row: ContainerRow) => row._stats?.created ?? Infinity,
    },
    {
      key: "visibility",
      label: "Visibility",
      sortable: true,
      render: (row: ContainerRow) =>
        row.visibility ? (
          <BadgeComponent
            type="visibility"
            visibility={row.visibility}
            icons={{ Globe, Lock }}
          />
        ) : null,
      sortValue: (row: ContainerRow) => row.visibility || "",
    },
    {
      key: "port",
      label: "Port",
      sortable: true,
      render: (row: ContainerRow) =>
        row.port ? <BadgeComponent type="port" port={row.port} /> : null,
      sortValue: (row: ContainerRow) => row.port || 0,
    },
    {
      key: "address",
      label: "Address",
      sortable: true,
      description: "Internal IP and port (socket address)",
      render: (row: ContainerRow) =>
        row.url ? (
          <BadgeComponent type="address" address={row.url} link />
        ) : null,
      sortValue: (row: ContainerRow) => row.url || "",
    },
    {
      key: "domain",
      label: "Domain",
      sortable: true,
      description: "Registrable root domain",
      render: (row: ContainerRow) => {
        const root = getRootDomain(row.domain);
        return root ? (
          <BadgeComponent type="domain" domain={row.domain} icons={{ Globe }} />
        ) : null;
      },
      sortValue: (row: ContainerRow) => getRootDomain(row.domain),
    },
    {
      key: "response",
      label: "Response",
      sortable: true,
      render: (row: ContainerRow) =>
        row.responseTimeMs != null ? (
          <BadgeComponent
            type="responseTime"
            ms={row.responseTimeMs}
            formatter={formatDuration}
          />
        ) : null,
      sortValue: (row: ContainerRow) => row.responseTimeMs ?? Infinity,
    },
    {
      key: "device",
      label: "Device",
      sortable: true,
      render: (row: ContainerRow) =>
        row.device ? (
          <BadgeComponent
            type="device"
            device={row.device}
            icons={{ Server }}
          />
        ) : null,
      sortValue: (row: ContainerRow) => row.device || "",
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      align: "right",
      render: (row: ContainerRow) => (
        <ActionCell
          service={row}
          onRestart={onRestart}
          onStop={onStop}
          onStart={onStart}
          onRollback={onRollback}
          rollbackAvailable={row.restartable && !!rollbackMap[row.id]}
        />
      ),
    },
  ];
}

// ── Main Component ──────────────────────────────────────────────

export default function ContainerStatsComponent() {
  const [containerRows, setContainerRows] = useState<ContainerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemInfo, setSystemInfo] = useState<
    SystemInfo | SystemInfo[] | null
  >(null);
  const [containerStats, setContainerStats] = useState<
    Record<string, Partial<ContainerStats>>
  >({});
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<number[]>([]);
  const [selectedContainer, setSelectedContainer] =
    useState<ContainerRow | null>(null);
  const [activeDevices, setActiveDevices] = useState<string[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [searchQuery, setSearchQuery] = useState("");

  // Load view preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("portal-container-view-mode");
    if (saved === "table" || saved === "cards") {
      setViewMode(saved);
    }
  }, []);

  const handleToggleViewMode = (mode: "table" | "cards") => {
    setViewMode(mode);
    localStorage.setItem("portal-container-view-mode", mode);
  };

  const [rollbackMap, setRollbackMap] = useState<Record<string, boolean>>({});
  const didFetch = useRef(false);
  const [containerHistory, setContainerHistory] = useState<
    Record<string, { cpu: number[]; mem: number[] }>
  >({});

  // Fetch container stats and project registry, then join them
  const fetchData = useCallback(async () => {
    try {
      const [containerRes, servicesRes] = await Promise.all([
        ApiService.getContainerStats(),
        ApiService.getServices(),
      ]);

      const containers = containerRes?.containers || [];
      const services = servicesRes?.services || [];

      const projectByDocker: Record<string, PortalService> = {};
      for (const service of services) {
        if (service.dockerProject) {
          projectByDocker[service.dockerProject] = service;
        }
      }

      // Merge container data with project metadata + stats
      const rows: ContainerRow[] = containers.map(
        (container: Record<string, unknown>) => {
          const matchedService = projectByDocker[container.name as string] || null;

          let type: "client" | "service" | "bot";
          const rawType = (matchedService?.projectType || "").toLowerCase();
          const nameLower = (container.name as string).toLowerCase();
          if (rawType === "client" || nameLower.includes("client")) {
            type = "client";
          } else if (rawType === "bot" || nameLower.includes("bot")) {
            type = "bot";
          } else {
            type = "service";
          }

          return {
            // Container identity
            id:
              matchedService?.id ||
              `${(container.device as string) || "unknown"}-${container.name}`,
            containerName: container.name as string,
            // Project registry fields
            healthy: matchedService?.healthy ?? container.state === "running",
            registered: !!matchedService,
            visibility: matchedService?.visibility || null,
            port: matchedService?.port || null,
            url: matchedService?.url || null,
            domain: matchedService?.domain || null,
            responseTimeMs: matchedService?.responseTimeMs ?? null,
            device: (container.device as string) || matchedService?.device || null,
            restartable: matchedService?.restartable ?? false,
            controllable: true,
            dockerProject: container.name as string,
            projectType: type,
            // Per-container Docker stats (for table columns + drawer)
            _stats: {
              cpu: container.cpu,
              cpuThrottling: container.cpuThrottling,
              memory: container.memory,
              memoryDetail: container.memoryDetail,
              network: container.network,
              blockIO: container.blockIO,
              pids: container.pids,
              // Container metadata
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
        },
      );

      // Sort by name
      rows.sort((firstItem, secondItem) => firstItem.containerName.localeCompare(secondItem.containerName));

      setContainerRows(rows);

      // Build stats map for summary cards
      const statsMap: Record<string, Partial<ContainerStats>> = {};
      for (const container of containers) {
        statsMap[container.name as string] = {
          cpu: container.cpu,
          memory: container.memory,
          network: container.network,
          blockIO: container.blockIO,
          pids: container.pids,
        };
      }
      setContainerStats(statsMap);

      // Accumulate sparkline history for CPU and memory
      const totalCpu = containers.reduce(
        (sum: number, container: Partial<ContainerStats>) =>
          sum + (container.cpu?.percent || 0),
        0,
      );
      const totalMemory = containers.reduce(
        (sum: number, container: Partial<ContainerStats>) =>
          sum + (container.memory?.used || 0),
        0,
      );
      setCpuHistory((previousState) => [...previousState.slice(-(HISTORY_MAX - 1)), totalCpu]);
      setMemoryHistory((previousState) => [...previousState.slice(-(HISTORY_MAX - 1)), totalMemory]);

      // Accumulate per-container sparkline history
      setContainerHistory((previousState) => {
        const next = { ...previousState };
        for (const container of containers) {
          const existing = next[container.name] || { cpu: [], mem: [] };
          next[container.name] = {
            cpu: [
              ...existing.cpu.slice(-(HISTORY_MAX - 1)),
              container.cpu?.percent || 0,
            ],
            mem: [
              ...existing.mem.slice(-(HISTORY_MAX - 1)),
              container.memory?.used || 0,
            ],
          };
        }
        return next;
      });

      // Update selected container if drawer is open
      setSelectedContainer((previousState) => {
        if (!previousState) return null;
        return rows.find((r) => r.id === previousState.id) || null;
      });
    } catch {
      // Don't break the page on error
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch system info for container count breakdown
  const fetchSystemInfo = useCallback(async () => {
    try {
      const systemInfoResponse = await ApiService.getSystemInfo().catch(() => null);
      setSystemInfo(systemInfoResponse as SystemInfo | SystemInfo[] | null);
    } catch {
      // Supplementary — silently ignore
    }
  }, []);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    fetchData();
    fetchSystemInfo();

    // Seed sparklines from persistent MongoDB metrics so trends are
    // immediately visible instead of building from zero on each visit.
    (async () => {
      try {
        const metricsResponse = await ApiService.getContainerMetrics({
          range: "1h",
          limit: HISTORY_MAX,
        });
        if (!metricsResponse?.containers) return;

        // Build per-container history from persistent data
        const seededHistory: Record<string, { cpu: number[]; mem: number[] }> =
          {};
        let totalCpuPoints: number[] = [];
        let totalMemoryPoints: number[] = [];

        // Find the longest series length across all containers
        let maxLength = 0;
        for (const [_name, data] of Object.entries(metricsResponse.containers) as [
          string,
          ContainerMetricsData,
        ][]) {
          if (data.points?.length > maxLength) maxLength = data.points.length;
        }

        // Initialize totalCpu/Mem arrays with zeroes
        totalCpuPoints = new Array(maxLength).fill(0);
        totalMemoryPoints = new Array(maxLength).fill(0);

        for (const [_name, data] of Object.entries(metricsResponse.containers) as [
          string,
          ContainerMetricsData,
        ][]) {
          if (!data.points || data.points.length === 0) continue;

          const cpuPoints = data.points.map((point) => point.cpu);
          const memoryPoints = data.points.map((point) => point.mem);
          seededHistory[_name] = { cpu: cpuPoints, mem: memoryPoints };

          // Accumulate totals — right-align shorter series
          const offset = maxLength - data.points.length;
          for (let i = 0; i < data.points.length; i++) {
            totalCpuPoints[offset + i] += data.points[i].cpu || 0;
            totalMemoryPoints[offset + i] += data.points[i].mem || 0;
          }
        }

        // Only seed if we got meaningful data
        if (Object.keys(seededHistory).length > 0) {
          setContainerHistory((previousState) => {
            // Don't overwrite if live polling has already populated data
            if (Object.keys(previousState).length > 0) return previousState;
            return seededHistory;
          });
          setCpuHistory((previousState) => (previousState.length > 2 ? previousState : totalCpuPoints));
          setMemoryHistory((previousState) => (previousState.length > 2 ? previousState : totalMemoryPoints));
        }
      } catch {
        // Non-critical — sparklines will just build from live data
      }
    })();
  }, [fetchData, fetchSystemInfo]);

  // Poll every 5s (includes systemInfo retry if initial call was slow)
  useEffect(() => {
    const timer = setInterval(() => {
      fetchData();
      if (!systemInfo) fetchSystemInfo();
    }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchData, fetchSystemInfo, systemInfo]);

  const handleRestart = async (serviceId: string, row: ContainerRow) => {
    try {
      if (row?.registered && row?.restartable) {
        await ApiService.restartService(serviceId);
      } else {
        await ApiService.restartContainer(row.containerName, row.device || "");
      }
      setTimeout(fetchData, ACTION_COOLDOWN_MILLISECONDS);
    } catch (error) {
      console.error("Restart failed:", error);
    }
  };

  const handleStop = async (serviceId: string, row: ContainerRow) => {
    try {
      if (row?.registered && row?.restartable) {
        await ApiService.stopService(serviceId);
      } else {
        await ApiService.stopContainer(row.containerName, row.device || "");
      }
      setTimeout(fetchData, ACTION_COOLDOWN_MILLISECONDS);
    } catch (error) {
      console.error("Stop failed:", error);
    }
  };

  const handleStart = async (serviceId: string, row: ContainerRow) => {
    try {
      if (row?.registered && row?.restartable) {
        await ApiService.startService(serviceId);
      } else {
        await ApiService.startContainer(row.containerName, row.device || "");
      }
      setTimeout(fetchData, ACTION_COOLDOWN_MILLISECONDS);
    } catch (error) {
      console.error("Start failed:", error);
    }
  };

  const handleRollback = async (serviceId: string) => {
    try {
      await ApiService.rollbackService(serviceId);
      setTimeout(fetchData, ACTION_COOLDOWN_MILLISECONDS);
      // Refresh rollback availability
      setTimeout(
        () => checkRollbackAvailability(containerRows),
        HIGHLIGHT_DURATION_MILLISECONDS,
      );
    } catch (error) {
      console.error("Rollback failed:", error);
    }
  };

  // Check rollback availability for all restartable containers
  const checkRollbackAvailability = useCallback(
    async (rows: ContainerRow[]) => {
      const restartableIds = rows.filter((r) => r.restartable).map((r) => r.id);

      if (restartableIds.length === 0) return;

      const results = await Promise.allSettled(
        restartableIds.map(async (id) => {
          const rollbackStatusResponse = await ApiService.getRollbackStatus(id);
          return { id, available: rollbackStatusResponse.available === true };
        }),
      );

      const map: Record<string, boolean> = {};
      for (const result of results) {
        if (result.status === "fulfilled") {
          map[result.value.id] = result.value.available;
        }
      }
      setRollbackMap(map);
    },
    [],
  );

  // ── Derive unique device IDs for filter pills ─────────────────
  const deviceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of containerRows) {
      if (row.device) ids.add(row.device);
    }
    return [...ids].sort();
  }, [containerRows]);

  // ── Filter rows by active device, container type, and search query ──
  const filteredRows = useMemo(() => {
    let rows = containerRows;
    if (activeDevices.length > 0) {
      rows = rows.filter((r) => r.device && activeDevices.includes(r.device));
    }
    if (activeTypes.length > 0) {
      rows = rows.filter((r) => r.projectType && activeTypes.includes(r.projectType));
    }
    if (searchQuery.trim()) {
      const normalizedQuery = searchQuery.toLowerCase().trim();
      rows = rows.filter((r) => {
        const nameMatch = r.containerName
          .toLowerCase()
          .includes(normalizedQuery);
        const deviceMatch = r.device
          ? r.device.toLowerCase().includes(normalizedQuery)
          : false;
        const typeMatch = r.projectType
          ? r.projectType.toLowerCase().includes(normalizedQuery)
          : false;
        const portMatch = r.port
          ? String(r.port).includes(normalizedQuery)
          : false;
        const domainMatch = r.domain
          ? r.domain.toLowerCase().includes(normalizedQuery)
          : false;
        return (
          nameMatch || deviceMatch || typeMatch || portMatch || domainMatch
        );
      });
    }
    return rows;
  }, [containerRows, activeDevices, activeTypes, searchQuery]);

  const columns = buildColumns({
    onRestart: handleRestart,
    onStop: handleStop,
    onStart: handleStart,
    onRollback: handleRollback,
    rollbackMap,
    systemInfo,
    containerHistory,
  });
  const healthyCount = filteredRows.filter((r) => r.healthy).length;

  // Check rollback availability once data loads
  useEffect(() => {
    if (containerRows.length > 0) {
      checkRollbackAvailability(containerRows);
    }
  }, [containerRows, checkRollbackAvailability]);

  // ── Container-centric summary computed values ──────────────────
  const filteredStats = useMemo(() => {
    if (activeDevices.length === 0 && activeTypes.length === 0 && !searchQuery.trim())
      return Object.values(containerStats);
    return filteredRows
      .map((r) => containerStats[r.containerName])
      .filter(Boolean);
  }, [containerStats, activeDevices, activeTypes, searchQuery, filteredRows]);

  const avgCpuUsage =
    filteredStats.length > 0
      ? filteredStats.reduce((sum, container) => sum + (container.cpu?.percent || 0), 0) /
        filteredStats.length
      : 0;
  const totalCpuUsage = filteredStats.reduce(
    (sum, container) => sum + (container.cpu?.percent || 0),
    0,
  );
  const totalMemoryUsed = filteredStats.reduce(
    (sum, container) => sum + (container.memory?.used || 0),
    0,
  );

  const rowsWithResponseTime = filteredRows.filter(
    (row) => row.responseTimeMs !== null,
  );
  const averageResponseTime =
    rowsWithResponseTime.length > 0
      ? Math.round(
          rowsWithResponseTime.reduce(
            (sum, row) => sum + (row.responseTimeMs ?? 0),
            0,
          ) / rowsWithResponseTime.length
        )
      : 0;


  // Use actual host RAM from systemInfo instead of summing per-container cgroup limits.
  // Fallback: deduplicate per-device cgroup limits (each container reports host RAM as its limit).
  const totalMemoryLimit = useMemo((): number => {
    if (systemInfo) {
      const devices: SystemInfo[] = Array.isArray(systemInfo)
        ? systemInfo
        : [systemInfo];
      if (activeDevices.length > 0) {
        return devices
          .filter((deviceInfo) => activeDevices.includes(deviceInfo.deviceId))
          .reduce((sum, deviceInfo) => sum + (deviceInfo.totalMemory || 0), 0);
      }
      return devices.reduce((sum, deviceInfo) => sum + (deviceInfo.totalMemory || 0), 0);
    }
    // Fallback: take max memory.limit per device (cgroup limit = host RAM for uncapped containers)
    const perDevice: Record<string, number> = {};
    for (const row of filteredRows) {
      const dev = row.device || "_default";
      const limit = row._stats?.memory?.limit || 0;
      perDevice[dev] = Math.max(perDevice[dev] || 0, limit);
    }
    return (Object.values(perDevice) as number[]).reduce(
      (sum, value) => sum + value,
      0,
    );
  }, [systemInfo, activeDevices, filteredRows]);

  const memoryPercent =
    totalMemoryLimit > 0 ? (totalMemoryUsed / totalMemoryLimit) * 100 : 0;
  const totalNetRx = filteredRows.reduce(
    (sum, r) => sum + (r._stats?.network?.rx || 0),
    0,
  );
  const totalNetTx = filteredRows.reduce(
    (sum, r) => sum + (r._stats?.network?.tx || 0),
    0,
  );

  const getRowClassName = (row: ContainerRow) =>
    row.healthy ? styles['status-row-healthy'] : styles['status-row-unhealthy'];

  // Build full stats object for drawer
  const selectedStats = selectedContainer?._stats || null;

  if (loading) {
    return (
      <div className={styles['section']}>
        <LoadingIndicatorComponent
          size="small"
          label="Querying containers…"
          className="is-loading-centered-state"
        />
      </div>
    );
  }

  return (
    <div className={`container-stats-component ${styles['section']}`}>
      <PageHeaderComponent
        sticky={false}
        title="Containers"
        subtitle={`${healthyCount} of ${filteredRows.length} containers healthy · polling every 5s`}
      />

      {/* ── Filters & View Toggle ────────────────────────────────── */}
      <div className={styles['filters-bar']}>
        <div className={styles['filters-container']}>
          {/* ── Search Input ───────────────────────────────────────── */}
          <div className={styles['search-wrapper']}>
            <SearchInputComponent
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search containers..."
              compact
            />
          </div>

          {/* ── Device Filter ──────────────────────────────────────── */}
          {deviceIds.length > 1 && (
            <SelectComponent
              multiple
              label="Host"
              value={activeDevices}
              options={deviceIds.map((deviceId) => ({
                value: deviceId,
                label: deviceId,
              }))}
              onChange={setActiveDevices}
              allLabel="All Hosts"
            />
          )}

          {/* ── Type Filter ────────────────────────────────────────── */}
          <SelectComponent
            multiple
            label="Type"
            value={activeTypes}
            options={(["client", "service", "bot"] as const).map((type) => ({
              value: type,
              label: `${type}s`,
            }))}
            onChange={setActiveTypes}
            allLabel="All Types"
          />
        </div>

        {/* ── View Mode Switcher ──────────────────────────────────── */}
        <div className={styles['view-mode-toggle']}>
          <button
            className={`${styles['toggle-button']} ${viewMode === "table" ? styles['toggle-btn-active'] : ""}`}
            onClick={() => handleToggleViewMode("table")}
            title="Table View"
          >
            <List size={14} strokeWidth={2.4} />
          </button>
          <button
            className={`${styles['toggle-button']} ${viewMode === "cards" ? styles['toggle-btn-active'] : ""}`}
            onClick={() => handleToggleViewMode("cards")}
            title="Cards View"
          >
            <LayoutGrid size={14} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      {/* ── Infrastructure Summary Cards ──────────────────────────── */}
      {!loading && (
        <div className={styles['summary-grid']}>
          <div className={styles['stat-card']}>
            <div
              className={styles['stat-card-icon']}
              style={{ color: "#6366f1", background: "rgba(99,102,241,0.08)" }}
            >
              <Server size={18} strokeWidth={2} />
            </div>
            <div className={styles['stat-card-content']}>
              <span className={styles['stat-card-value']}>
                {filteredRows.length}
              </span>
              <span className={styles['stat-card-label']}>Containers</span>
              <span className={styles['stat-card-sub']}>
                {activeDevices.length > 0
                  ? `${healthyCount} healthy on ${activeDevices.join(", ")}`
                  : systemInfo
                    ? `${Array.isArray(systemInfo) ? systemInfo.reduce((sum, deviceInfo) => sum + (deviceInfo.containersRunning || 0), 0) : systemInfo.containersRunning || 0} running · ${Array.isArray(systemInfo) ? systemInfo.reduce((sum, deviceInfo) => sum + (deviceInfo.containersStopped || 0), 0) : systemInfo.containersStopped || 0} stopped`
                    : `${healthyCount} healthy`}
              </span>
            </div>
          </div>

          <div className={`${styles['stat-card']} ${styles['stat-card-with-chart']}`}>
            <div className={styles['stat-card-header']}>
              <div
                className={styles['stat-card-icon']}
                style={{
                  color: "#10b981",
                  background: "rgba(16,185,129,0.08)",
                }}
              >
                <Cpu size={18} strokeWidth={2} />
              </div>
              <div className={styles['stat-card-content']}>
                <span
                  className={styles['stat-card-value']}
                  style={{ color: severityColor(avgCpuUsage) }}
                >
                  {totalCpuUsage.toFixed(1)}%
                </span>
                <span className={styles['stat-card-label']}>CPU Usage</span>
                <span className={styles['stat-card-sub']}>
                  {avgCpuUsage.toFixed(1)}% avg per container
                </span>
              </div>
            </div>
            <ChartLineComponent
              data={cpuHistory}
              color="#10b981"
              maxValue={100}
              height={48}
              historyMax={HISTORY_MAX}
              showGrid
              formatValue={(value: number) => formatPercent(value, "adaptive")}
            />
          </div>

          <div className={`${styles['stat-card']} ${styles['stat-card-with-chart']}`}>
            <div className={styles['stat-card-header']}>
              <div
                className={styles['stat-card-icon']}
                style={{
                  color: "#3b82f6",
                  background: "rgba(59,130,246,0.08)",
                }}
              >
                <MemoryStick size={18} strokeWidth={2} />
              </div>
              <div className={styles['stat-card-content']}>
                <span
                  className={styles['stat-card-value']}
                  style={{ color: severityColor(memoryPercent, [60, 85]) }}
                >
                  {formatBytes(totalMemoryUsed)}
                </span>
                <span className={styles['stat-card-label']}>Memory Used</span>
                <span className={styles['stat-card-sub']}>
                  {totalMemoryLimit
                    ? `${formatPercent(memoryPercent, "adaptive")} of ${formatBytes(totalMemoryLimit)} total`
                    : "—"}
                </span>
              </div>
            </div>
            <ChartLineComponent
              data={memoryHistory}
              color="#3b82f6"
              maxValue={totalMemoryLimit || 1}
              height={48}
              historyMax={HISTORY_MAX}
              showGrid
              formatValue={(value: number) => formatBytes(value)}
            />
          </div>

          <div className={styles['stat-card']}>
            <div
              className={styles['stat-card-icon']}
              style={{ color: "#a855f7", background: "rgba(168,85,247,0.08)" }}
            >
              <Network size={18} strokeWidth={2} />
            </div>
            <div className={styles['stat-card-content']}>
              <span className={styles['stat-card-value']}>
                {formatBytes(totalNetRx + totalNetTx)}
              </span>
              <span className={styles['stat-card-label']}>Network I/O</span>
              <span className={styles['stat-card-sub']}>
                ↓ {formatBytes(totalNetRx)} rx · ↑ {formatBytes(totalNetTx)} tx
              </span>
            </div>
          </div>

          <div className={styles['stat-card']}>
            <div
              className={styles['stat-card-icon']}
              style={{ color: "#f97316", background: "rgba(249,115,22,0.08)" }}
            >
              <Clock size={18} strokeWidth={2} />
            </div>
            <div className={styles['stat-card-content']}>
              <span className={styles['stat-card-value']}>
                {averageResponseTime > 0
                  ? formatDuration(averageResponseTime)
                  : "—"}
              </span>
              <span className={styles['stat-card-label']}>Avg Response</span>
              <span className={styles['stat-card-sub']}>
                {rowsWithResponseTime.length > 0
                  ? `Based on ${rowsWithResponseTime.length} active service${rowsWithResponseTime.length === 1 ? "" : "s"}`
                  : "No services with active responses"}
              </span>
            </div>
          </div>
        </div>
      )}

      {filteredRows.length === 0 ? (
        <div className={styles['empty-state']}>
          No containers found{activeDevices.length > 0 ? ` on ${activeDevices.join(", ")}` : ""}
        </div>
      ) : viewMode === "table" ? (
        <TableComponent
          title="Containers"
          subtitle={`${filteredRows.length} containers · ${healthyCount} healthy`}
          columns={columns}
          data={filteredRows}
          getRowKey={(row: ContainerRow) => row.id}
          emptyText="No containers found"
          getRowClassName={getRowClassName}
          onRowClick={(row: ContainerRow) => setSelectedContainer(row)}
          activeRowKey={selectedContainer?.id}
          storageKey="container-table"
          sortPinBottom={(row: ContainerRow) => !row.healthy}
        />
      ) : (
        /* ── Cards Grid View ────────────────────────────────────── */
        <div className={styles['cards-grid']}>
          {filteredRows.map((row) => (
            <div
              key={row.id}
              className={`${styles['container-card']} ${row.healthy ? styles['card-healthy'] : styles['card-unhealthy']} ${selectedContainer?.id === row.id ? styles['card-active'] : ""}`}
              onClick={() => setSelectedContainer(row)}
            >
              <div className={styles['card-header']}>
                <div className={styles['card-title-section']}>
                  <Container
                    size={14}
                    strokeWidth={2.6}
                    className={`${styles['type-icon']} ${row.healthy ? styles['icon-healthy'] : styles['icon-unhealthy']}`}
                  />
                  <span className={styles['card-name']}>{row.containerName}</span>
                </div>
                <div className={styles['card-badge-section']}>
                  <BadgeComponent type="status" healthy={row.healthy} />
                  {row.device && (
                    <span className={styles['card-device-pill']}>{row.device}</span>
                  )}
                </div>
              </div>

              <div className={styles['card-meta']}>
                {row.port && <BadgeComponent type="port" port={row.port} />}
                {row.visibility && (
                  <BadgeComponent
                    type="visibility"
                    visibility={row.visibility}
                    icons={{ Globe, Lock }}
                  />
                )}
                {row.domain && (
                  <BadgeComponent
                    type="domain"
                    domain={row.domain}
                    icons={{ Globe }}
                  />
                )}
              </div>

              {row.projectType === "client" && row.healthy && row.domain && (
                <div className={styles['card-preview-container']}>
                  <iframe
                    src={`https://${row.domain}`}
                    className={styles['card-preview-iframe']}
                    title={`Preview of ${row.domain}`}
                    loading="lazy"
                    tabIndex={-1}
                    sandbox="allow-scripts allow-same-origin"
                  />
                  <div className={styles['card-preview-overlay']} />
                </div>
              )}

              <div className={styles['card-metrics-grid']}>
                <div className={styles['card-metric']}>
                  <div className={styles['card-metric-header']}>
                    <Cpu size={12} className={styles['metric-icon-cpu']} />
                    <span className={styles['card-metric-label']}>CPU</span>
                    <span className={styles['card-metric-value']}>
                      {row._stats?.cpu?.percent != null
                        ? formatPercent(row._stats.cpu.percent, "adaptive")
                        : "—"}
                    </span>
                  </div>
                  {row._stats?.cpu?.percent != null && (
                    <MiniBar
                      percent={row._stats.cpu.percent}
                      color={severityColor(row._stats.cpu.percent)}
                    />
                  )}
                </div>

                <div className={styles['card-metric']}>
                  <div className={styles['card-metric-header']}>
                    <MemoryStick size={12} className={styles['metric-icon-ram']} />
                    <span className={styles['card-metric-label']}>RAM</span>
                    <span className={styles['card-metric-value']}>
                      {row._stats?.memory
                        ? formatBytes(row._stats.memory.used)
                        : "—"}
                    </span>
                  </div>
                  {row._stats?.memory && (
                    <MiniBar
                      percent={
                        row._stats.memory.limit > 0
                          ? (row._stats.memory.used / row._stats.memory.limit) *
                            100
                          : row._stats.memory.percent
                      }
                      color={severityColor(
                        row._stats.memory.limit > 0
                          ? (row._stats.memory.used / row._stats.memory.limit) *
                              100
                          : row._stats.memory.percent,
                        [60, 85],
                      )}
                    />
                  )}
                </div>
              </div>

              <div className={styles['card-footer']}>
                <div className={styles['card-uptime']}>
                  {row._stats?.created ? (
                    <>
                      <span className={styles['uptime-label']}>Uptime:</span>
                      <BadgeComponent
                        type="dateTime"
                        date={row._stats.created * 1000}
                        showIcon={false}
                      />
                    </>
                  ) : (
                    "—"
                  )}
                </div>
                <ActionCell
                  service={row}
                  onRestart={handleRestart}
                  onStop={handleStop}
                  onStart={handleStart}
                  onRollback={handleRollback}
                  rollbackAvailable={row.restartable && !!rollbackMap[row.id]}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <DrawerComponent
        open={!!selectedContainer}
        onClose={() => setSelectedContainer(null)}
        title={selectedContainer?.containerName || "Container Detail"}
        width={540}
        headerActions={
          selectedContainer ? (
            <ActionCell
              service={selectedContainer}
              onRestart={handleRestart}
              onStop={handleStop}
              onStart={handleStart}
              onRollback={handleRollback}
              rollbackAvailable={
                selectedContainer?.restartable &&
                !!rollbackMap[selectedContainer.id]
              }
            />
          ) : null
        }
      >
        {selectedContainer && (
          <ContainerDetailPanel
            container={selectedContainer}
            stats={selectedStats}
          />
        )}
      </DrawerComponent>
    </div>
  );
}
