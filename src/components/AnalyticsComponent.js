"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { LoadingStateComponent, PageHeaderComponent, TableComponent } from "@rodrigo-barraza/components-library";
import { formatCostAdaptive } from "@rodrigo-barraza/utilities";

import ApiService from "../services/ApiService";
import styles from "./AnalyticsComponent.module.css";

// ── Byte Formatting ───────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value < 10 ? value.toFixed(2) : value < 100 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

// ── Auto-refresh interval (ms) ────────────────────────────────────
const CONTAINER_POLL_INTERVAL = 15_000;

export default function AnalyticsComponent() {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState(null);
  const [containerStats, setContainerStats] = useState(null);
  const [period, setPeriod] = useState("24h");
  const [loading, setLoading] = useState(true);
  const [containersLoading, setContainersLoading] = useState(true);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const didFetch = useRef(false);
  const pollRef = useRef(null);

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

  const loadContainerData = useCallback(async () => {
    try {
      const res = await ApiService.getContainerStats();
      setContainerStats(res);
    } catch (err) {
      console.error("Container stats fetch failed:", err);
    } finally {
      setContainersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadPrismData();
    loadContainerData();
  }, [loadContainerData]);

  // Auto-refresh container stats
  useEffect(() => {
    pollRef.current = setInterval(loadContainerData, CONTAINER_POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [loadContainerData]);

  const overview = stats?.stats || {};

  // ── Transform overview object into rows for TableComponent ──
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

  // ── Container sorting ───────────────────────────────────────
  const containers = containerStats?.containers || [];

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function getSortValue(c, key) {
    switch (key) {
      case "name": return c.name;
      case "cpu": return c.cpu.percent;
      case "memory": return c.memory.used;
      case "memPercent": return c.memory.percent;
      case "netRx": return c.network.rx;
      case "netTx": return c.network.tx;
      case "pids": return c.pids;
      default: return c.name;
    }
  }

  const sorted = [...containers].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    const cmp = typeof aVal === "string" ? aVal.localeCompare(bVal) : aVal - bVal;
    return sortDir === "asc" ? cmp : -cmp;
  });

  // ── Render helpers ──────────────────────────────────────────
  function renderBar(percent, color) {
    const clampedPercent = Math.min(percent, 100);
    return (
      <div className={styles.barTrack}>
        <div
          className={styles.barFill}
          style={{
            width: `${clampedPercent}%`,
            background: color,
          }}
        />
      </div>
    );
  }

  function cpuColor(pct) {
    if (pct > 80) return "var(--danger)";
    if (pct > 40) return "var(--warning)";
    return "var(--success)";
  }

  function memColor(pct) {
    if (pct > 85) return "var(--danger)";
    if (pct > 60) return "var(--warning)";
    return "var(--info)";
  }

  const sortIcon = (key) => {
    if (sortKey !== key) return null;
    return (
      <span className={styles.sortArrow}>
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  return (
    <div className={styles.analytics}>
      <PageHeaderComponent sticky={false} title="Analytics" subtitle="Usage statistics and container telemetry">
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

      {/* ── Container Stats ─────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Container Resources</h2>
          {containerStats?.fetchedAt && (
            <span className={styles.sectionMeta}>
              {containers.length} container{containers.length !== 1 ? "s" : ""} · {" "}
              updated {new Date(containerStats.fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {containersLoading ? (
          <LoadingStateComponent message="Polling Docker engine…" />
        ) : containers.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No running containers found</p>
            <span className={styles.emptyDetail}>Is Docker socket mounted?</span>
          </div>
        ) : (
          <div className={styles.containerTable}>
            <table className={styles.statsTable}>
              <thead>
                <tr>
                  <th className={styles.thClickable} onClick={() => handleSort("name")}>
                    Container {sortIcon("name")}
                  </th>
                  <th className={styles.thClickable} onClick={() => handleSort("cpu")}>
                    CPU {sortIcon("cpu")}
                  </th>
                  <th className={styles.thClickable} onClick={() => handleSort("memPercent")}>
                    Memory {sortIcon("memPercent")}
                  </th>
                  <th className={styles.thClickable} onClick={() => handleSort("netRx")}>
                    Net I/O {sortIcon("netRx")}
                  </th>
                  <th className={styles.thClickable} onClick={() => handleSort("pids")}>
                    PIDs {sortIcon("pids")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c, i) => (
                  <tr
                    key={c.id}
                    className={styles.containerRow}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <td className={styles.nameCell}>
                      <div className={styles.containerName}>{c.name}</div>
                      <div className={styles.containerMeta}>{c.status}</div>
                    </td>
                    <td className={styles.metricCell}>
                      <div className={styles.metricValue}>
                        <span className={styles.metricNumber}>{c.cpu.percent.toFixed(1)}%</span>
                      </div>
                      {renderBar(c.cpu.percent, cpuColor(c.cpu.percent))}
                    </td>
                    <td className={styles.metricCell}>
                      <div className={styles.metricValue}>
                        <span className={styles.metricNumber}>{formatBytes(c.memory.used)}</span>
                        <span className={styles.metricDim}> / {formatBytes(c.memory.limit)}</span>
                      </div>
                      {renderBar(c.memory.percent, memColor(c.memory.percent))}
                    </td>
                    <td className={styles.metricCell}>
                      <div className={styles.netRow}>
                        <span className={styles.netLabel}>↓</span>
                        <span className={styles.metricNumber}>{formatBytes(c.network.rx)}</span>
                      </div>
                      <div className={styles.netRow}>
                        <span className={styles.netLabel}>↑</span>
                        <span className={styles.metricNumber}>{formatBytes(c.network.tx)}</span>
                      </div>
                    </td>
                    <td className={styles.pidCell}>
                      <span className={styles.metricNumber}>{c.pids}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Prism Stats ────────────────────────────────────────── */}
      {loading ? (
        <LoadingStateComponent message="Loading analytics…" />
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
