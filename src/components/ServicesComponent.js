"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { RefreshCw, ArrowUpDown, ArrowDownAZ, LayoutGrid, Table2, Cpu, MemoryStick, HardDrive, Server } from "lucide-react";
import { ButtonComponent, LoadingIndicatorComponent, PageHeaderComponent, MultiSelectComponent } from "@rodrigo-barraza/components-library";
import { getRootDomain, getSubdomain } from "@rodrigo-barraza/utilities-library";

import ServiceCardComponent from "./ServiceCardComponent";
import ServiceTableComponent from "./ServiceTableComponent";
import ApiService from "../services/ApiService";
import styles from "./ServicesComponent.module.css";

// ── Static filter option definitions ─────────────────────────────
const STATIC_FILTER_OPTIONS = {
  status: {
    label: "Status",
    values: [
      { value: "healthy", label: "Healthy" },
      { value: "unhealthy", label: "Down" },
    ],
  },
  visibility: {
    label: "Visibility",
    values: [
      { value: "external", label: "External" },
      { value: "internal", label: "Internal" },
    ],
  },
  environment: {
    label: "Environment",
    values: [
      { value: "Production", label: "Production" },
      { value: "Development", label: "Development" },
    ],
  },
};

// ── Sort-by options ──────────────────────────────────────────────
const SORT_BY_OPTIONS = [
  { key: "name",       label: "Name" },
  { key: "status",     label: "Status" },
  { key: "visibility", label: "Visibility" },
  { key: "type",       label: "Type" },
  { key: "port",       label: "Port" },
  { key: "response",   label: "Response" },
];


/** Compare two services by the chosen sort key. */
function compareBySortKey(a, b, sortKey, sortDir) {
  const dir = sortDir === "asc" ? 1 : -1;
  switch (sortKey) {
    case "name":
      return dir * (a.name || "").localeCompare(b.name || "");
    case "status":
      // healthy first in asc, down first in desc
      return dir * ((b.healthy ? 1 : 0) - (a.healthy ? 1 : 0));
    case "visibility":
      return dir * (a.visibility || "").localeCompare(b.visibility || "");
    case "type":
      return dir * (a.serviceType || "").localeCompare(b.serviceType || "");
    case "port":
      return dir * ((a.port || 0) - (b.port || 0));
    case "address":
      return dir * (a.url || "").localeCompare(b.url || "");
    case "subdomain":
      return dir * getSubdomain(a.domain).localeCompare(getSubdomain(b.domain));
    case "domain":
      return dir * getRootDomain(a.domain).localeCompare(getRootDomain(b.domain));
    case "response":
      return dir * ((a.responseTimeMs ?? Infinity) - (b.responseTimeMs ?? Infinity));
    case "device":
      return dir * (a.device || "").localeCompare(b.device || "");
    default:
      return 0;
  }
}

/**
 * Derive Type and Host filter options from loaded service data.
 * Returns the full SORT_OPTIONS object, extending the static ones.
 */
function buildFilterOptions(items) {
  const types = [...new Set(items.map((s) => s.serviceType).filter(Boolean))].sort();
  const hosts = [...new Set(items.map((s) => s.device).filter(Boolean))].sort();

  return {
    ...STATIC_FILTER_OPTIONS,
    serviceType: {
      label: "Type",
      values: types.map((t) => ({ value: t, label: t })),
    },
    device: {
      label: "Device",
      values: hosts.map((h) => ({ value: h, label: h })),
    },
  };
}

// ── Byte Formatting ───────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(2) : val < 100 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

