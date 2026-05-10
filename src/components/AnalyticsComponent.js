"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  LoadingIndicatorComponent,
  PageHeaderComponent,
  TableComponent,
} from "@rodrigo-barraza/components-library";
import { formatBytes, formatCostAdaptive } from "@rodrigo-barraza/utilities-library";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Database,
  Layers,
  Package,
  Box,
  Server,
} from "lucide-react";

import ApiService from "../services/ApiService";
import ContainerStatsComponent from "./ContainerStatsComponent";
import styles from "./AnalyticsComponent.module.css";

// ── Donut Chart (SVG ring) ────────────────────────────────────────
function DonutChart({ segments, size = 120, strokeWidth = 14 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  let accumulated = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.donut}>
      {/* Track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--bg-tertiary)"
        strokeWidth={strokeWidth}
      />
      {/* Segments */}
      {segments.map((seg, i) => {
        const pct = total > 0 ? seg.value / total : 0;
        const dashLength = pct * circumference;
        const dashOffset = -(accumulated / total) * circumference;
        accumulated += seg.value;

        return (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            className={styles.donutSegment}
            style={{ animationDelay: `${i * 100}ms` }}
          />
        );
      })}
      {/* Center text */}
      <text x={center} y={center - 4} textAnchor="middle" className={styles.donutTotal}>
        {formatBytes(total)}
      </text>
      <text x={center} y={center + 12} textAnchor="middle" className={styles.donutLabel}>
        Total
      </text>
    </svg>
  );
}

// ── Percentage Bar ────────────────────────────────────────────────
function UsageBar({ value, max, color, label, sublabel }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div className={styles.usageBarRow}>
      <div className={styles.usageBarInfo}>
        <span className={styles.usageBarLabel}>{label}</span>
        <span className={styles.usageBarValue}>
          {formatBytes(value)}
          {sublabel && <span className={styles.usageBarSub}> · {sublabel}</span>}
        </span>
      </div>
      <div className={styles.usageBarTrack}>
        <div
          className={styles.usageBarFill}
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, delay = 0 }) {
  return (
    <div className={styles.statCard} style={{ animationDelay: `${delay}ms` }}>
      <div className={styles.statCardIcon} style={{ color, background: `${color}15` }}>
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className={styles.statCardContent}>
        <span className={styles.statCardValue}>{value}</span>
        <span className={styles.statCardLabel}>{label}</span>
        {sub && <span className={styles.statCardSub}>{sub}</span>}
      </div>
    </div>
  );
}

// ── Disk Category Colors ──────────────────────────────────────────
const DISK_COLORS = {
  images: "#6366f1",
  volumes: "#8b5cf6",
  buildCache: "#a855f7",
  containers: "#ec4899",
};

const BUCKET_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#14b8a6", "#f97316",
];

