"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Container,
  Cpu,
  Globe,
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
  AddressBadgeComponent,
  DateTimeBadgeComponent,
  DeviceBadgeComponent,
  DomainBadgeComponent,
  DrawerComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
  PortBadgeComponent,
  ResponseTimeBadgeComponent,
  SparklineComponent,
  StatusBadgeComponent,
  TableComponent,
  VisibilityBadgeComponent,
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
import ApiService from "../services/ApiService";
import ContainerDetailPanel from "./ContainerDetailPanelComponent";
import styles from "./ContainerStatsComponent.module.css";

const POLL_INTERVAL = 5_000;
const HISTORY_MAX = 60; // 60 samples × 5s = 5 minutes

// @ts-ignore
function severityColor(pct, thresholds = [40, 80]) {
  if (pct > thresholds[1]) return "var(--danger)";
  if (pct > thresholds[0]) return "var(--warning)";
  return "var(--success)";
}

// ── Inline Percent Bar ──────────────────────────────────────────
function MiniBar({ percent, color }: { [key: string]: any }) {
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
  [key: string]: any;
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
          className={`${styles.actionBtn} ${styles.stopBtn} ${stopping ? styles.actionBtnLoading : ""}`}
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
          className={`${styles.actionBtn} ${styles.startBtn} ${starting ? styles.actionBtnLoading : ""}`}
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
        className={`${styles.actionBtn} ${styles.logsBtn}`}
        title="Logs"
        onClick={(e) => e.stopPropagation()}
      >
        <ScrollText size={9} strokeWidth={2.6} />
      </Link>

      {rollbackAvailable && (
        <button
          className={`${styles.actionBtn} ${styles.rollbackBtn} ${rollingBack ? styles.actionBtnLoading : ""}`}
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
        className={`${styles.actionBtn} ${styles.restartBtn} ${restarting ? styles.actionBtnLoading : ""}`}
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
  [key: string]: any;
}) {
  // Build per-device host RAM lookup for detecting uncapped containers
  const sysDevices = systemInfo
    ? Array.isArray(systemInfo)
      ? systemInfo
      : [systemInfo]
    : [];
  const hostRamByDevice = {};
  for (const d of sysDevices) {
    // @ts-ignore
    hostRamByDevice[d.deviceId] = d.totalMemory || 0;
  }

  return [
    {
      key: "name",
      label: "Container",
      sortable: true,
      render: (row: any) => (
        <div className={styles.nameCell}>
          <Container
            size={14}
            strokeWidth={2.6}
            className={`${styles.typeIcon} ${row.healthy ? styles.iconHealthy : styles.iconUnhealthy}`}
          />
          <span className={styles.containerName}>{row.containerName}</span>
        </div>
      ),
      sortValue: (row: any) => row.containerName || "",
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row: any) => <StatusBadgeComponent healthy={row.healthy} />,
      sortValue: (row: any) => (row.healthy ? 1 : 0),
    },
    {
      key: "cpu",
      label: "CPU",
      sortable: true,
      render: (row: any) => {
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
      sortValue: (row: any) => row._stats?.cpu?.percent ?? -1,
    },
    {
      key: "cpuTrend",
      label: "CPU Trend",
      sortable: false,
      render: (row: any) => {
        const history = containerHistory?.[row.containerName]?.cpu;
        if (!history || history.length < 2)
          return <span className={styles.dimText}>—</span>;
        return (
          <div className={styles.inlineSparkline}>
            <SparklineComponent
              data={history}
              color="#10b981"
              maxValue={100}
              height={24}
              historyMax={HISTORY_MAX}
              showGrid
            />
          </div>
        );
      },
    },
    {
      key: "ram",
      label: "RAM",
      sortable: true,
      render: (row: any) => {
        const mem = row._stats?.memory;
        if (!mem) return <span className={styles.dimText}>—</span>;
        // @ts-ignore
        const hostRam = hostRamByDevice[row.device] || 0;
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
      sortValue: (row: any) => row._stats?.memory?.used ?? -1,
    },
    {
      key: "ramTrend",
      label: "RAM Trend",
      sortable: false,
      render: (row: any) => {
        const history = containerHistory?.[row.containerName]?.mem;
        if (!history || history.length < 2)
          return <span className={styles.dimText}>—</span>;
        const maxVal = row._stats?.memory?.limit || Math.max(...history, 1);
        return (
          <div className={styles.inlineSparkline}>
            <SparklineComponent
              data={history}
              color="#3b82f6"
              maxValue={maxVal}
              height={24}
              historyMax={HISTORY_MAX}
              showGrid
            />
          </div>
        );
      },
    },
    {
      key: "netio",
      label: "Net I/O",
      sortable: true,
      render: (row: any) => {
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
      sortValue: (row: any) =>
        (row._stats?.network?.rx || 0) + (row._stats?.network?.tx || 0),
    },

    {
      key: "uptime",
      label: "Uptime",
      sortable: true,
      render: (row: any) => {
        const created = row._stats?.created;
        if (!created) return <span className={styles.dimText}>—</span>;
        return (
          <DateTimeBadgeComponent date={created * 1000} showIcon={false} />
        );
      },
      sortValue: (row: any) => row._stats?.created ?? Infinity,
    },
    {
      key: "visibility",
      label: "Visibility",
      sortable: true,
      render: (row: any) =>
        row.visibility ? (
          <VisibilityBadgeComponent
            visibility={row.visibility}
            icons={{ Globe, Lock }}
          />
        ) : null,
      sortValue: (row: any) => row.visibility || "",
    },
    {
      key: "port",
      label: "Port",
      sortable: true,
      render: (row: any) =>
        row.port ? <PortBadgeComponent port={row.port} /> : null,
      sortValue: (row: any) => row.port || 0,
    },
    {
      key: "address",
      label: "Address",
      sortable: true,
      description: "Internal IP and port (socket address)",
      render: (row: any) =>
        row.url ? <AddressBadgeComponent address={row.url} link /> : null,
      sortValue: (row: any) => row.url || "",
    },
    {
      key: "domain",
      label: "Domain",
      sortable: true,
      description: "Registrable root domain",
      render: (row: any) => {
        const root = getRootDomain(row.domain);
        return root ? (
          <DomainBadgeComponent domain={row.domain} icons={{ Globe }} />
        ) : null;
      },
      sortValue: (row: any) => getRootDomain(row.domain),
    },
    {
      key: "response",
      label: "Response",
      sortable: true,
      render: (row: any) =>
        row.responseTimeMs != null ? (
          <ResponseTimeBadgeComponent
            ms={row.responseTimeMs}
            formatter={formatDuration}
          />
        ) : null,
      sortValue: (row: any) => row.responseTimeMs ?? Infinity,
    },
    {
      key: "device",
      label: "Device",
      sortable: true,
      render: (row: any) =>
        row.device ? (
          <DeviceBadgeComponent device={row.device} icons={{ Server }} />
        ) : null,
      sortValue: (row: any) => row.device || "",
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      align: "right",
      render: (row: any) => (
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
  const [containerRows, setContainerRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [containerStats, setContainerStats] = useState<any>({});
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<any>(null);
  const [activeDevice, setActiveDevice] = useState<any>(null); // null = all hosts
  const [rollbackMap, setRollbackMap] = useState<any>({}); // serviceId → boolean
  const didFetch = useRef(false);
  const [containerHistory, setContainerHistory] = useState<
    Record<string, { cpu: number[]; mem: number[] }>
  >({});

  // Fetch container stats and project registry, then join them
  const fetchData = useCallback(async () => {
    try {
      const [containerRes, servicesRes] = await Promise.all([
        // @ts-ignore
        ApiService.getContainerStats(),
        ApiService.getServices(),
      ]);

      const containers = containerRes?.containers || [];
      const services = servicesRes?.services || [];

      // Build lookup: dockerProject → service data
      const projectByDocker = {};
      for (const svc of services) {
        if (svc.dockerProject) {
          // @ts-ignore
          projectByDocker[svc.dockerProject] = svc;
        }
      }

      // Merge container data with project metadata + stats
      // @ts-ignore
      const rows = containers.map((c) => {
        // @ts-ignore
        const svc = projectByDocker[c.name] || null;
        return {
          // Container identity
          id: svc?.id || `${c.device || "unknown"}-${c.name}`,
          containerName: c.name,
          // Project registry fields
          healthy: svc?.healthy ?? c.state === "running",
          registered: !!svc,
          visibility: svc?.visibility || null,
          port: svc?.port || null,
          url: svc?.url || null,
          domain: svc?.domain || null,
          responseTimeMs: svc?.responseTimeMs ?? null,
          device: c.device || svc?.device || null,
          restartable: svc?.restartable ?? false,
          controllable: true,
          dockerProject: c.name,
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
      rows.sort((a: any, b: any) =>
        a.containerName.localeCompare(b.containerName),
      );

      setContainerRows(rows);

      // Build stats map for summary cards
      const statsMap = {};
      for (const c of containers) {
        // @ts-ignore
        statsMap[c.name] = {
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
        (sum: number, c: any) => sum + (c.cpu?.percent || 0),
        0,
      );
      const totalMem = containers.reduce(
        (sum: number, c: any) => sum + (c.memory?.used || 0),
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
      // @ts-ignore
      setSelectedContainer((prev) => {
        if (!prev) return null;
        // @ts-ignore
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
      // @ts-ignore
      const res = await ApiService.getSystemInfo().catch(() => null);
      setSystemInfo(res);
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
        for (const [name, data] of Object.entries(res.containers) as [string, any][]) {
          if (data.points?.length > maxLen) maxLen = data.points.length;
        }

        // Initialize totalCpu/Mem arrays with zeroes
        totalCpuPoints = new Array(maxLen).fill(0);
        totalMemPoints = new Array(maxLen).fill(0);

        for (const [name, data] of Object.entries(res.containers) as [string, any][]) {
          if (!data.points || data.points.length === 0) continue;

          const cpuArr = data.points.map((p: any) => p.cpu);
          const memArr = data.points.map((p: any) => p.mem);
          seededHistory[name] = { cpu: cpuArr, mem: memArr };

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

  // @ts-ignore
  const handleRestart = async (serviceId, row) => {
    try {
      if (row?.registered && row?.restartable) {
        await ApiService.restartService(serviceId);
      } else {
        await ApiService.restartContainer(row.containerName, row.device);
      }
      setTimeout(fetchData, ACTION_COOLDOWN_MS);
    } catch (error) {
      console.error("Restart failed:", error);
    }
  };

  // @ts-ignore
  const handleStop = async (serviceId, row) => {
    try {
      if (row?.registered && row?.restartable) {
        await ApiService.stopService(serviceId);
      } else {
        await ApiService.stopContainer(row.containerName, row.device);
      }
      setTimeout(fetchData, ACTION_COOLDOWN_MS);
    } catch (error) {
      console.error("Stop failed:", error);
    }
  };

  // @ts-ignore
  const handleStart = async (serviceId, row) => {
    try {
      if (row?.registered && row?.restartable) {
        await ApiService.startService(serviceId);
      } else {
        await ApiService.startContainer(row.containerName, row.device);
      }
      setTimeout(fetchData, ACTION_COOLDOWN_MS);
    } catch (error) {
      console.error("Start failed:", error);
    }
  };

  // @ts-ignore
  const handleRollback = async (serviceId) => {
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
  // @ts-ignore
  const checkRollbackAvailability = useCallback(async (rows) => {
    const restartableIds = rows
      // @ts-ignore
      .filter((r) => r.restartable)
      // @ts-ignore
      .map((r) => r.id);

    if (restartableIds.length === 0) return;

    const results = await Promise.allSettled(
      // @ts-ignore
      restartableIds.map(async (id) => {
        const res = await ApiService.getRollbackStatus(id);
        return { id, available: res.available === true };
      }),
    );

    const map = {};
    for (const result of results) {
      if (result.status === "fulfilled") {
        // @ts-ignore
        map[result.value.id] = result.value.available;
      }
    }
    setRollbackMap(map);
  }, []);

  // ── Derive unique device IDs for filter pills ─────────────────
  const deviceIds = useMemo(() => {
    const ids = new Set();
    for (const row of containerRows) {
      if (row.device) ids.add(row.device);
    }
    return [...ids].sort();
  }, [containerRows]);

  // ── Filter rows by active device ──────────────────────────────
  const filteredRows = useMemo(() => {
    if (!activeDevice) return containerRows;
    return containerRows.filter((r) => r.device === activeDevice);
  }, [containerRows, activeDevice]);

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
    if (!activeDevice) return Object.values(containerStats);
    return filteredRows
      .map((r) => containerStats[r.containerName])
      .filter(Boolean);
  }, [containerStats, activeDevice, filteredRows]);

  const avgCpuUsage =
    filteredStats.length > 0
      ? filteredStats.reduce(
          (sum: any, c: any) => sum + (c.cpu?.percent || 0),
          0,
        ) / filteredStats.length
      : 0;
  const totalCpuUsage = filteredStats.reduce(
    (sum: any, c: any) => sum + (c.cpu?.percent || 0),
    0,
  );
  const totalMemUsed = filteredStats.reduce(
    (sum: any, c: any) => sum + (c.memory?.used || 0),
    0,
  );

  // Use actual host RAM from systemInfo instead of summing per-container cgroup limits.
  // Fallback: deduplicate per-device cgroup limits (each container reports host RAM as its limit).
  const totalMemLimit = useMemo(() => {
    if (systemInfo) {
      const devices = Array.isArray(systemInfo) ? systemInfo : [systemInfo];
      if (activeDevice) {
        const match = devices.find((d: any) => d.deviceId === activeDevice);
        return match?.totalMemory || 0;
      }
      return devices.reduce((sum, d) => sum + (d.totalMemory || 0), 0);
    }
    // Fallback: take max memory.limit per device (cgroup limit = host RAM for uncapped containers)
    const perDevice = {};
    for (const row of filteredRows) {
      const dev = row.device || "_default";
      const limit = row._stats?.memory?.limit || 0;
      // @ts-ignore
      perDevice[dev] = Math.max(perDevice[dev] || 0, limit);
    }
    // @ts-ignore
    return Object.values(perDevice).reduce((sum, v) => sum + v, 0);
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

  const getRowClassName = (row: any) =>
    row.healthy ? styles.rowHealthy : styles.rowUnhealthy;

  // Build full stats object for drawer
  const selectedStats = selectedContainer?._stats || null;

  // Derive per-device container counts for the pill labels
  const deviceContainerCounts = useMemo(() => {
    const counts = {};
    for (const row of containerRows) {
      if (row.device) {
        // @ts-ignore
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

      {/* ── Device Filter Pills ────────────────────────────────────── */}
      {deviceIds.length > 1 && (
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
              // @ts-ignore
              key={deviceId as string}
              className={`${styles.devicePill} ${activeDevice === deviceId ? styles.devicePillActive : ""}`}
              onClick={() =>
                setActiveDevice(activeDevice === deviceId ? null : deviceId)
              }
            >
              {/* @ts-ignore */}
              {deviceId as string}
              {/* @ts-ignore */}
              <span className={styles.devicePillCount}>
                {(deviceContainerCounts as any)[deviceId as string] || 0}
              </span>
            </button>
          ))}
        </div>
      )}

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
                    ? `${Array.isArray(systemInfo) ? systemInfo.reduce((s: any, d) => s + (d.containersRunning || 0), 0) : systemInfo.containersRunning || 0} running · ${Array.isArray(systemInfo) ? systemInfo.reduce((s: any, d) => s + (d.containersStopped || 0), 0) : systemInfo.containersStopped || 0} stopped`
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
            <SparklineComponent
              data={cpuHistory}
              color="#10b981"
              maxValue={100}
              height={48}
              historyMax={HISTORY_MAX}
              showGrid
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
            <SparklineComponent
              data={memHistory}
              color="#3b82f6"
              maxValue={totalMemLimit || 1}
              height={48}
              historyMax={HISTORY_MAX}
              showGrid
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
      ) : (
        <TableComponent
          title="Containers"
          subtitle={`${filteredRows.length} containers · ${healthyCount} healthy`}
          columns={columns}
          data={filteredRows}
          getRowKey={(row: any) => row.id}
          emptyText="No containers found"
          getRowClassName={getRowClassName}
          onRowClick={(row: any) => setSelectedContainer(row)}
          activeRowKey={selectedContainer?.id}
          storageKey="container-table"
        />
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
