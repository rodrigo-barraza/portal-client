"use client";

import { useState, useRef, useEffect } from "react";
import PageHeaderComponent from "./PageHeaderComponent";
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

  return (
    <div className={styles.analytics}>
      <PageHeaderComponent title="Analytics" subtitle="Usage statistics from Prism">
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
        <div className={styles.loadingState}>
          <div className={styles.loadingDot} />
          <span>Loading analytics…</span>
        </div>
      ) : stats?.error ? (
        <div className={styles.errorState}>
          <p>Could not fetch analytics data</p>
          <span className={styles.errorDetail}>{stats.error}</span>
        </div>
      ) : (
        <div className={styles.content}>
          <div className={styles.tableCard}>
            <h3 className={styles.cardTitle}>Overview</h3>
            <table className={styles.table}>
              <tbody>
                {Object.entries(overview).map(([key, value]) => (
                  <tr key={key}>
                    <td className={styles.tableKey}>{key}</td>
                    <td className={styles.tableValue}>
                      {typeof value === "number"
                        ? value.toLocaleString()
                        : String(value ?? "—")}
                    </td>
                  </tr>
                ))}
                {Object.keys(overview).length === 0 && (
                  <tr>
                    <td className={styles.tableKey} colSpan={2}>
                      No stats available — is Prism running?
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {Array.isArray(projects) && projects.length > 0 && (
            <div className={styles.tableCard}>
              <h3 className={styles.cardTitle}>Projects</h3>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Requests</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p, i) => (
                    <tr key={i}>
                      <td className={styles.tableKey}>
                        {p.project || p._id || "—"}
                      </td>
                      <td className={styles.tableValue}>
                        {(p.totalRequests || p.count || 0).toLocaleString()}
                      </td>
                      <td className={styles.tableValue}>
                        ${(p.totalCost || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