// ── Main Component ────────────────────────────────────────────────
export default function AnalyticsComponent() {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [storageSummary, setStorageSummary] = useState(null);
  const [containerStats, setContainerStats] = useState(null);
  const [period, setPeriod] = useState("24h");
  const [loading, setLoading] = useState(true);
  const [systemLoading, setSystemLoading] = useState(true);
  const didFetch = useRef(false);

  // ── Fetch Prism Data ──────────────────────────────────────────
  async function loadPrismData() {
    try {
      const [statsRes, projectsRes] = await Promise.all([
        ApiService.getStats(),
        ApiService.getProjectStats(),
      ]);
      setStats(statsRes);
      setProjects(projectsRes);
    } catch (err) {
      console.error("Analytics fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── Fetch System / Storage Data ────────────────────────────────
  const loadSystemData = useCallback(async () => {
    try {
      const [sysRes, storageRes, containerRes] = await Promise.all([
        ApiService.getSystemInfo().catch(() => null),
        ApiService.getStorageSummary().catch(() => null),
        ApiService.getContainerStats().catch(() => null),
      ]);
      setSystemInfo(sysRes);
      setStorageSummary(storageRes);
      setContainerStats(containerRes);
    } catch (err) {
      console.error("System data fetch failed:", err);
    } finally {
      setSystemLoading(false);
    }
  }, []);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadPrismData();
    loadSystemData();
  }, [loadSystemData]);

  // ── Computed values for summary cards ──────────────────────────
  const containers = containerStats?.containers || [];
  const totalCpuUsage = containers.reduce((sum, c) => sum + c.cpu.percent, 0);
  const totalMemUsed = containers.reduce((sum, c) => sum + c.memory.used, 0);
  const totalMemLimit = systemInfo?.totalMemory || (containers.length > 0 ? containers[0].memory.limit : 0);
  const memPercent = totalMemLimit > 0 ? (totalMemUsed / totalMemLimit) * 100 : 0;

  const hostDisk = systemInfo?.hostDisk;
  const totalMinioStorage = storageSummary?.totalSize || 0;
  const totalDockerDisk = systemInfo?.disk?.totalReclaimable || 0;

  const overview = stats?.stats || {};

  // ── Overview rows for Prism stats ─────────────────────────────
  const overviewRows = Object.entries(overview).map(([key, value]) => ({
    key,
    value:
      typeof value === "number"
        ? value.toLocaleString()
        : String(value ?? "—"),
  }));

  const overviewColumns = [
    { key: "key", label: "Metric", sortable: false },
    { key: "value", label: "Value", sortable: false, align: "right" },
  ];

  const projectColumns = [
    { key: "project", label: "Project", render: (row) => row.project || row._id || "—" },
    { key: "requests", label: "Requests", align: "right", render: (row) => (row.totalRequests || row.count || 0).toLocaleString() },
    { key: "cost", label: "Cost", align: "right", render: (row) => formatCostAdaptive(row.totalCost || 0) },
  ];

  // ── Disk usage donut segments ─────────────────────────────────
  const diskSegments = useMemo(() => {
    if (!systemInfo?.disk) return [];
    const d = systemInfo.disk;
    return [
      { value: d.images.totalSize, color: DISK_COLORS.images, label: "Images" },
      { value: d.volumes.totalSize, color: DISK_COLORS.volumes, label: "Volumes" },
      { value: d.buildCache.totalSize, color: DISK_COLORS.buildCache, label: "Build Cache" },
      { value: d.containers.totalWritableSize, color: DISK_COLORS.containers, label: "Containers" },
    ].filter((s) => s.value > 0);
  }, [systemInfo]);

  // ── Bucket donut segments ─────────────────────────────────────
  const bucketSegments = useMemo(() => {
    if (!storageSummary?.buckets) return [];
    return storageSummary.buckets
      .filter((b) => b.totalSize > 0)
      .sort((a, b) => b.totalSize - a.totalSize)
      .map((b, i) => ({
        value: b.totalSize,
        color: BUCKET_COLORS[i % BUCKET_COLORS.length],
        label: b.name,
        objectCount: b.objectCount,
      }));
  }, [storageSummary]);

  const maxBucketSize = bucketSegments.length > 0
    ? Math.max(...bucketSegments.map((s) => s.value))
    : 0;

  return (
    <div className={styles.analytics}>
      <PageHeaderComponent sticky={false} title="Metrics" subtitle="Usage statistics and container telemetry">
        <div className={styles.periodTabs}>
          {["24h", "7d", "30d"].map((p) => (
            <button
              key={p}
              className={`${styles.periodTab} ${period === p ? styles.activeTab : ""}`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </PageHeaderComponent>

      {/* ── System Summary Cards ────────────────────────────────── */}
      <div className={styles.summaryGrid}>
        <StatCard
          icon={Server}
          label="Containers"
          value={containers.length}
          sub={systemInfo ? `${systemInfo.containersRunning || 0} running · ${systemInfo.containersStopped || 0} stopped` : null}
          color="#6366f1"
          delay={0}
        />
        <StatCard
          icon={Cpu}
          label="Total Cores"
          value={systemInfo?.cpus || "—"}
          sub={`${totalCpuUsage.toFixed(1)}% aggregate usage`}
          color="#10b981"
          delay={50}
        />
        <StatCard
          icon={MemoryStick}
          label="Total Memory"
          value={totalMemLimit ? formatBytes(totalMemLimit) : "—"}
          sub={totalMemLimit ? `${formatBytes(totalMemUsed)} used · ${memPercent.toFixed(1)}%` : null}
          color="#3b82f6"
          delay={100}
        />
        <StatCard
          icon={HardDrive}
          label="Total Storage"
          value={hostDisk ? formatBytes(hostDisk.total) : "—"}
          sub={hostDisk ? `${formatBytes(hostDisk.used)} used · ${hostDisk.percent}%` : `${formatBytes(totalMinioStorage)} MinIO · ${formatBytes(totalDockerDisk)} Docker`}
          color="#a855f7"
          delay={150}
        />
      </div>

      {/* ── Live Container Metrics ──────────────────────────────── */}
      <ContainerStatsComponent />

      {/* ── Storage Overview ────────────────────────────────────── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Storage Overview</h2>
        <div className={styles.sectionSubtitle}>MinIO object storage and Docker disk usage</div>

        {systemLoading ? (
          <LoadingIndicatorComponent size="small" label="Querying storage…" className="loading-center" />
        ) : (
          <div className={styles.storageGrid}>
            {/* ── MinIO Buckets ── */}
            {storageSummary && bucketSegments.length > 0 && (
              <div className={styles.storagePanel}>
                <div className={styles.storagePanelHeader}>
                  <Database size={15} strokeWidth={2.2} className={styles.storagePanelIcon} />
                  <span className={styles.storagePanelTitle}>MinIO Object Storage</span>
                  <span className={styles.storagePanelMeta}>
                    {storageSummary.totalObjects?.toLocaleString()} objects
                  </span>
                </div>

                <div className={styles.storagePanelBody}>
                  <DonutChart segments={bucketSegments} size={130} strokeWidth={16} />
                  <div className={styles.storageLegend}>
                    {bucketSegments.map((seg, i) => (
                      <div key={i} className={styles.legendItem}>
                        <UsageBar
                          value={seg.value}
                          max={maxBucketSize}
                          color={seg.color}
                          label={seg.label}
                          sublabel={`${seg.objectCount.toLocaleString()} objects`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Docker Disk Usage ── */}
            {systemInfo?.disk && (
              <div className={styles.storagePanel}>
                <div className={styles.storagePanelHeader}>
                  <Layers size={15} strokeWidth={2.2} className={styles.storagePanelIcon} />
                  <span className={styles.storagePanelTitle}>Docker Disk Usage</span>
                  <span className={styles.storagePanelMeta}>
                    v{systemInfo.serverVersion}
                  </span>
                </div>

                <div className={styles.storagePanelBody}>
                  <DonutChart segments={diskSegments} size={130} strokeWidth={16} />
                  <div className={styles.storageLegend}>
                    <UsageBar
                      value={systemInfo.disk.images.totalSize}
                      max={systemInfo.disk.totalReclaimable}
                      color={DISK_COLORS.images}
                      label="Images"
                      sublabel={`${systemInfo.disk.images.count} images`}
                    />
                    <UsageBar
                      value={systemInfo.disk.volumes.totalSize}
                      max={systemInfo.disk.totalReclaimable}
                      color={DISK_COLORS.volumes}
                      label="Volumes"
                      sublabel={`${systemInfo.disk.volumes.count} volumes`}
                    />
                    <UsageBar
                      value={systemInfo.disk.buildCache.totalSize}
                      max={systemInfo.disk.totalReclaimable}
                      color={DISK_COLORS.buildCache}
                      label="Build Cache"
                      sublabel={`${systemInfo.disk.buildCache.count} layers`}
                    />
                    <UsageBar
                      value={systemInfo.disk.containers.totalWritableSize}
                      max={systemInfo.disk.totalReclaimable}
                      color={DISK_COLORS.containers}
                      label="Container Layers"
                      sublabel={`${systemInfo.disk.containers.count} containers`}
                    />
                  </div>
                </div>

                {/* ── Top Images ── */}
                {systemInfo.disk.images.items?.length > 0 && (
                  <div className={styles.imageList}>
                    <div className={styles.imageListHeader}>
                      <Package size={12} strokeWidth={2.2} />
                      <span>Largest Images</span>
                    </div>
                    {systemInfo.disk.images.items.slice(0, 8).map((img, i) => {
                      const tag = img.tags?.[0] || img.id;
                      const displayTag = tag.length > 50 ? `…${tag.slice(-48)}` : tag;
                      return (
                        <div key={i} className={styles.imageRow}>
                          <Box size={12} strokeWidth={1.8} className={styles.imageIcon} />
                          <span className={styles.imageName} title={tag}>{displayTag}</span>
                          <span className={styles.imageSize}>{formatBytes(img.size)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Volumes ── */}
                {systemInfo.disk.volumes.items?.length > 0 && (
                  <div className={styles.imageList}>
                    <div className={styles.imageListHeader}>
                      <HardDrive size={12} strokeWidth={2.2} />
                      <span>Volumes</span>
                    </div>
                    {systemInfo.disk.volumes.items.slice(0, 8).map((vol, i) => {
                      const name = vol.name.length > 40
                        ? `${vol.name.slice(0, 12)}…${vol.name.slice(-24)}`
                        : vol.name;
                      return (
                        <div key={i} className={styles.imageRow}>
                          <Database size={12} strokeWidth={1.8} className={styles.imageIcon} />
                          <span className={styles.imageName} title={vol.name}>{name}</span>
                          <span className={styles.imageSize}>{formatBytes(vol.size)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Prism Stats ────────────────────────────────────────── */}
      {loading ? (
        <LoadingIndicatorComponent size="small" label="Loading analytics…" className="loading-center" />
      ) : stats?.error ? (
        <div className={styles.errorState}>
          <p>Could not fetch analytics data</p>
          <span className={styles.errorDetail}>{stats.error}</span>
        </div>
      ) : (
        <div className={styles.content}>
          <TableComponent
            title="Prism Overview"
            columns={overviewColumns}
            data={overviewRows}
            getRowKey={(row) => row.key}
            emptyText="No stats available — is Prism running?"
            mini
          />

          {Array.isArray(projects) && projects.length > 0 && (
            <TableComponent
              title="Projects"
              columns={projectColumns}
              data={projects}
              getRowKey={(row, i) => row.project || row._id || i}
              mini
            />
          )}
        </div>
      )}
    </div>
  );
}
