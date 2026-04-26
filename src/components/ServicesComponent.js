"use client";

import { useState, useRef, useEffect } from "react";
import { RefreshCw, ArrowUpDown } from "lucide-react";
import PageHeaderComponent from "./PageHeaderComponent";
import ServiceCardComponent from "./ServiceCardComponent";
import PortalApiService from "../services/PortalApiService";
import styles from "./ServicesComponent.module.css";

// ── Static filter option definitions ─────────────────────────────
const STATIC_SORT_OPTIONS = {
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
  environment: {
    label: "Environment",
    values: [
      { key: "all", label: "All" },
      { key: "Production", label: "Production" },
      { key: "Development", label: "Development" },
    ],
  },
};

/**
 * Derive Type and Host filter options from loaded service data.
 * Returns the full SORT_OPTIONS object, extending the static ones.
 */
function buildSortOptions(items) {
  const types = [...new Set(items.map((s) => s.serviceType).filter(Boolean))].sort();
  const hosts = [...new Set(items.map((s) => s.device).filter(Boolean))].sort();

  return {
    ...STATIC_SORT_OPTIONS,
    serviceType: {
      label: "Type",
      values: [
        { key: "all", label: "All" },
        ...types.map((t) => ({ key: t, label: t })),
      ],
    },
    device: {
      label: "Device",
      values: [
        { key: "all", label: "All" },
        ...hosts.map((h) => ({ key: h, label: h })),
      ],
    },
  };
}

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
    environment: "all",
    serviceType: "all",
    device: "all",
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
  const sortOptions = buildSortOptions(allItems);

  const filtered = allItems.filter((s) => {
    if (filters.status === "healthy" && !s.healthy) return false;
    if (filters.status === "unhealthy" && s.healthy) return false;
    if (filters.visibility !== "all" && s.visibility !== filters.visibility) return false;
    if (filters.environment !== "all" && s.environment !== filters.environment) return false;
    if (filters.serviceType !== "all" && s.serviceType !== filters.serviceType) return false;
    if (filters.device !== "all" && s.device !== filters.device) return false;
    return true;
  });

  const healthyCount = allItems.filter((s) => s.healthy).length;
  const hasActiveFilter = Object.values(filters).some((v) => v !== "all");

  const handleRestart = async (serviceId) => {
    try {
      await PortalApiService.restartService(serviceId);
      setTimeout(() => loadServices(true), 5000);
    } catch (err) {
      console.error("Restart failed:", err);
    }
  };

  const handleStop = async (serviceId) => {
    try {
      await PortalApiService.stopService(serviceId);
      setTimeout(() => loadServices(true), 5000);
    } catch (err) {
      console.error("Stop failed:", err);
    }
  };

  const handleStart = async (serviceId) => {
    try {
      await PortalApiService.startService(serviceId);
      setTimeout(() => loadServices(true), 5000);
    } catch (err) {
      console.error("Start failed:", err);
    }
  };

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

          {Object.entries(sortOptions).map(([dimension, config]) => (
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
                setFilters({ status: "all", visibility: "all", environment: "all", serviceType: "all", device: "all" })
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
              <ServiceCardComponent key={service.id} service={service} onRestart={handleRestart} onStop={handleStop} onStart={handleStart} />
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
