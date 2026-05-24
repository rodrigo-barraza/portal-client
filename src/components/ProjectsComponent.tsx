"use client";

import { useState, useRef, useEffect } from "react";
import {
  RefreshCw,
  ArrowUpDown,
  LayoutGrid,
  Table2,
  FolderKanban,
  HeartPulse,
  Server,
  Layers,
  HardDrive,
  BookOpen,
} from "lucide-react";
import {
  ButtonComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
  MultiSelectComponent,
} from "@rodrigo-barraza/components-library";
import { formatBytes } from "@rodrigo-barraza/utilities-library";

import ServiceCardComponent from "./ServiceCardComponent";
import ProjectTableComponent from "./ProjectTableComponent";
import ApiService from "../services/ApiService";
import styles from "./ProjectsComponent.module.css";
import type { PortalService } from "../types/portal";

// ── Project type classification ──────────────────────────────────
// Non-deployed project types — these don't run as Docker containers
const NON_DEPLOYED_TYPES = new Set(["Library", "Kit", "Tool"]);

/** Whether a project is a deployed (containerized) service. */
function isDeployedProject(service: PortalService) {
  return !NON_DEPLOYED_TYPES.has(service.projectType as string);
}

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
function compareBySortKey(a: PortalService, b: PortalService, sortKey: string, sortDir: string) {
  const dir = sortDir === "asc" ? 1 : -1;
  switch (sortKey) {
    case "name":
      return dir * (a.name || "").localeCompare(b.name || "");
    case "status":
      // healthy first in asc, down first in desc
      return dir * ((b.healthy ? 1 : 0) - (a.healthy ? 1 : 0));
    case "type":
      return dir * (a.projectType || "").localeCompare(b.projectType || "");
    case "tier":
      return dir * ((a.deployTier ?? 99) - (b.deployTier ?? 99));
    case "essential":
      return dir * ((b.essential ? 1 : 0) - (a.essential ? 1 : 0));
    case "domain":
      return dir * (a.domain || "").localeCompare(b.domain || "");
    case "repo":
      return dir * (a.repo || "").localeCompare(b.repo || "");
    case "dependencies":
      return dir * ((a.dependsOn || []).length - (b.dependsOn || []).length);
    case "database":
      return dir * (a.db || "").localeCompare(b.db || "");
    case "containers":
      return dir * ((a.dockerProject ? 1 : 0) - (b.dockerProject ? 1 : 0));
    default:
      return 0;
  }
}

/**
 * Derive Type and Host filter options from loaded service data.
 * Returns the full SORT_OPTIONS object, extending the static ones.
 */
