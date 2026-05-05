"use client";

import { useState, useRef, useEffect } from "react";
import { LoadingStateComponent, PageHeaderComponent, TableComponent } from "@rodrigo-barraza/components";
import { formatCostAdaptive } from "@rodrigo-barraza/utilities";

import ApiService from "../services/ApiService";
import styles from "./AnalyticsComponent.module.css";

export default function AnalyticsComponent() {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState(null);
  const [period, setPeriod] = useState("24h");
  const [loading, setLoading] = useState(true);
  const didFetch = useRef(false);

  async function loadData() {
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

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadData();
  }, []);

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

  return (
    <div className={styles.analytics}>
      <PageHeaderComponent sticky={false} title="Analytics" subtitle="Usage statistics from Prism">
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
            title="Overview"
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