export default function ServicesComponent() {
  const [services, setServices] = useState([]);
  const [infrastructure, setInfrastructure] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const didFetch = useRef(false);

  // ── Filter state ────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    status: [],
    visibility: [],
    environment: [],
    serviceType: [],
    device: [],
  });

  // ── System info state ──────────────────────────────────────────
  const [systemInfo, setSystemInfo] = useState(null);

  // ── Sort state ──────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  // ── View mode state ────────────────────────────────────────────
  const [viewMode, setViewMode] = useState("table");

  // ── Container stats (polled every 5s) ──────────────────────────
  const [containerStats, setContainerStats] = useState({});

  const fetchContainerStats = useCallback(async () => {
    try {
      const [historyRes, currentRes] = await Promise.all([
        ApiService.getContainerStatsHistory(),
        ApiService.getContainerStats(),
      ]);

      // Build sparkline data per container name from history
      const sparkMap = {};
      if (historyRes?.history) {
        for (const snapshot of historyRes.history) {
          for (const [name, stats] of Object.entries(snapshot.containers)) {
            if (!sparkMap[name]) sparkMap[name] = { cpu: [], mem: [] };
            sparkMap[name].cpu.push(stats.cpu);
            sparkMap[name].mem.push(stats.memoryUsed);
          }
        }
      }

      // Merge current snapshot with sparklines, keyed by container name
      const statsMap = {};
      if (currentRes?.containers) {
        for (const c of currentRes.containers) {
          statsMap[c.name] = {
            cpu: c.cpu,
            memory: c.memory,
            network: c.network,
            blockIO: c.blockIO,
            pids: c.pids,
            spark: sparkMap[c.name] || null,
          };
        }
      }

      setContainerStats(statsMap);
    } catch {
      // Silently ignore — container stats are supplementary
    }
  }, []);

  // ── Fetch system info ──────────────────────────────────────────
  const fetchSystemInfo = useCallback(async () => {
    try {
      const res = await ApiService.getSystemInfo().catch(() => null);
      setSystemInfo(res);
    } catch {
      // Supplementary — silently ignore
    }
  }, []);

  async function loadServices(refresh = false) {
    try {
      const res = await ApiService.getServices(refresh);
      setServices(res.services || []);
      setInfrastructure(res.infrastructure || []);
    } catch (err) {
      console.error("Services fetch failed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadServices(true);
    fetchContainerStats();
    fetchSystemInfo();
  }, [fetchContainerStats, fetchSystemInfo]);

  // Poll container stats every 5 seconds
  useEffect(() => {
    const timer = setInterval(fetchContainerStats, 5_000);
    return () => clearInterval(timer);
  }, [fetchContainerStats]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadServices(true);
  };

  const setFilter = (dimension, values) => {
    setFilters((prev) => ({ ...prev, [dimension]: values }));
  };

  // ── Apply filters & sort ────────────────────────────────────────
  const allItems = [...services, ...infrastructure];
  const filterOptions = buildFilterOptions(allItems);

  const filtered = allItems
    .filter((s) => {
      if (filters.status.length) {
        const isHealthy = s.healthy;
        if (!filters.status.some((v) => (v === "healthy" && isHealthy) || (v === "unhealthy" && !isHealthy))) return false;
      }
      if (filters.visibility.length && !filters.visibility.includes(s.visibility)) return false;
      if (filters.environment.length && !filters.environment.includes(s.environment)) return false;
      if (filters.serviceType.length && !filters.serviceType.includes(s.serviceType)) return false;
      if (filters.device.length && !filters.device.includes(s.device)) return false;
      return true;
    })
    .sort((a, b) => compareBySortKey(a, b, sortKey, sortDir));

  const healthyCount = allItems.filter((s) => s.healthy).length;
  const hasActiveFilter = Object.values(filters).some((v) => v.length > 0);

  // ── System summary computed values ──────────────────────────────
  const allContainerStats = Object.values(containerStats);
  const totalCpuUsage = allContainerStats.reduce((sum, c) => sum + (c.cpu?.percent || 0), 0);
  const totalMemUsed = allContainerStats.reduce((sum, c) => sum + (c.memory?.used || 0), 0);
  const totalMemLimit = systemInfo?.totalMemory || (allContainerStats.length > 0 ? allContainerStats[0]?.memory?.limit || 0 : 0);
  const memPercent = totalMemLimit > 0 ? (totalMemUsed / totalMemLimit) * 100 : 0;
  const hostDisk = systemInfo?.hostDisk;

  const handleRestart = async (serviceId) => {
    try {
      await ApiService.restartService(serviceId);
      setTimeout(() => loadServices(true), 5000);
    } catch (err) {
      console.error("Restart failed:", err);
    }
  };

  const handleStop = async (serviceId) => {
    try {
      await ApiService.stopService(serviceId);
      setTimeout(() => loadServices(true), 5000);
    } catch (err) {
      console.error("Stop failed:", err);
    }
  };

  const handleStart = async (serviceId) => {
    try {
      await ApiService.startService(serviceId);
      setTimeout(() => loadServices(true), 5000);
    } catch (err) {
      console.error("Start failed:", err);
    }
  };

  return (
    <div className={styles.services}>
      <PageHeaderComponent sticky={false}
        title="Projects"
        subtitle={
          loading
            ? "Checking service health…"
            : `${healthyCount} of ${allItems.length} services healthy`
        }
      >
        <ButtonComponent
          variant="secondary"
          icon={RefreshCw}
          loading={refreshing}
          onClick={handleRefresh}
        >
          Check All
        </ButtonComponent>
      </PageHeaderComponent>

      {/* ── System Summary Cards ────────────────────────────────── */}
      {!loading && (
        <div className={styles.summaryGrid}>
          <div className={styles.statCard}>
            <div className={styles.statCardIcon} style={{ color: "#6366f1", background: "rgba(99,102,241,0.08)" }}>
              <Server size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>{allItems.length}</span>
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

      {/* ── Filter + Sort Bar ── */}
      {!loading && (
        <div className={styles.sortBar}>
          {/* ── Filters ── */}
          <div className={styles.sortBarIcon}>
            <ArrowUpDown size={13} strokeWidth={2.2} />
            <span>Filter</span>
          </div>

          {Object.entries(filterOptions).map(([dimension, config]) => (
            <div key={dimension} className={styles.sortGroup}>
              <span className={styles.sortGroupLabel}>{config.label}</span>
              <MultiSelectComponent
                value={filters[dimension]}
                options={config.values}
                onChange={(values) => setFilter(dimension, values)}
                allLabel="All"
              />
            </div>
          ))}

          {hasActiveFilter && (
            <button
              className={styles.clearBtn}
              onClick={() =>
                setFilters({ status: [], visibility: [], environment: [], serviceType: [], device: [] })
              }
            >
              Clear
            </button>
          )}

          {/* ── Divider ── */}
          <div className={styles.barDivider} />

          {/* ── Sort By ── */}
          <div className={styles.sortBarIcon}>
            <ArrowDownAZ size={13} strokeWidth={2.2} />
            <span>Sort</span>
          </div>

          <div className={styles.sortGroup}>
            <div className={styles.segmentedControl}>
              {SORT_BY_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  className={`${styles.segmentBtn} ${
                    sortKey === opt.key ? styles.segmentActive : ""
                  }`}
                  onClick={() => {
                    if (sortKey === opt.key) {
                      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                    } else {
                      setSortKey(opt.key);
                      setSortDir("asc");
                    }
                  }}
                >
                  {opt.label}
                  {sortKey === opt.key && (
                    <span className={styles.sortDirIndicator}>
                      {sortDir === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Divider ── */}
          <div className={styles.barDivider} />

          {/* ── View Mode Toggle ── */}
          <div className={styles.sortBarIcon}>
            <span>View</span>
          </div>

          <div className={styles.sortGroup}>
            <div className={styles.segmentedControl}>
              <button
                className={`${styles.segmentBtn} ${styles.segmentBtnIcon} ${
                  viewMode === "card" ? styles.segmentActive : ""
                }`}
                onClick={() => setViewMode("card")}
                title="Card view"
              >
                <LayoutGrid size={12} strokeWidth={2.2} />
              </button>
              <button
                className={`${styles.segmentBtn} ${styles.segmentBtnIcon} ${
                  viewMode === "table" ? styles.segmentActive : ""
                }`}
                onClick={() => setViewMode("table")}
                title="Table view"
              >
                <Table2 size={12} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingIndicatorComponent size="small" label="Polling services…" className="loading-center" />
      ) : (
        <>
          {hasActiveFilter && (
            <div className={styles.filterSummary}>
              Showing {filtered.length} of {allItems.length} services
            </div>
          )}

          {viewMode === "card" ? (
            <div className={styles.grid}>
              {filtered.map((service) => (
                <ServiceCardComponent
                  key={service.id}
                  service={service}
                  containerStats={service.dockerProject ? containerStats[service.dockerProject] : null}
                  onRestart={handleRestart}
                  onStop={handleStop}
                  onStart={handleStart}
                />
              ))}
              {filtered.length === 0 && (
                <div className={styles.emptyState}>
                  No services match the selected filters
                </div>
              )}
            </div>
          ) : (
            <ServiceTableComponent
              services={filtered}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={(key, dir) => {
                setSortKey(key);
                setSortDir(dir);
              }}
              onRestart={handleRestart}
              onStop={handleStop}
              onStart={handleStart}
            />
          )}
        </>
      )}
    </div>
  );
}