function buildFilterOptions(items: PortalService[]) {
  const types: string[] = [
    ...new Set<string>(items.map((s: PortalService) => s.projectType as string).filter(Boolean)),
  ].sort();
  const hosts: string[] = [...new Set<string>(items.map((s: PortalService) => s.device as string).filter(Boolean))].sort();

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
  const [services, setServices] = useState<PortalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [projectSizes, setProjectSizes] = useState<Record<string, { sizeBytes: number; sizeKB: number }>>({});
  const [projectLanguages, setProjectLanguages] = useState<Record<string, { primary: string; breakdown: { language: string; percent: number }[] }>>({});
  const didFetch = useRef(false);

  // ── Filter state ────────────────────────────────────────────────
  const [filters, setFilters] = useState<Record<string, string[]>>({
    status: [],
    visibility: [],
    environment: [],
    projectType: [],
    device: [],
  });

  // ── Sort state ──────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ── View mode state ────────────────────────────────────────────
  const [viewMode, setViewMode] = useState("table");

  async function loadServices(refresh = false) {
    try {
      const res = await ApiService.getServices(refresh);
      setServices(
        (res.services || []).filter((s: PortalService) => s.projectType !== "Infrastructure"),
      );
    } catch (error) {
      console.error("Services fetch failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadSizes() {
    try {
      const res = await ApiService.getProjectSizes();
      setProjectSizes(res.sizes || {});
    } catch (error) {
      console.error("Project sizes fetch failed:", error);
    }
  }

  async function loadLanguages() {
    try {
      const res = await ApiService.getProjectLanguages();
      setProjectLanguages(res.languages || {});
    } catch (error) {
      console.error("Project languages fetch failed:", error);
    }
  }

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadServices(true);
    loadSizes();
    loadLanguages();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadServices(true);
  };

  const setFilter = (dimension: string, values: string[]) => {
    setFilters((prev) => ({ ...prev, [dimension]: values }));
  };

  // ── Apply filters & sort ────────────────────────────────────────
  const allItems = services;
  const filterOptions = buildFilterOptions(allItems);

  const filtered = allItems
    .filter((s) => {
      if (filters.status.length) {
        const isHealthy = s.healthy;
        if (
          !filters.status.some(
            (v) =>
              (v === "healthy" && isHealthy) ||
              (v === "unhealthy" && !isHealthy),
          )
        )
          return false;
      }
      if (filters.visibility.length && !filters.visibility.includes(s.visibility as string))
        return false;
      if (filters.environment.length && !filters.environment.includes(s.environment as string))
        return false;
      if (filters.projectType.length && !filters.projectType.includes(s.projectType as string))
        return false;
      if (filters.device.length && !filters.device.includes(s.device as string))
        return false;
      return true;
    })
    .sort((a: PortalService, b: PortalService) => compareBySortKey(a, b, sortKey, sortDir));

  // ── Split into deployed services vs libraries/toolkits ──────────
  const deployedItems = filtered.filter(isDeployedProject);
  const nonDeployedItems = filtered.filter((s) => !isDeployedProject(s));

  // ── Summary stats (based on all unfiltered items) ───────────────
  const allDeployed = allItems.filter(isDeployedProject);
  const allNonDeployed = allItems.filter((s) => !isDeployedProject(s));
  const healthyCount = allDeployed.filter((s) => s.healthy).length;
  const hasActiveFilter = Object.values(filters).some((v) => v.length > 0);

  // ── Project summary computed values ─────────────────────────────
  const unhealthyCount = allDeployed.length - healthyCount;
  const uniqueDevices = [
    ...new Set(allDeployed.map((s) => s.device).filter(Boolean)),
  ];
  const uniqueTypes = [
    ...new Set(allItems.map((s) => s.projectType).filter(Boolean)),
  ];
  const totalSizeBytes = Object.values(projectSizes).reduce(
    (sum: number, s: { sizeBytes?: number }) => sum + (s.sizeBytes || 0),
    0,
  );

  return (
    <div className={styles.services}>
      <PageHeaderComponent
        sticky={false}
        title="Projects"
        subtitle={
          loading
            ? "Checking project health…"
            : `${healthyCount} of ${allDeployed.length} services healthy · ${allItems.length} total projects`
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
            <div
              className={styles.statCardIcon}
              style={{ color: "#6366f1", background: "rgba(99,102,241,0.08)" }}
            >
              <FolderKanban size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>{allItems.length}</span>
              <span className={styles.statCardLabel}>Projects</span>
              <span className={styles.statCardSub}>
                {allDeployed.length} deployed · {allNonDeployed.length}{" "}
                libraries & tools
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div
              className={styles.statCardIcon}
              style={{ color: "#10b981", background: "rgba(16,185,129,0.08)" }}
            >
              <HeartPulse size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>{healthyCount}</span>
              <span className={styles.statCardLabel}>Healthy</span>
              <span className={styles.statCardSub}>
                {unhealthyCount > 0
                  ? `${unhealthyCount} unhealthy`
                  : "All systems nominal"}
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div
              className={styles.statCardIcon}
              style={{ color: "#3b82f6", background: "rgba(59,130,246,0.08)" }}
            >
              <Server size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>
                {uniqueDevices.length}
              </span>
              <span className={styles.statCardLabel}>Devices</span>
              <span className={styles.statCardSub}>
                {uniqueDevices.join(" · ") || "No devices"}
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div
              className={styles.statCardIcon}
              style={{ color: "#a855f7", background: "rgba(168,85,247,0.08)" }}
            >
              <Layers size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>{uniqueTypes.length}</span>
              <span className={styles.statCardLabel}>Types</span>
              <span className={styles.statCardSub}>
                {uniqueTypes.join(" · ") || "No types"}
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div
              className={styles.statCardIcon}
              style={{ color: "#06b6d4", background: "rgba(6,182,212,0.08)" }}
            >
              <HardDrive size={18} strokeWidth={2} />
            </div>
            <div className={styles.statCardContent}>
              <span className={styles.statCardValue}>
                {totalSizeBytes ? formatBytes(totalSizeBytes) : "—"}
              </span>
              <span className={styles.statCardLabel}>Total Code</span>
              <span className={styles.statCardSub}>
                {Object.keys(projectSizes).length} repos measured
              </span>
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
            <MultiSelectComponent
              key={dimension}
              label={config.label}
              value={filters[dimension] as string[]}
              options={config.values}
              onChange={(values: string[]) => setFilter(dimension, values)}
              allLabel="All"
            />
          ))}

          {hasActiveFilter && (
            <button
              className={styles.clearBtn}
              onClick={() =>
                setFilters({
                  status: [],
                  visibility: [],
                  environment: [],
                  projectType: [],
                  device: [],
                })
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
        <LoadingIndicatorComponent
          size="small"
          label="Polling projects…"
          className="loading-center"
        />
      ) : (
        <>
          {hasActiveFilter && (
            <div className={styles.filterSummary}>
              Showing {filtered.length} of {allItems.length} projects
            </div>
          )}

          {/* ═══ Deployed Services Section ═══════════════════════════ */}
          {deployedItems.length > 0 && (
            <>
              {viewMode === "card" ? (
                <>
                  {nonDeployedItems.length > 0 && (
                    <div className={styles.sectionLabel}>
                      <Server size={13} strokeWidth={2.2} />
                      <span>Deployed Services</span>
                      <span className={styles.sectionCount}>
                        {deployedItems.length}
                      </span>
                    </div>
                  )}
                  <div className={styles.grid}>
                    {deployedItems.map((service: PortalService) => (
                      <ServiceCardComponent
                        key={service.id}
                        service={service}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <ProjectTableComponent
                  services={deployedItems}
                  allServices={allItems}
                  projectSizes={projectSizes}
                  projectLanguages={projectLanguages}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  title={
                    nonDeployedItems.length > 0
                      ? "Deployed Services"
                      : undefined
                  }
                  subtitle={
                    nonDeployedItems.length > 0
                      ? `${deployedItems.length} projects`
                      : undefined
                  }
                  onSort={(key: string, dir: "asc" | "desc") => {
                    setSortKey(key);
                    setSortDir(dir);
                  }}
                />
              )}
            </>
          )}

          {/* ═══ Libraries & Toolkits Section ════════════════════════ */}
          {nonDeployedItems.length > 0 && (
            <>
              {viewMode === "card" ? (
                <>
                  <div className={styles.sectionLabel}>
                    <BookOpen size={13} strokeWidth={2.2} />
                    <span>Libraries & Toolkits</span>
                    <span className={styles.sectionCount}>
                      {nonDeployedItems.length}
                    </span>
                  </div>
                  <div className={styles.grid}>
                    {nonDeployedItems.map((service: PortalService) => (
                      <ServiceCardComponent
                        key={service.id}
                        service={service}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <ProjectTableComponent
                  services={nonDeployedItems}
                  allServices={allItems}
                  projectSizes={projectSizes}
                  projectLanguages={projectLanguages}
                  excludeColumns={["tier", "domain", "database", "containers"]}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  title="Libraries & Toolkits"
                  subtitle={`${nonDeployedItems.length} projects`}
                  onSort={(key: string, dir: "asc" | "desc") => {
                    setSortKey(key);
                    setSortDir(dir);
                  }}
                />
              )}
            </>
          )}

          {/* ═══ Empty state ════════════════════════════════════════ */}
          {filtered.length === 0 && (
            <div className={styles.emptyState}>
              No projects match the selected filters
            </div>
          )}
        </>
      )}
    </div>
  );
}
