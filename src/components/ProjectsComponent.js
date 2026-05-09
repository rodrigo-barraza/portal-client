"use client";

import { useState, useRef, useEffect } from "react";
import { RefreshCw, ArrowUpDown, LayoutGrid, Table2, FolderKanban, HeartPulse, Server, Layers } from "lucide-react";
import { ButtonComponent, LoadingIndicatorComponent, PageHeaderComponent, MultiSelectComponent } from "@rodrigo-barraza/components-library";
import { getRootDomain } from "@rodrigo-barraza/utilities-library";

import ServiceCardComponent from "./ServiceCardComponent";
import ProjectTableComponent from "./ProjectTableComponent";
import ApiService from "../services/ApiService";
import styles from "./ProjectsComponent.module.css";

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
      return dir * (a.projectType || "").localeCompare(b.projectType || "");
    case "port":
      return dir * ((a.port || 0) - (b.port || 0));
    case "address":
      return dir * (a.url || "").localeCompare(b.url || "");

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
  const types = [...new Set(items.map((s) => s.projectType).filter(Boolean))].sort();
  const hosts = [...new Set(items.map((s) => s.device).filter(Boolean))].sort();

  return {
    ...STATIC_FILTER_OPTIONS,
    projectType: {
      label: "Type",
      values: types.map((t) => ({ value: t, label: t })),
    },
    device: {
      label: "Device",
      values: hosts.map((h) => ({ value: h, label: h })),
    },
  };
}



export default function ProjectsComponent() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const didFetch = useRef(false);

  // ── Filter state ────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    status: [],
    visibility: [],
    environment: [],
    projectType: [],
    device: [],
  });



  // ── Sort state ──────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  // ── View mode state ────────────────────────────────────────────
  const [viewMode, setViewMode] = useState("table");





  async function loadServices(refresh = false) {
    try {
      const res = await ApiService.getServices(refresh);
      setServices((res.services || []).filter((s) => s.projectType !== "Infrastructure"));
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

  const setFilter = (dimension, values) => {
    setFilters((prev) => ({ ...prev, [dimension]: values }));
  };

  // ── Apply filters & sort ────────────────────────────────────────
  const allItems = services;
  const filterOptions = buildFilterOptions(allItems);

  const filtered = allItems
    .filter((s) => {
      if (filters.status.length) {
        const isHealthy = s.healthy;
        if (!filters.status.some((v) => (v === "healthy" && isHealthy) || (v === "unhealthy" && !isHealthy))) return false;
      }
      if (filters.visibility.length && !filters.visibility.includes(s.visibility)) return false;
      if (filters.environment.length && !filters.environment.includes(s.environment)) return false;
      if (filters.projectType.length && !filters.projectType.includes(s.projectType)) return false;
      if (filters.device.length && !filters.device.includes(s.device)) return false;
      return true;
    })
    .sort((a, b) => compareBySortKey(a, b, sortKey, sortDir));

  const healthyCount = allItems.filter((s) => s.healthy).length;
  const hasActiveFilter = Object.values(filters).some((v) => v.length > 0);

  // ── Project summary computed values ─────────────────────────────
  const unhealthyCount = allItems.length - healthyCount;
  const uniqueDevices = [...new Set(allItems.map((s) => s.device).filter(Boolean))];
  const uniqueTypes = [...new Set(allItems.map((s) => s.projectType).filter(Boolean))];



  return (
    <div className={styles.services}>
      <PageHeaderComponent sticky={false}
        title="Projects"
        subtitle={
          loading
            ? "Checking project health…"
            : `${healthyCount} of ${allItems.length} projects healthy`
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

      {/* ── Project Summary Cards ───────────────────────────────── */}
      {!loading && (
        <div className={styles.summaryGrid}>
          <div className={styles.statCard}>
            <div className={styles.statCardIcon} style={{ color: "#6366f1", background: "rgba(99,102,241,0.08)" }}>
              <FolderKanban size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>{allItems.length}</span>
              <span className={styles.statCardLabel}>Projects</span>
              <span className={styles.statCardSub}>{filtered.length !== allItems.length ? `${filtered.length} matching filters` : `${allItems.length} registered`}</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statCardIcon} style={{ color: "#10b981", background: "rgba(16,185,129,0.08)" }}>
              <HeartPulse size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>{healthyCount}</span>
              <span className={styles.statCardLabel}>Healthy</span>
              <span className={styles.statCardSub}>{unhealthyCount > 0 ? `${unhealthyCount} unhealthy` : "All systems nominal"}</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statCardIcon} style={{ color: "#3b82f6", background: "rgba(59,130,246,0.08)" }}>
              <Server size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>{uniqueDevices.length}</span>
              <span className={styles.statCardLabel}>Devices</span>
              <span className={styles.statCardSub}>{uniqueDevices.join(" · ") || "No devices"}</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statCardIcon} style={{ color: "#a855f7", background: "rgba(168,85,247,0.08)" }}>
              <Layers size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>{uniqueTypes.length}</span>
              <span className={styles.statCardLabel}>Types</span>
              <span className={styles.statCardSub}>{uniqueTypes.join(" · ") || "No types"}</span>
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
                setFilters({ status: [], visibility: [], environment: [], projectType: [], device: [] })
              }
            >
              Clear
            </button>
          )}



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
        <LoadingIndicatorComponent size="small" label="Polling projects…" className="loading-center" />
      ) : (
        <>
          {hasActiveFilter && (
            <div className={styles.filterSummary}>
              Showing {filtered.length} of {allItems.length} projects
            </div>
          )}

          {viewMode === "card" ? (
            <div className={styles.grid}>
              {filtered.map((service) => (
                <ServiceCardComponent
                  key={service.id}
                  service={service}
                />
              ))}
              {filtered.length === 0 && (
                <div className={styles.emptyState}>
                  No projects match the selected filters
                </div>
              )}
            </div>
          ) : (
            <ProjectTableComponent
              services={filtered}
              allServices={allItems}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={(key, dir) => {
                setSortKey(key);
                setSortDir(dir);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
