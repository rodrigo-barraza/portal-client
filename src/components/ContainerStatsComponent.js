"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Container,
  Cpu,
  Globe,
  HardDrive,
  Lock,
  MemoryStick,
  Play,
  RotateCcw,
  ScrollText,
  Server,
  Square,
} from "lucide-react";
import {
  AddressBadgeComponent,
  DeviceBadgeComponent,
  DomainBadgeComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
  PortBadgeComponent,
  ResponseTimeBadgeComponent,
  StatusBadgeComponent,
  TableComponent,
  VisibilityBadgeComponent,
} from "@rodrigo-barraza/components-library";
import { formatDuration, getRootDomain } from "@rodrigo-barraza/utilities-library";
import ApiService from "../services/ApiService";
import styles from "./ContainerStatsComponent.module.css";

const POLL_INTERVAL = 5_000;

// ── Byte Formatting ───────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(2) : val < 100 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

// ── Action Cell ─────────────────────────────────────────────────

function ActionCell({ service, onRestart, onStop, onStart }) {
  const [restarting, setRestarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [starting, setStarting] = useState(false);

  const isHealthy = service.healthy;

  if (!service.restartable) return null;

  return (
    <div className={styles.actionRow}>
      {isHealthy ? (
        <button
          className={`${styles.actionBtn} ${styles.stopBtn} ${stopping ? styles.actionBtnLoading : ""}`}
          disabled={stopping || restarting}
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
          disabled={starting || restarting}
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

      <button
        className={`${styles.actionBtn} ${styles.restartBtn} ${restarting ? styles.actionBtnLoading : ""}`}
        disabled={restarting || stopping || starting}
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

function buildColumns({ onRestart, onStop, onStart }) {
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

      // Merge container data with project metadata
      const rows = containers.map((c) => {
        const svc = projectByDocker[c.name] || null;
        return {
          // Container identity
          id: svc?.id || c.name,
          containerName: c.name,
          // Project registry fields
          healthy: svc?.healthy ?? (c.state === "running"),
          visibility: svc?.visibility || null,
          port: svc?.port || null,
          url: svc?.url || null,
          domain: svc?.domain || null,
          responseTimeMs: svc?.responseTimeMs ?? null,
          device: svc?.device || null,
          restartable: svc?.restartable ?? false,
          dockerProject: c.name,
        };
      });

      // Sort by name
      rows.sort((a, b) => a.containerName.localeCompare(b.containerName));

      setContainerRows(rows);
    } catch {
      // Don't break the page on error
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch system info + aggregate container stats for summary cards
  const fetchSystemInfo = useCallback(async () => {
    try {
      const res = await ApiService.getSystemInfo().catch(() => null);
      setSystemInfo(res);
    } catch {
      // Supplementary — silently ignore
    }
  }, []);

  const fetchContainerStats = useCallback(async () => {
    try {
      const currentRes = await ApiService.getContainerStats();
      const statsMap = {};
      if (currentRes?.containers) {
        for (const c of currentRes.containers) {
          statsMap[c.name] = {
            cpu: c.cpu,
            memory: c.memory,
          };
        }
      }
      setContainerStats(statsMap);
    } catch {
      // Supplementary — silently ignore
    }
  }, []);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    fetchData();
    fetchSystemInfo();
    fetchContainerStats();
  }, [fetchData, fetchSystemInfo, fetchContainerStats]);

  // Poll every 5s
  useEffect(() => {
    const timer = setInterval(() => {
      fetchData();
      fetchContainerStats();
    }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchData, fetchContainerStats]);

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

  const columns = buildColumns({ onRestart: handleRestart, onStop: handleStop, onStart: handleStart });
  const healthyCount = containerRows.filter((r) => r.healthy).length;

  // ── Infrastructure summary computed values ─────────────────────
  const allStats = Object.values(containerStats);
  const totalCpuUsage = allStats.reduce((sum, c) => sum + (c.cpu?.percent || 0), 0);
  const totalMemUsed = allStats.reduce((sum, c) => sum + (c.memory?.used || 0), 0);
  const totalMemLimit = systemInfo?.totalMemory || (allStats.length > 0 ? allStats[0]?.memory?.limit || 0 : 0);
  const memPercent = totalMemLimit > 0 ? (totalMemUsed / totalMemLimit) * 100 : 0;
  const hostDisk = systemInfo?.hostDisk;

  const getRowClassName = (row) =>
    row.healthy ? styles.rowHealthy : styles.rowUnhealthy;

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
        subtitle={`${healthyCount} of ${containerRows.length} containers healthy · polling every 5s`}
      />

      {/* ── Infrastructure Summary Cards ──────────────────────────── */}
      {!loading && (
        <div className={styles.summaryGrid}>
          <div className={styles.statCard}>
            <div className={styles.statCardIcon} style={{ color: "#6366f1", background: "rgba(99,102,241,0.08)" }}>
              <Server size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>{containerRows.length}</span>
              <span className={styles.statCardLabel}>Containers</span>
              <span className={styles.statCardSub}>
                {systemInfo ? `${systemInfo.containersRunning || 0} running · ${systemInfo.containersStopped || 0} stopped` : `${healthyCount} healthy`}
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statCardIcon} style={{ color: "#10b981", background: "rgba(16,185,129,0.08)" }}>
              <Cpu size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>{systemInfo?.cpus || "—"}</span>
              <span className={styles.statCardLabel}>Total Cores</span>
              <span className={styles.statCardSub}>{totalCpuUsage.toFixed(1)}% aggregate usage</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statCardIcon} style={{ color: "#3b82f6", background: "rgba(59,130,246,0.08)" }}>
              <MemoryStick size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>{totalMemLimit ? formatBytes(totalMemLimit) : "—"}</span>
              <span className={styles.statCardLabel}>Total Memory</span>
              <span className={styles.statCardSub}>{totalMemLimit ? `${formatBytes(totalMemUsed)} used · ${memPercent.toFixed(1)}%` : "Loading…"}</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statCardIcon} style={{ color: "#a855f7", background: "rgba(168,85,247,0.08)" }}>
              <HardDrive size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>{hostDisk ? formatBytes(hostDisk.total) : "—"}</span>
              <span className={styles.statCardLabel}>Total Storage</span>
              <span className={styles.statCardSub}>{hostDisk ? `${formatBytes(hostDisk.used)} used · ${hostDisk.percent}%` : "Loading…"}</span>
            </div>
          </div>
        </div>
      )}

      {containerRows.length === 0 ? (
        <div className={styles.emptyState}>No containers found</div>
      ) : (
        <TableComponent
          columns={columns}
          data={containerRows}
          getRowKey={(row) => row.id}
          emptyText="No containers found"
          getRowClassName={getRowClassName}
          storageKey="container-table"
        />
      )}
    </div>
  );
}
