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
  StatusBadgeComponent,
  TableComponent,
  VisibilityBadgeComponent,
} from "@rodrigo-barraza/components-library";
import { formatBytes, formatDuration, formatPercent, getRootDomain } from "@rodrigo-barraza/utilities-library";
import ApiService from "../services/ApiService";
import ContainerDetailPanel from "./ContainerDetailPanelComponent";
import styles from "./ContainerStatsComponent.module.css";

const POLL_INTERVAL = 5_000;

function severityColor(pct, thresholds = [40, 80]) {
  if (pct > thresholds[1]) return "var(--danger)";
  if (pct > thresholds[0]) return "var(--warning)";
  return "var(--success)";
}

// ── Inline Percent Bar ──────────────────────────────────────────
function MiniBar({ percent, color }) {
  const clamped = Math.min(percent, 100);
  return (
    <div className={styles.miniBarTrack}>
      <div className={styles.miniBarFill} style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}

// ── Action Cell ─────────────────────────────────────────────────

function ActionCell({ service, onRestart, onStop, onStart, onRollback, rollbackAvailable }) {
  const [restarting, setRestarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [starting, setStarting] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  const isHealthy = service.healthy;

  if (!service.restartable) return null;

  return (
    <div className={styles.actionRow}>
      {isHealthy ? (
        <button
          className={`${styles.actionBtn} ${styles.stopBtn} ${stopping ? styles.actionBtnLoading : ""}`}
          disabled={stopping || restarting || rollingBack}
          onClick={async (e) => {
            e.stopPropagation();
            setStopping(true);
            try { await onStop?.(service.id); }
            finally { setTimeout(() => setStopping(false), 5000); }
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
            try { await onStart?.(service.id); }
            finally { setTimeout(() => setStarting(false), 5000); }
          }}
          title="Start"
        >
          <Play size={9} strokeWidth={2.6} fill="currentColor" />
        </button>
      )}

      <Link
        href={`/logs?service=${service.id}`}
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
            try { await onRollback?.(service.id); }
            finally { setTimeout(() => setRollingBack(false), 8000); }
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
          try { await onRestart?.(service.id); }
          finally { setTimeout(() => setRestarting(false), 5000); }
        }}
        title="Restart"
      >
        <RotateCcw size={9} strokeWidth={2.6} className={restarting ? styles.spin : ""} />
      </button>
    </div>
  );
}

// ── Column Definitions ──────────────────────────────────────────

