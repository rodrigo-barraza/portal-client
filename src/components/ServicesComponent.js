"use client";

import { useState, useRef, useEffect } from "react";
import { RefreshCw, ArrowUpDown } from "lucide-react";
import PageHeaderComponent from "./PageHeaderComponent";
import ServiceCardComponent from "./ServiceCardComponent";
import PortalApiService from "../services/PortalApiService";
import styles from "./ServicesComponent.module.css";

// ── Sort option definitions ──────────────────────────────────────
const SORT_OPTIONS = {
  status: {
    label: "Status",
    values: [
      { key: "all", label: "All" },
      { key: "healthy", label: "Healthy" },
      { key: "unhealthy", label: "Down" },
    ],
  },
  visibility: {
    label: "Visibility",
    values: [
      { key: "all", label: "All" },
      { key: "external", label: "External" },
      { key: "internal", label: "Internal" },
    ],
  },
  stage: {
    label: "Environment",
    values: [
      { key: "all", label: "All" },
      { key: "Production", label: "Production" },
      { key: "Development", label: "Development" },
    ],
  },
};

export default function ServicesComponent() {
  const [services, setServices] = useState([]);
  const [infrastructure, setInfrastructure] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const didFetch = useRef(false);

  // ── Filter state ────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    status: "all",
    visibility: "all",
    stage: "all",
  });

  async function loadServices(refresh = false) {
    try {
      const res = await PortalApiService.getServices(refresh);
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
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadServices(true);
  };

  const setFilter = (dimension, value) => {
    setFilters((prev) => ({ ...prev, [dimension]: value }));
  };

  // ── Apply filters ───────────────────────────────────────────────
  const allItems = [...services, ...infrastructure];

  const filtered = allItems.filter((s) => {
    if (filters.status === "healthy" && !s.healthy) return false;
    if (filters.status === "unhealthy" && s.healthy) return false;
    if (filters.visibility !== "all" && s.visibility !== filters.visibility) return false;
    if (filters.stage !== "all" && s.stage !== filters.stage) return false;
    return true;
  });

  const healthyCount = allItems.filter((s) => s.healthy).length;
  const hasActiveFilter = Object.values(filters).some((v) => v !== "all");

  return (
    <div className={styles.services}>
      <PageHeaderComponent
        title="Services"
        subtitle={
          loading
            ? "Checking service health…"
            : `${healthyCount} of ${allItems.length} services healthy`
        }
      >
        <button
          className={styles.refreshBtn}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw
            size={15}
            strokeWidth={2}
            className={refreshing ? styles.spinning : ""}
          />
          Check All
        </button>
      </PageHeaderComponent>

      {/* ── Sort / Filter Bar ── */}
      {!loading && (
        <div className={styles.sortBar}>
          <div className={styles.sortBarIcon}>
            <ArrowUpDown size={13} strokeWidth={2.2} />
            <span>Filter</span>
          </div>

          {Object.entries(SORT_OPTIONS).map(([dimension, config]) => (
            <div key={dimension} className={styles.sortGroup}>
              <span className={styles.sortGroupLabel}>{config.label}</span>
              <div className={styles.segmentedControl}>
                {config.values.map((opt) => (
                  <button
                    key={opt.key}
                    className={`${styles.segmentBtn} ${
                      filters[dimension] === opt.key ? styles.segmentActive : ""
                    }`}
                    onClick={() => setFilter(dimension, opt.key)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {hasActiveFilter && (
            <button
              className={styles.clearBtn}
              onClick={() =>
                setFilters({ status: "all", visibility: "all", stage: "all" })
              }
            >
              Clear
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.loadingDot} />
          <span>Polling services…</span>
        </div>
      ) : (
        <>
          {hasActiveFilter && (
            <div className={styles.filterSummary}>
              Showing {filtered.length} of {allItems.length} services
            </div>
          )}

          <div className={styles.grid}>
            {filtered.map((service) => (
              <ServiceCardComponent key={service.id} service={service} />
            ))}
            {filtered.length === 0 && (
              <div className={styles.emptyState}>
                No services match the selected filters
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
