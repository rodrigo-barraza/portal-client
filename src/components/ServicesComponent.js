"use client";

import { useState, useRef, useEffect } from "react";
import { RefreshCw, ArrowUpDown, ArrowDownAZ, LayoutGrid, Table2 } from "lucide-react";
import { ButtonComponent, LoadingStateComponent, PageHeaderComponent } from "@rodrigo-barraza/components";
import { getRootDomain, getSubdomain } from "@rodrigo-barraza/utilities";

import ServiceCardComponent from "./ServiceCardComponent";
import ServiceTableComponent from "./ServiceTableComponent";
import ApiService from "../services/ApiService";
import styles from "./ServicesComponent.module.css";

// ── Static filter option definitions ─────────────────────────────
const STATIC_FILTER_OPTIONS = {
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

  // ── Sort state ──────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  // ── View mode state ────────────────────────────────────────────
  const [viewMode, setViewMode] = useState("card");

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
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadServices(true);
  };

  const setFilter = (dimension, value) => {
    setFilters((prev) => ({ ...prev, [dimension]: value }));
  };

  // ── Apply filters & sort ────────────────────────────────────────
  const allItems = [...services, ...infrastructure];
  const filterOptions = buildFilterOptions(allItems);

  const filtered = allItems
    .filter((s) => {
      if (filters.status === "healthy" && !s.healthy) return false;
      if (filters.status === "unhealthy" && s.healthy) return false;
      if (filters.visibility !== "all" && s.visibility !== filters.visibility) return false;
      if (filters.environment !== "all" && s.environment !== filters.environment) return false;
      if (filters.serviceType !== "all" && s.serviceType !== filters.serviceType) return false;
      if (filters.device !== "all" && s.device !== filters.device) return false;
      return true;
    })
    .sort((a, b) => compareBySortKey(a, b, sortKey, sortDir));

  const healthyCount = allItems.filter((s) => s.healthy).length;
  const hasActiveFilter = Object.values(filters).some((v) => v !== "all");

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
        title="Services"
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
        <LoadingStateComponent message="Polling services…" />
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
                <ServiceCardComponent key={service.id} service={service} onRestart={handleRestart} onStop={handleStop} onStart={handleStart} />
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