function buildColumns({ onRestart, onStop, onStart, onRollback, rollbackMap }) {
  return [
    {
      key: "name",
      label: "Container",
      sortable: true,
      render: (row) => (
        <div className={styles.nameCell}>
          <Container
            size={14}
            strokeWidth={2.6}
            className={`${styles.typeIcon} ${row.healthy ? styles.iconHealthy : styles.iconUnhealthy}`}
          />
          <span className={styles.containerName}>{row.containerName}</span>
        </div>
      ),
      sortValue: (row) => row.containerName || "",
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => (
        <StatusBadgeComponent healthy={row.healthy} />
      ),
      sortValue: (row) => (row.healthy ? 1 : 0),
    },
    {
      key: "cpu",
      label: "CPU",
      sortable: true,
      render: (row) => {
        const cpuPct = row._stats?.cpu?.percent;
        if (cpuPct == null) return <span className={styles.dimText}>—</span>;
        const color = severityColor(cpuPct);
        return (
          <div className={styles.metricCell}>
            <span className={styles.metricValue} style={{ color }}>{formatPercent(cpuPct, "adaptive")}</span>
            <MiniBar percent={cpuPct} color={color} />
          </div>
        );
      },
      sortValue: (row) => row._stats?.cpu?.percent ?? -1,
    },
    {
      key: "ram",
      label: "RAM",
      sortable: true,
      render: (row) => {
        const mem = row._stats?.memory;
        if (!mem) return <span className={styles.dimText}>—</span>;
        const color = severityColor(mem.percent, [60, 85]);
        return (
          <div className={styles.metricCell}>
            <span className={styles.metricValue} style={{ color }}>{formatBytes(mem.used)}</span>
            <MiniBar percent={mem.percent} color={color} />
          </div>
        );
      },
      sortValue: (row) => row._stats?.memory?.used ?? -1,
    },
    {
      key: "netio",
      label: "Net I/O",
      sortable: true,
      render: (row) => {
        const net = row._stats?.network;
        if (!net || (net.rx === 0 && net.tx === 0)) return <span className={styles.dimText}>—</span>;
        return (
          <div className={styles.ioCell}>
            <span className={styles.ioCompact}><span className={styles.ioArrow}>↓</span>{formatBytes(net.rx)}</span>
            <span className={styles.ioCompact}><span className={styles.ioArrow}>↑</span>{formatBytes(net.tx)}</span>
          </div>
        );
      },
      sortValue: (row) => (row._stats?.network?.rx || 0) + (row._stats?.network?.tx || 0),
    },

    {
      key: "uptime",
      label: "Uptime",
      sortable: true,
      render: (row) => {
        const created = row._stats?.created;
        if (!created) return <span className={styles.dimText}>—</span>;
        return <DateTimeBadgeComponent date={created * 1000} mini showIcon={false} />;
      },
      sortValue: (row) => row._stats?.created ?? Infinity,
    },
    {
      key: "visibility",
      label: "Visibility",
      sortable: true,
      render: (row) =>
        row.visibility ? (
          <VisibilityBadgeComponent visibility={row.visibility} icons={{ Globe, Lock }} />
        ) : null,
      sortValue: (row) => row.visibility || "",
    },
    {
      key: "port",
      label: "Port",
      sortable: true,
      render: (row) =>
        row.port ? (
          <PortBadgeComponent port={row.port} />
        ) : null,
      sortValue: (row) => row.port || 0,
    },
    {
      key: "address",
      label: "Address",
      sortable: true,
      description: "Internal IP and port (socket address)",
      render: (row) =>
        row.url ? (
          <AddressBadgeComponent address={row.url} link />
        ) : null,
      sortValue: (row) => row.url || "",
    },
    {
      key: "domain",
      label: "Domain",
      sortable: true,
      description: "Registrable root domain",
      render: (row) => {
        const root = getRootDomain(row.domain);
        return root ? (
          <DomainBadgeComponent domain={row.domain} icons={{ Globe }} />
        ) : null;
      },
      sortValue: (row) => getRootDomain(row.domain),
    },
    {
      key: "response",
      label: "Response",
      sortable: true,
      render: (row) =>
        row.responseTimeMs != null ? (
          <ResponseTimeBadgeComponent ms={row.responseTimeMs} formatter={formatDuration} />
        ) : null,
      sortValue: (row) => row.responseTimeMs ?? Infinity,
    },
    {
      key: "device",
      label: "Device",
      sortable: true,
      render: (row) =>
        row.device ? (
          <DeviceBadgeComponent device={row.device} icons={{ Server }} />
        ) : null,
      sortValue: (row) => row.device || "",
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      align: "right",
      render: (row) => (
        <ActionCell
          service={row}
          onRestart={onRestart}
          onStop={onStop}
          onStart={onStart}
          onRollback={onRollback}
          rollbackAvailable={!!rollbackMap[row.id]}
        />
      ),
    },
  ];
}

// ── Main Component ──────────────────────────────────────────────

