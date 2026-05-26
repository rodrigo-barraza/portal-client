"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
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
} from "lucide-react";
import {
  BadgeComponent,
  DrawerComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
  ChartLineComponent,
  TableComponent,
} from "@rodrigo-barraza/components-library";
import {
  formatBytes,
  formatDuration,
  formatPercent,
  getRootDomain,
  ACTION_COOLDOWN_MS,
  ACTION_COOLDOWN_LONG_MS,
  HIGHLIGHT_DURATION_MS,
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

function severityColor(pct: number, thresholds: [number, number] = [40, 80]): string {
  if (pct > thresholds[1]) return "var(--color-danger)";
  if (pct > thresholds[0]) return "var(--color-warning)";
  return "var(--color-success)";
}

// ── Inline Percent Bar ──────────────────────────────────────────
function MiniBar({ percent, color }: { percent: number; color: string }) {
  const clamped = Math.min(percent, 100);
  return (
    <div className={styles.miniBarTrack}>
      <div
        className={styles.miniBarFill}
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
    <div className={styles.actionRow}>
      {isHealthy ? (
        <button
          className={`${styles.actionButton} ${styles.stopButton} ${stopping ? styles.actionBtnLoading : ""}`}
          disabled={stopping || restarting || rollingBack}
          onClick={async (e) => {
            e.stopPropagation();
            setStopping(true);
            try {
              await onStop?.(service.id, service);
            } finally {
              setTimeout(() => setStopping(false), ACTION_COOLDOWN_MS);
            }
          }}
          title="Stop"
        >
          <Square size={9} strokeWidth={2.6} />
        </button>
      ) : (
        <button
          className={`${styles.actionButton} ${styles.startButton} ${starting ? styles.actionBtnLoading : ""}`}
          disabled={starting || restarting || rollingBack}
          onClick={async (e) => {
            e.stopPropagation();
            setStarting(true);
            try {
              await onStart?.(service.id, service);
            } finally {
              setTimeout(() => setStarting(false), ACTION_COOLDOWN_MS);
            }
          }}
          title="Start"
        >
          <Play size={9} strokeWidth={2.6} fill="currentColor" />
        </button>
      )}

      <Link
        href={`/logs?container=${service.dockerProject || service.id}`}
        className={`${styles.actionButton} ${styles.logsButton}`}
        title="Logs"
        onClick={(e) => e.stopPropagation()}
      >
        <ScrollText size={9} strokeWidth={2.6} />
      </Link>

      {rollbackAvailable && (
        <button
          className={`${styles.actionButton} ${styles.rollbackButton} ${rollingBack ? styles.actionBtnLoading : ""}`}
          disabled={rollingBack || restarting || stopping || starting}
          onClick={async (e) => {
            e.stopPropagation();
            setRollingBack(true);
            try {
              await onRollback?.(service.id, service);
            } finally {
              setTimeout(() => setRollingBack(false), ACTION_COOLDOWN_LONG_MS);
            }
          }}
          title="Rollback to previous build"
        >
          <Undo2 size={9} strokeWidth={2.6} />
        </button>
      )}

      <button
        className={`${styles.actionButton} ${styles.restartButton} ${restarting ? styles.actionBtnLoading : ""}`}
        disabled={restarting || stopping || starting || rollingBack}
        onClick={async (e) => {
          e.stopPropagation();
          setRestarting(true);
          try {
            await onRestart?.(service.id, service);
          } finally {
            setTimeout(() => setRestarting(false), ACTION_COOLDOWN_MS);
          }
        }}
        title="Restart"
      >
        <RotateCcw
          size={9}
          strokeWidth={2.6}
          className={restarting ? styles.spin : ""}
        />
      </button>
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
  for (const d of sysDevices) {
    hostRamByDevice[d.deviceId] = d.totalMemory || 0;
  }

  return [
    {
      key: "name",
      label: "Container",
      sortable: true,
      render: (row: ContainerRow) => (
        <div className={styles.nameCell}>
          <Container
            size={14}
            strokeWidth={2.6}
            className={`${styles.typeIcon} ${row.healthy ? styles.iconHealthy : styles.iconUnhealthy}`}
          />
          <span className={styles.containerName}>{row.containerName}</span>
        </div>
      ),
      sortValue: (row: ContainerRow) => row.containerName || "",
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row: ContainerRow) => <BadgeComponent type="status" healthy={row.healthy} />,
      sortValue: (row: ContainerRow) => (row.healthy ? 1 : 0),
    },
    {
      key: "cpu",
      label: "CPU",
      sortable: true,
      render: (row: ContainerRow) => {
        const cpuPct = row._stats?.cpu?.percent;
        if (cpuPct == null) return <span className={styles.dimText}>—</span>;
        const color = severityColor(cpuPct);
        return (
          <div className={styles.metricCell}>
            <span className={styles.metricValue} style={{ color }}>
              {formatPercent(cpuPct, "adaptive")}
            </span>
            <MiniBar percent={cpuPct} color={color} />
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
          return <span className={styles.dimText}>—</span>;
        return (
          <div className={styles.inlineSparkline}>
            <ChartLineComponent
              data={history}
              color="#10b981"
              maxValue={100}
              height={24}
              historyMax={HISTORY_MAX}
              showGrid
              formatValue={(v: number) => formatPercent(v, "adaptive")}
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
        const mem = row._stats?.memory;
        if (!mem) return <span className={styles.dimText}>—</span>;
        const hostRam = hostRamByDevice[row.device || ""] || 0;
        const isCapped =
          mem.limit > 0 && hostRam > 0 && mem.limit < hostRam * 0.99;
        const pct = isCapped ? (mem.used / mem.limit) * 100 : mem.percent;
        const color = severityColor(pct, [60, 85]);
        return (
          <div className={styles.metricCell}>
            <span className={styles.metricValue} style={{ color }}>
              {formatBytes(mem.used)}
              <span className={styles.metricLimit}>
                {" "}
                / {isCapped ? formatBytes(mem.limit) : "∞"}
              </span>
            </span>
            <MiniBar percent={pct} color={color} />
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
          return <span className={styles.dimText}>—</span>;
        const maxVal = row._stats?.memory?.limit || Math.max(...history, 1);
        return (
          <div className={styles.inlineSparkline}>
            <ChartLineComponent
              data={history}
              color="#3b82f6"
              maxValue={maxVal}
              height={24}
              historyMax={HISTORY_MAX}
              showGrid
              formatValue={(v: number) => formatBytes(v)}
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
        const net = row._stats?.network;
        if (!net || (net.rx === 0 && net.tx === 0))
          return <span className={styles.dimText}>—</span>;
        return (
          <div className={styles.ioCell}>
            <span className={styles.ioCompact}>
              <span className={styles.ioArrow}>↓</span>
              {formatBytes(net.rx)}
            </span>
            <span className={styles.ioCompact}>
              <span className={styles.ioArrow}>↑</span>
              {formatBytes(net.tx)}
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
        if (!created) return <span className={styles.dimText}>—</span>;
        return (
          <BadgeComponent type="dateTime" date={created * 1000} showIcon={false} />
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
        row.url ? <BadgeComponent type="address" address={row.url} link /> : null,
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
          <BadgeComponent type="device" device={row.device} icons={{ Server }} />
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
  const [systemInfo, setSystemInfo] = useState<SystemInfo | SystemInfo[] | null>(null);
  const [containerStats, setContainerStats] = useState<Record<string, Partial<ContainerStats>>>({});
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<ContainerRow | null>(null);
  const [activeDevice, setActiveDevice] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"client" | "service" | "bot" | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

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
      for (const svc of services) {
        if (svc.dockerProject) {
          projectByDocker[svc.dockerProject] = svc;
        }
      }

      // Merge container data with project metadata + stats
      const rows: ContainerRow[] = containers.map((c: Record<string, unknown>) => {
        const svc = projectByDocker[c.name as string] || null;
        
        let type: "client" | "service" | "bot";
        const rawType = (svc?.projectType || "").toLowerCase();
        const nameLower = (c.name as string).toLowerCase();
        if (rawType === "client" || nameLower.includes("client")) {
          type = "client";
        } else if (rawType === "bot" || nameLower.includes("bot")) {
          type = "bot";
        } else {
          type = "service";
        }

        return {
          // Container identity
          id: svc?.id || `${(c.device as string) || "unknown"}-${c.name}`,
          containerName: c.name as string,
          // Project registry fields
          healthy: svc?.healthy ?? c.state === "running",
          registered: !!svc,
          visibility: svc?.visibility || null,
          port: svc?.port || null,
          url: svc?.url || null,
          domain: svc?.domain || null,
          responseTimeMs: svc?.responseTimeMs ?? null,
          device: (c.device as string) || svc?.device || null,
          restartable: svc?.restartable ?? false,
          controllable: true,
          dockerProject: c.name as string,
          projectType: type,
          // Per-container Docker stats (for table columns + drawer)
          _stats: {
            cpu: c.cpu,
            cpuThrottling: c.cpuThrottling,
            memory: c.memory,
            memoryDetail: c.memoryDetail,
            network: c.network,
            blockIO: c.blockIO,
            pids: c.pids,
            // Container metadata
            image: c.image,
            state: c.state,
            status: c.status,
            created: c.created,
            command: c.command,
            ports: c.ports,
            mounts: c.mounts,
            labels: c.labels,
          },
        };
      });

      // Sort by name
      rows.sort((a, b) =>
        a.containerName.localeCompare(b.containerName),
      );

      setContainerRows(rows);

      // Build stats map for summary cards
      const statsMap: Record<string, Partial<ContainerStats>> = {};
      for (const c of containers) {
        statsMap[(c as Record<string, unknown>).name as string] = {
          cpu: c.cpu,
          memory: c.memory,
          network: c.network,
          blockIO: c.blockIO,
          pids: c.pids,
        };
      }
      setContainerStats(statsMap);

      // Accumulate sparkline history for CPU and memory
      const totalCpu = containers.reduce(
        (sum: number, c: Partial<ContainerStats>) => sum + (c.cpu?.percent || 0),
        0,
      );
      const totalMem = containers.reduce(
        (sum: number, c: Partial<ContainerStats>) => sum + (c.memory?.used || 0),
        0,
      );
      setCpuHistory((prev) => [...prev.slice(-(HISTORY_MAX - 1)), totalCpu]);
      setMemHistory((prev) => [...prev.slice(-(HISTORY_MAX - 1)), totalMem]);

      // Accumulate per-container sparkline history
      setContainerHistory((prev) => {
        const next = { ...prev };
        for (const c of containers) {
          const existing = next[c.name] || { cpu: [], mem: [] };
          next[c.name] = {
            cpu: [
              ...existing.cpu.slice(-(HISTORY_MAX - 1)),
              c.cpu?.percent || 0,
            ],
            mem: [
              ...existing.mem.slice(-(HISTORY_MAX - 1)),
              c.memory?.used || 0,
            ],
          };
        }
        return next;
      });

      // Update selected container if drawer is open
      setSelectedContainer((prev) => {
        if (!prev) return null;
        return rows.find((r) => r.id === prev.id) || null;
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
      const res = await ApiService.getSystemInfo().catch(() => null);
      setSystemInfo(res as SystemInfo | SystemInfo[] | null);
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
        const res = await ApiService.getContainerMetrics({ range: "1h", limit: HISTORY_MAX });
        if (!res?.containers) return;

        // Build per-container history from persistent data
        const seededHistory: Record<string, { cpu: number[]; mem: number[] }> = {};
        let totalCpuPoints: number[] = [];
        let totalMemPoints: number[] = [];

        // Find the longest series length across all containers
        let maxLen = 0;
        for (const [_name, data] of Object.entries(res.containers) as [string, ContainerMetricsData][]) {
          if (data.points?.length > maxLen) maxLen = data.points.length;
        }

        // Initialize totalCpu/Mem arrays with zeroes
        totalCpuPoints = new Array(maxLen).fill(0);
        totalMemPoints = new Array(maxLen).fill(0);

        for (const [_name, data] of Object.entries(res.containers) as [string, ContainerMetricsData][]) {
          if (!data.points || data.points.length === 0) continue;

          const cpuArr = data.points.map((p) => p.cpu);
          const memArr = data.points.map((p) => p.mem);
          seededHistory[_name] = { cpu: cpuArr, mem: memArr };

          // Accumulate totals — right-align shorter series
          const offset = maxLen - data.points.length;
          for (let i = 0; i < data.points.length; i++) {
            totalCpuPoints[offset + i] += data.points[i].cpu || 0;
            totalMemPoints[offset + i] += data.points[i].mem || 0;
          }
        }

        // Only seed if we got meaningful data
        if (Object.keys(seededHistory).length > 0) {
          setContainerHistory((prev) => {
            // Don't overwrite if live polling has already populated data
            if (Object.keys(prev).length > 0) return prev;
            return seededHistory;
          });
          setCpuHistory((prev) => (prev.length > 2 ? prev : totalCpuPoints));
          setMemHistory((prev) => (prev.length > 2 ? prev : totalMemPoints));
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
      setTimeout(fetchData, ACTION_COOLDOWN_MS);
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
      setTimeout(fetchData, ACTION_COOLDOWN_MS);
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
      setTimeout(fetchData, ACTION_COOLDOWN_MS);
    } catch (error) {
      console.error("Start failed:", error);
    }
  };

  const handleRollback = async (serviceId: string) => {
    try {
      await ApiService.rollbackService(serviceId);
      setTimeout(fetchData, ACTION_COOLDOWN_MS);
      // Refresh rollback availability
      setTimeout(
        () => checkRollbackAvailability(containerRows),
        HIGHLIGHT_DURATION_MS,
      );
    } catch (error) {
      console.error("Rollback failed:", error);
    }
  };

  // Check rollback availability for all restartable containers
  const checkRollbackAvailability = useCallback(async (rows: ContainerRow[]) => {
    const restartableIds = rows
      .filter((r) => r.restartable)
      .map((r) => r.id);

    if (restartableIds.length === 0) return;

    const results = await Promise.allSettled(
      restartableIds.map(async (id) => {
        const res = await ApiService.getRollbackStatus(id);
        return { id, available: res.available === true };
      }),
    );

    const map: Record<string, boolean> = {};
    for (const result of results) {
      if (result.status === "fulfilled") {
        map[result.value.id] = result.value.available;
      }
    }
    setRollbackMap(map);
  }, []);

  // ── Derive unique device IDs for filter pills ─────────────────
  const deviceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of containerRows) {
      if (row.device) ids.add(row.device);
    }
    return [...ids].sort();
  }, [containerRows]);

  // ── Filter rows by active device and container type ───────────
  const filteredRows = useMemo(() => {
    let rows = containerRows;
    if (activeDevice) {
      rows = rows.filter((r) => r.device === activeDevice);
    }
    if (activeType) {
      rows = rows.filter((r) => r.projectType === activeType);
    }
    return rows;
  }, [containerRows, activeDevice, activeType]);

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
    if (!activeDevice && !activeType) return Object.values(containerStats);
    return filteredRows
      .map((r) => containerStats[r.containerName])
      .filter(Boolean);
  }, [containerStats, activeDevice, activeType, filteredRows]);

  const avgCpuUsage =
    filteredStats.length > 0
      ? filteredStats.reduce(
          (sum, c) => sum + (c.cpu?.percent || 0),
          0,
        ) / filteredStats.length
      : 0;
  const totalCpuUsage = filteredStats.reduce(
    (sum, c) => sum + (c.cpu?.percent || 0),
    0,
  );
  const totalMemUsed = filteredStats.reduce(
    (sum, c) => sum + (c.memory?.used || 0),
    0,
  );

  // Use actual host RAM from systemInfo instead of summing per-container cgroup limits.
  // Fallback: deduplicate per-device cgroup limits (each container reports host RAM as its limit).
  const totalMemLimit = useMemo((): number => {
    if (systemInfo) {
      const devices: SystemInfo[] = Array.isArray(systemInfo) ? systemInfo : [systemInfo];
      if (activeDevice) {
        const match = devices.find((d) => d.deviceId === activeDevice);
        return match?.totalMemory || 0;
      }
      return devices.reduce((sum, d) => sum + (d.totalMemory || 0), 0);
    }
    // Fallback: take max memory.limit per device (cgroup limit = host RAM for uncapped containers)
    const perDevice: Record<string, number> = {};
    for (const row of filteredRows) {
      const dev = row.device || "_default";
      const limit = row._stats?.memory?.limit || 0;
      perDevice[dev] = Math.max(perDevice[dev] || 0, limit);
    }
    return (Object.values(perDevice) as number[]).reduce((sum, v) => sum + v, 0);
  }, [systemInfo, activeDevice, filteredRows]);

  const memPercent =
    totalMemLimit > 0 ? (totalMemUsed / totalMemLimit) * 100 : 0;
  const totalNetRx = filteredRows.reduce(
    (sum, r) => sum + (r._stats?.network?.rx || 0),
    0,
  );
  const totalNetTx = filteredRows.reduce(
    (sum, r) => sum + (r._stats?.network?.tx || 0),
    0,
  );

  const getRowClassName = (row: ContainerRow) =>
    row.healthy ? styles.rowHealthy : styles.rowUnhealthy;

  // Build full stats object for drawer
  const selectedStats = selectedContainer?._stats || null;

  // Derive per-device container counts for the pill labels
  const deviceContainerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of containerRows) {
      if (row.device) {
        counts[row.device] = (counts[row.device] || 0) + 1;
      }
    }
    return counts;
  }, [containerRows]);

  if (loading) {
    return (
      <div className={styles.section}>
        <LoadingIndicatorComponent
          size="small"
          label="Querying containers…"
          className="loading-center"
        />
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <PageHeaderComponent
        sticky={false}
        title="Containers"
        subtitle={`${healthyCount} of ${filteredRows.length} containers healthy · polling every 5s`}
      />

      {/* ── Filters & View Toggle ────────────────────────────────── */}
      <div className={styles.filtersBar}>
        <div className={styles.filtersContainer}>
          {/* ── Device Filter Pills ────────────────────────────────── */}
          {deviceIds.length > 1 && (
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Host</span>
              <div className={styles.deviceFilter}>
                <button
                  className={`${styles.devicePill} ${activeDevice === null ? styles.devicePillActive : ""}`}
                  onClick={() => setActiveDevice(null)}
                >
                  All Hosts
                  <span className={styles.devicePillCount}>
                    {containerRows.length}
                  </span>
                </button>
                {deviceIds.map((deviceId) => (
                  <button
                    key={deviceId}
                    className={`${styles.devicePill} ${activeDevice === deviceId ? styles.devicePillActive : ""}`}
                    onClick={() =>
                      setActiveDevice(activeDevice === deviceId ? null : deviceId)
                    }
                  >
                    {deviceId}
                    <span className={styles.devicePillCount}>
                      {deviceContainerCounts[deviceId] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Type Filter Pills ──────────────────────────────────── */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Type</span>
            <div className={styles.deviceFilter}>
              <button
                className={`${styles.devicePill} ${activeType === null ? styles.devicePillActive : ""}`}
                onClick={() => setActiveType(null)}
              >
                All Types
                <span className={styles.devicePillCount}>
                  {containerRows.length}
                </span>
              </button>
              {(["client", "service", "bot"] as const).map((type) => (
                <button
                  key={type}
                  className={`${styles.devicePill} ${activeType === type ? styles.devicePillActive : ""}`}
                  onClick={() =>
                    setActiveType(activeType === type ? null : type)
                  }
                >
                  {type}s
                  <span className={styles.devicePillCount}>
                    {containerRows.filter((r) => r.projectType === type).length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── View Mode Switcher ──────────────────────────────────── */}
        <div className={styles.viewModeToggle}>
          <button
            className={`${styles.toggleButton} ${viewMode === "table" ? styles.toggleBtnActive : ""}`}
            onClick={() => handleToggleViewMode("table")}
            title="Table View"
          >
            <List size={14} strokeWidth={2.4} />
          </button>
          <button
            className={`${styles.toggleButton} ${viewMode === "cards" ? styles.toggleBtnActive : ""}`}
            onClick={() => handleToggleViewMode("cards")}
            title="Cards View"
          >
            <LayoutGrid size={14} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      {/* ── Infrastructure Summary Cards ──────────────────────────── */}
      {!loading && (
        <div className={styles.summaryGrid}>
          <div className={styles.statCard}>
            <div
              className={styles.statCardIcon}
              style={{ color: "#6366f1", background: "rgba(99,102,241,0.08)" }}
            >
              <Server size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>
                {filteredRows.length}
              </span>
              <span className={styles.statCardLabel}>Containers</span>
              <span className={styles.statCardSub}>
                {activeDevice
                  ? `${healthyCount} healthy on ${activeDevice}`
                  : systemInfo
                    ? `${Array.isArray(systemInfo) ? systemInfo.reduce((s, d) => s + (d.containersRunning || 0), 0) : systemInfo.containersRunning || 0} running · ${Array.isArray(systemInfo) ? systemInfo.reduce((s, d) => s + (d.containersStopped || 0), 0) : systemInfo.containersStopped || 0} stopped`
                    : `${healthyCount} healthy`}
              </span>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.statCardWithChart}`}>
            <div className={styles.statCardHeader}>
              <div
                className={styles.statCardIcon}
                style={{
                  color: "#10b981",
                  background: "rgba(16,185,129,0.08)",
                }}
              >
                <Cpu size={18} strokeWidth={2} />
              </div>
              <div className={styles.statCardContent}>
                <span
                  className={styles.statCardValue}
                  style={{ color: severityColor(avgCpuUsage) }}
                >
                  {totalCpuUsage.toFixed(1)}%
                </span>
                <span className={styles.statCardLabel}>CPU Usage</span>
                <span className={styles.statCardSub}>
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
              formatValue={(v: number) => formatPercent(v, "adaptive")}
            />
          </div>

          <div className={`${styles.statCard} ${styles.statCardWithChart}`}>
            <div className={styles.statCardHeader}>
              <div
                className={styles.statCardIcon}
                style={{
                  color: "#3b82f6",
                  background: "rgba(59,130,246,0.08)",
                }}
              >
                <MemoryStick size={18} strokeWidth={2} />
              </div>
              <div className={styles.statCardContent}>
                <span
                  className={styles.statCardValue}
                  style={{ color: severityColor(memPercent, [60, 85]) }}
                >
                  {formatBytes(totalMemUsed)}
                </span>
                <span className={styles.statCardLabel}>Memory Used</span>
                <span className={styles.statCardSub}>
                  {totalMemLimit
                    ? `${formatPercent(memPercent, "adaptive")} of ${formatBytes(totalMemLimit)} total`
                    : "—"}
                </span>
              </div>
            </div>
            <ChartLineComponent
              data={memHistory}
              color="#3b82f6"
              maxValue={totalMemLimit || 1}
              height={48}
              historyMax={HISTORY_MAX}
              showGrid
              formatValue={(v: number) => formatBytes(v)}
            />
          </div>

          <div className={styles.statCard}>
            <div
              className={styles.statCardIcon}
              style={{ color: "#a855f7", background: "rgba(168,85,247,0.08)" }}
            >
              <Network size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>
                {formatBytes(totalNetRx + totalNetTx)}
              </span>
              <span className={styles.statCardLabel}>Network I/O</span>
              <span className={styles.statCardSub}>
                ↓ {formatBytes(totalNetRx)} rx · ↑ {formatBytes(totalNetTx)} tx
              </span>
            </div>
          </div>
        </div>
      )}

      {filteredRows.length === 0 ? (
        <div className={styles.emptyState}>
          No containers found{activeDevice ? ` on ${activeDevice}` : ""}
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
        />
      ) : (
        /* ── Cards Grid View ────────────────────────────────────── */
        <div className={styles.cardsGrid}>
          {filteredRows.map((row) => (
            <div
              key={row.id}
              className={`${styles.containerCard} ${row.healthy ? styles.cardHealthy : styles.cardUnhealthy} ${selectedContainer?.id === row.id ? styles.cardActive : ""}`}
              onClick={() => setSelectedContainer(row)}
            >
              <div className={styles.cardHeader}>
                <div className={styles.cardTitleSection}>
                  <Container
                    size={14}
                    strokeWidth={2.6}
                    className={`${styles.typeIcon} ${row.healthy ? styles.iconHealthy : styles.iconUnhealthy}`}
                  />
                  <span className={styles.cardName}>{row.containerName}</span>
                </div>
                <div className={styles.cardBadgeSection}>
                  <BadgeComponent type="status" healthy={row.healthy} />
                  {row.device && (
                    <span className={styles.cardDevicePill}>{row.device}</span>
                  )}
                </div>
              </div>

              <div className={styles.cardMeta}>
                {row.port && <BadgeComponent type="port" port={row.port} />}
                {row.visibility && (
                  <BadgeComponent
                    type="visibility"
                    visibility={row.visibility}
                    icons={{ Globe, Lock }}
                  />
                )}
                {row.domain && (
                  <BadgeComponent type="domain" domain={row.domain} icons={{ Globe }} />
                )}
              </div>

              <div className={styles.cardMetricsGrid}>
                <div className={styles.cardMetric}>
                  <div className={styles.cardMetricHeader}>
                    <Cpu size={12} className={styles.metricIconCpu} />
                    <span className={styles.cardMetricLabel}>CPU</span>
                    <span className={styles.cardMetricValue}>
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

                <div className={styles.cardMetric}>
                  <div className={styles.cardMetricHeader}>
                    <MemoryStick size={12} className={styles.metricIconRam} />
                    <span className={styles.cardMetricLabel}>RAM</span>
                    <span className={styles.cardMetricValue}>
                      {row._stats?.memory
                        ? formatBytes(row._stats.memory.used)
                        : "—"}
                    </span>
                  </div>
                  {row._stats?.memory && (
                    <MiniBar
                      percent={
                        row._stats.memory.limit > 0
                          ? (row._stats.memory.used / row._stats.memory.limit) * 100
                          : row._stats.memory.percent
                      }
                      color={severityColor(
                        row._stats.memory.limit > 0
                          ? (row._stats.memory.used / row._stats.memory.limit) * 100
                          : row._stats.memory.percent,
                        [60, 85]
                      )}
                    />
                  )}
                </div>
              </div>

              <div className={styles.cardFooter}>
                <div className={styles.cardUptime}>
                  {row._stats?.created ? (
                    <>
                      <span className={styles.uptimeLabel}>Uptime:</span>
                      <BadgeComponent type="dateTime" date={row._stats.created * 1000} showIcon={false} />
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