export default function ContainerStatsComponent() {
  const [containerRows, setContainerRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [systemInfo, setSystemInfo] = useState(null);
  const [containerStats, setContainerStats] = useState({});
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [activeDevice, setActiveDevice] = useState(null); // null = all hosts
  const [rollbackMap, setRollbackMap] = useState({}); // serviceId → boolean
  const didFetch = useRef(false);

  // Fetch container stats and project registry, then join them
  const fetchData = useCallback(async () => {
    try {
      const [containerRes, servicesRes] = await Promise.all([
        ApiService.getContainerStats(),
        ApiService.getServices(),
      ]);

      const containers = containerRes?.containers || [];
      const services = servicesRes?.services || [];

      // Build lookup: dockerProject → service data
      const projectByDocker = {};
      for (const svc of services) {
        if (svc.dockerProject) {
          projectByDocker[svc.dockerProject] = svc;
        }
      }

      // Merge container data with project metadata + stats
      const rows = containers.map((c) => {
        const svc = projectByDocker[c.name] || null;
        return {
          // Container identity
          id: svc?.id || `${c.device || "unknown"}-${c.name}`,
          containerName: c.name,
          // Project registry fields
          healthy: svc?.healthy ?? (c.state === "running"),
          visibility: svc?.visibility || null,
          port: svc?.port || null,
          url: svc?.url || null,
          domain: svc?.domain || null,
          responseTimeMs: svc?.responseTimeMs ?? null,
          device: c.device || svc?.device || null,
          restartable: svc?.restartable ?? false,
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
      rows.sort((a, b) => a.containerName.localeCompare(b.containerName));

      setContainerRows(rows);

      // Build stats map for summary cards
      const statsMap = {};
      for (const c of containers) {
        statsMap[c.name] = {
          cpu: c.cpu,
          memory: c.memory,
          network: c.network,
          blockIO: c.blockIO,
          pids: c.pids,
        };
      }
      setContainerStats(statsMap);

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
  }, [fetchData, fetchSystemInfo]);

  // Poll every 5s
  useEffect(() => {
    const timer = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchData]);

  const handleRestart = async (serviceId) => {
    try {
      await ApiService.restartService(serviceId);
      setTimeout(fetchData, 5000);
    } catch (err) {
      console.error("Restart failed:", err);
    }
  };

  const handleStop = async (serviceId) => {
    try {
      await ApiService.stopService(serviceId);
      setTimeout(fetchData, 5000);
    } catch (err) {
      console.error("Stop failed:", err);
    }
  };

  const handleStart = async (serviceId) => {
    try {
      await ApiService.startService(serviceId);
      setTimeout(fetchData, 5000);
    } catch (err) {
      console.error("Start failed:", err);
    }
  };

  const handleRollback = async (serviceId) => {
    try {
      await ApiService.rollbackService(serviceId);
      setTimeout(fetchData, 5000);
      // Refresh rollback availability
      setTimeout(() => checkRollbackAvailability(containerRows), 6000);
    } catch (err) {
      console.error("Rollback failed:", err);
    }
  };

  // Check rollback availability for all restartable containers
  const checkRollbackAvailability = useCallback(async (rows) => {
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

    const map = {};
    for (const result of results) {
      if (result.status === "fulfilled") {
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

  const columns = buildColumns({ onRestart: handleRestart, onStop: handleStop, onStart: handleStart, onRollback: handleRollback, rollbackMap });
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
    return filteredRows.map((r) => containerStats[r.containerName]).filter(Boolean);
  }, [containerStats, activeDevice, filteredRows]);

  const avgCpuUsage = filteredStats.length > 0
    ? filteredStats.reduce((sum, c) => sum + (c.cpu?.percent || 0), 0) / filteredStats.length
    : 0;
  const totalCpuUsage = filteredStats.reduce((sum, c) => sum + (c.cpu?.percent || 0), 0);
  const totalMemUsed = filteredStats.reduce((sum, c) => sum + (c.memory?.used || 0), 0);
  const totalMemLimit = filteredStats.reduce((sum, c) => sum + (c.memory?.limit || 0), 0);
  const memPercent = totalMemLimit > 0 ? (totalMemUsed / totalMemLimit) * 100 : 0;
  const totalNetRx = filteredRows.reduce((sum, r) => sum + (r._stats?.network?.rx || 0), 0);
  const totalNetTx = filteredRows.reduce((sum, r) => sum + (r._stats?.network?.tx || 0), 0);


  const getRowClassName = (row) =>
    row.healthy ? styles.rowHealthy : styles.rowUnhealthy;

  // Build full stats object for drawer
  const selectedStats = selectedContainer?._stats || null;

  // Derive per-device container counts for the pill labels
  const deviceContainerCounts = useMemo(() => {
    const counts = {};
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
        <LoadingIndicatorComponent size="small" label="Querying containers…" className="loading-center" />
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <PageHeaderComponent sticky={false}
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
            <span className={styles.devicePillCount}>{containerRows.length}</span>
          </button>
          {deviceIds.map((deviceId) => (
            <button
              key={deviceId}
              className={`${styles.devicePill} ${activeDevice === deviceId ? styles.devicePillActive : ""}`}
              onClick={() => setActiveDevice(activeDevice === deviceId ? null : deviceId)}
            >
              {deviceId}
              <span className={styles.devicePillCount}>{deviceContainerCounts[deviceId] || 0}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Infrastructure Summary Cards ──────────────────────────── */}
      {!loading && (
        <div className={styles.summaryGrid}>
          <div className={styles.statCard}>
            <div className={styles.statCardIcon} style={{ color: "#6366f1", background: "rgba(99,102,241,0.08)" }}>
              <Server size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>{filteredRows.length}</span>
              <span className={styles.statCardLabel}>Containers</span>
              <span className={styles.statCardSub}>
                {activeDevice
                  ? `${healthyCount} healthy on ${activeDevice}`
                  : (systemInfo
                    ? `${Array.isArray(systemInfo) ? systemInfo.reduce((s, d) => s + (d.containersRunning || 0), 0) : (systemInfo.containersRunning || 0)} running · ${Array.isArray(systemInfo) ? systemInfo.reduce((s, d) => s + (d.containersStopped || 0), 0) : (systemInfo.containersStopped || 0)} stopped`
                    : `${healthyCount} healthy`)
                  }
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statCardIcon} style={{ color: "#10b981", background: "rgba(16,185,129,0.08)" }}>
              <Cpu size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue} style={{ color: severityColor(avgCpuUsage) }}>{totalCpuUsage.toFixed(1)}%</span>
              <span className={styles.statCardLabel}>CPU Usage</span>
              <span className={styles.statCardSub}>{avgCpuUsage.toFixed(1)}% avg per container</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statCardIcon} style={{ color: "#3b82f6", background: "rgba(59,130,246,0.08)" }}>
              <MemoryStick size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue} style={{ color: severityColor(memPercent, [60, 85]) }}>{formatBytes(totalMemUsed)}</span>
              <span className={styles.statCardLabel}>Memory Used</span>
              <span className={styles.statCardSub}>{totalMemLimit ? `${formatPercent(memPercent, "adaptive")} of ${formatBytes(totalMemLimit)} allocated` : "—"}</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statCardIcon} style={{ color: "#a855f7", background: "rgba(168,85,247,0.08)" }}>
              <Network size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>{formatBytes(totalNetRx + totalNetTx)}</span>
              <span className={styles.statCardLabel}>Network I/O</span>
              <span className={styles.statCardSub}>↓ {formatBytes(totalNetRx)} rx · ↑ {formatBytes(totalNetTx)} tx</span>
            </div>
          </div>


        </div>
      )}

      {filteredRows.length === 0 ? (
        <div className={styles.emptyState}>No containers found{activeDevice ? ` on ${activeDevice}` : ""}</div>
      ) : (
        <TableComponent
          columns={columns}
          data={filteredRows}
          getRowKey={(row) => row.id}
          emptyText="No containers found"
          getRowClassName={getRowClassName}
          onRowClick={(row) => setSelectedContainer(row)}
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
          selectedContainer?.restartable ? (
            <ActionCell
              service={selectedContainer}
              onRestart={handleRestart}
              onStop={handleStop}
              onStart={handleStart}
              onRollback={handleRollback}
              rollbackAvailable={!!rollbackMap[selectedContainer.id]}
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

