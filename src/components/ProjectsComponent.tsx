"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  BookOpen,
  FolderKanban,
  HardDrive,
  HeartPulse,
  LayoutGrid,
  Layers,
  RefreshCw,
  Server,
  Table2,
} from "lucide-react";
import {
  ButtonComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
  SearchInputComponent,
  SegmentedControlComponent,
  SelectComponent,
  StatsCardComponent,
} from "@rodrigo-barraza/components-library";
import { formatBytes, getErrorMessage } from "@rodrigo-barraza/utilities-library";
import ServiceCardComponent from "./ServiceCardComponent";
import ProjectTableComponent from "./ProjectTableComponent";
import ApiService from "../services/ApiService";
import { getSettings, usePortalSettings } from "@/lib/settings";
import type { PortalService } from "../types/portal";
import { useActionRunner, type ContainerAction } from "./monitoring/useActionRunner";
import { useRollbackAvailability } from "./monitoring/useRollbackAvailability";
import { useVisiblePolling } from "./monitoring/useVisiblePolling";
import {
  EMPTY_FILTERS,
  buildFilterOptions,
  filterProjects,
  hasActiveFilters,
  isDeployedProject,
  projectsFromResponse,
  sortProjects,
  summarizeProjects,
  type FilterDimension,
  type ProjectFilters,
  type ProjectLanguages,
  type ProjectSize,
  type SortDirection,
} from "./projects/projectModel";
import styles from "./ProjectsComponent.module.css";

/** portal-service re-checks health 3 s after an action; look just after. */
const POST_ACTION_RECHECK_MILLISECONDS = 4_000;

const LIBRARY_EXCLUDED_COLUMNS = ["tier", "domain", "database", "containers"] as const;

const VIEW_SEGMENTS = [
  { value: "card", icon: <LayoutGrid size={12} strokeWidth={2.2} /> },
  { value: "table", icon: <Table2 size={12} strokeWidth={2.2} /> },
];

interface Registry {
  services: PortalService[];
  infrastructure: PortalService[];
}

function toRegistry(response: unknown): Registry {
  const body = (response ?? {}) as Partial<Registry>;
  return {
    services: Array.isArray(body.services) ? body.services : [],
    infrastructure: Array.isArray(body.infrastructure) ? body.infrastructure : [],
  };
}

export default function ProjectsComponent() {
  const { showInfrastructure, showSystemSummary, autoRefreshEnabled, healthCheckInterval } =
    usePortalSettings();

  const [registry, setRegistry] = useState<Registry | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [projectSizes, setProjectSizes] = useState<Record<string, ProjectSize>>({});
  const [projectLanguages, setProjectLanguages] = useState<Record<string, ProjectLanguages>>({});
  const [filters, setFilters] = useState<ProjectFilters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  // Initial view comes from Settings → Dashboard.
  const [viewMode, setViewMode] = useState<string>(() => getSettings().defaultView);
  const recheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Health: probe on the user's interval (Settings → Monitoring) ──
  // `refresh=true` runs a real health round server-side, so it only runs
  // while the tab is visible and never overlaps a round still running.
  const refreshHealth = useVisiblePolling(
    async (isCurrent) => {
      try {
        const response = await ApiService.getServices(true);
        if (!isCurrent()) return;
        setRegistry(toRegistry(response));
        setLoadError(null);
      } catch (error) {
        if (isCurrent()) setLoadError(getErrorMessage(error));
      }
    },
    Math.max(5, healthCheckInterval) * 1000,
    { enabled: autoRefreshEnabled },
  );

  // First paint from the cached registry (instant) while the first real
  // health round runs; with auto-refresh off, run that round once here.
  useEffect(() => {
    let cancelled = false;
    ApiService.getServices(false)
      .then((response) => {
        if (!cancelled) setRegistry((current) => current ?? toRegistry(response));
      })
      // The health round that always follows reports failures.
      .catch(() => undefined);
    if (!getSettings().autoRefreshEnabled) void refreshHealth();
    return () => {
      cancelled = true;
    };
  }, [refreshHealth]);

  // Repo sizes and languages are supplementary — the page works without.
  useEffect(() => {
    let cancelled = false;
    ApiService.getProjectSizes()
      .then((response) => {
        if (!cancelled) setProjectSizes(response?.sizes ?? {});
      })
      .catch(() => undefined);
    ApiService.getProjectLanguages()
      .then((response) => {
        if (!cancelled) setProjectLanguages(response?.languages ?? {});
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      if (recheckTimerRef.current) clearTimeout(recheckTimerRef.current);
    },
    [],
  );

  const handleCheckAll = async () => {
    setRefreshing(true);
    try {
      await refreshHealth();
    } finally {
      setRefreshing(false);
    }
  };

  // ── Derived lists ───────────────────────────────────────────────
  const allItems = useMemo(
    () =>
      registry
        ? projectsFromResponse(registry.services, registry.infrastructure, showInfrastructure)
        : [],
    [registry, showInfrastructure],
  );
  const filterOptions = useMemo(() => buildFilterOptions(allItems), [allItems]);
  const filtered = useMemo(
    () =>
      sortProjects(filterProjects(allItems, filters, searchQuery), sortKey, sortDir, {
        sizes: projectSizes,
        languages: projectLanguages,
      }),
    [allItems, filters, searchQuery, sortKey, sortDir, projectSizes, projectLanguages],
  );
  const deployedItems = useMemo(() => filtered.filter(isDeployedProject), [filtered]);
  const nonDeployedItems = useMemo(
    () => filtered.filter((service) => !isDeployedProject(service)),
    [filtered],
  );
  const summary = useMemo(() => summarizeProjects(allItems), [allItems]);
  const filterActive = hasActiveFilters(filters, searchQuery);
  const totalSizeBytes = Object.values(projectSizes).reduce(
    (sum, size) => sum + (size.sizeBytes || 0),
    0,
  );

  // ── Card actions ────────────────────────────────────────────────
  const restartableIds = useMemo(
    () => allItems.filter((service) => service.restartable).map((service) => service.id),
    [allItems],
  );
  const { statuses: rollbackStatuses, recheck: recheckRollback } =
    useRollbackAvailability(restartableIds);

  const { pending, requestAction, actionUi } = useActionRunner({
    onSettled: (_request, succeeded) => {
      if (!succeeded) return;
      if (recheckTimerRef.current) clearTimeout(recheckTimerRef.current);
      recheckTimerRef.current = setTimeout(() => {
        recheckTimerRef.current = null;
        void refreshHealth();
      }, POST_ACTION_RECHECK_MILLISECONDS);
    },
  });

  const handleAction = useCallback(
    (service: PortalService, action: ContainerAction) => {
      const run = async () => {
        switch (action) {
          case "start":
            return ApiService.startService(service.id);
          case "stop":
            return ApiService.stopService(service.id);
          case "restart":
            return ApiService.restartService(service.id);
          case "rollback":
            try {
              return await ApiService.rollbackService(service.id);
            } finally {
              void recheckRollback(service.id);
            }
        }
      };
      requestAction({ key: service.id, name: service.name, action, run });
    },
    [requestAction, recheckRollback],
  );

  const handleSort = useCallback((key: string, direction: SortDirection) => {
    setSortKey(key);
    setSortDir(direction);
  }, []);

  const setFilter = (dimension: FilterDimension, values: string[]) =>
    setFilters((previous) => ({ ...previous, [dimension]: values }));

  const loading = registry === null && loadError === null;

  const renderCards = (items: PortalService[]) => (
    <div className={styles['grid']}>
      {items.map((service) => (
        <ServiceCardComponent
          key={service.id}
          service={service}
          pending={pending[service.id]}
          rollbackAvailable={rollbackStatuses[service.id]?.available ?? false}
          onAction={handleAction}
        />
      ))}
    </div>
  );

  return (
    <div className={`projects-component ${styles['services']}`}>
      {/* ── Filter + Sort Bar ── */}
      {!loading && (
        <div className={styles['sort-bar']}>
          <SearchInputComponent
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search projects…"
            compact
            id="projects-search-input"
          />

          <div className={styles['bar-divider']} />

          <div className={styles['sort-bar-icon']}>
            <ArrowUpDown size={13} strokeWidth={2.2} />
            <span>Filter</span>
          </div>

          {(Object.keys(filterOptions) as FilterDimension[]).map((dimension) => (
            <SelectComponent
              multiple
              key={dimension}
              label={filterOptions[dimension].label}
              value={filters[dimension]}
              options={filterOptions[dimension].values}
              onChange={(values: string[]) => setFilter(dimension, values)}
              allLabel="All"
            />
          ))}

          {filterActive && (
            <ButtonComponent
              variant="text"
              size="small"
              onClick={() => {
                setSearchQuery("");
                setFilters(EMPTY_FILTERS);
              }}
            >
              Clear
            </ButtonComponent>
          )}

          <div className={styles['bar-divider']} />

          <div className={styles['sort-bar-icon']}>
            <span>View</span>
          </div>

          <div className={styles['sort-group']}>
            <SegmentedControlComponent
              value={viewMode}
              onChange={setViewMode}
              segments={VIEW_SEGMENTS}
              compact
            />
          </div>

          <div className={styles['bar-divider']} />

          <ButtonComponent
            variant="secondary"
            icon={RefreshCw}
            loading={refreshing}
            disabled={refreshing}
            onClick={handleCheckAll}
          >
            Check All
          </ButtonComponent>
        </div>
      )}

      <PageHeaderComponent
        sticky={false}
        title="Projects"
        subtitle={
          loading
            ? "Checking project health…"
            : `${summary.healthy} of ${summary.deployed} services healthy · ${summary.total} total projects`
        }
      />

      {loadError && registry && (
        <div className={styles['error-banner']} role="status">
          Showing the last health check — refresh failed: {loadError}
        </div>
      )}

      {/* ── Project Summary Cards (Settings → Dashboard) ─────────── */}
      {!loading && registry && showSystemSummary && (
        <div className={styles['summary-grid']}>
          <StatsCardComponent
            label="Projects"
            value={summary.total}
            subtitle={`${summary.deployed} deployed · ${summary.nonDeployed} libraries & tools`}
            icon={FolderKanban}
            variant="accent"
          />
          <StatsCardComponent
            label="Healthy"
            value={summary.healthy}
            subtitle={
              summary.down > 0
                ? `${summary.down} unhealthy`
                : summary.unknown > 0
                  ? `${summary.unknown} not checked yet`
                  : "All systems nominal"
            }
            icon={HeartPulse}
            variant={summary.down > 0 ? "warning" : "success"}
          />
          <StatsCardComponent
            label="Devices"
            value={summary.devices.length}
            subtitle={summary.devices.join(" · ") || "No devices"}
            icon={Server}
            variant="info"
          />
          <StatsCardComponent
            label="Types"
            value={summary.types.length}
            subtitle={summary.types.join(" · ") || "No types"}
            icon={Layers}
            color="var(--accent-secondary)"
          />
          <StatsCardComponent
            label="Total Code"
            value={totalSizeBytes ? formatBytes(totalSizeBytes) : "—"}
            subtitle={`${Object.keys(projectSizes).length} repos measured`}
            icon={HardDrive}
            color="var(--accent-tertiary)"
          />
        </div>
      )}

      {loading ? (
        <LoadingIndicatorComponent
          size="small"
          label="Polling projects…"
          className="is-loading-centered-state"
        />
      ) : !registry ? (
        <div className={styles['empty-state']}>Couldn&apos;t load projects: {loadError}</div>
      ) : (
        <>
          {filterActive && (
            <div className={styles['filter-summary']}>
              Showing {filtered.length} of {allItems.length} projects
            </div>
          )}

          {/* ═══ Deployed Services ═══════════════════════════════════ */}
          {deployedItems.length > 0 &&
            (viewMode === "card" ? (
              <>
                {nonDeployedItems.length > 0 && (
                  <div className={styles['section-label']}>
                    <Server size={13} strokeWidth={2.2} />
                    <span>Deployed Services</span>
                    <span className={styles['section-count']}>{deployedItems.length}</span>
                  </div>
                )}
                {renderCards(deployedItems)}
              </>
            ) : (
              <ProjectTableComponent
                services={deployedItems}
                allServices={allItems}
                projectSizes={projectSizes}
                projectLanguages={projectLanguages}
                sortKey={sortKey}
                sortDir={sortDir}
                title={nonDeployedItems.length > 0 ? "Deployed Services" : undefined}
                subtitle={
                  nonDeployedItems.length > 0 ? `${deployedItems.length} projects` : undefined
                }
                onSort={handleSort}
              />
            ))}

          {/* ═══ Libraries & Toolkits ════════════════════════════════ */}
          {nonDeployedItems.length > 0 &&
            (viewMode === "card" ? (
              <>
                <div className={styles['section-label']}>
                  <BookOpen size={13} strokeWidth={2.2} />
                  <span>Libraries & Toolkits</span>
                  <span className={styles['section-count']}>{nonDeployedItems.length}</span>
                </div>
                {renderCards(nonDeployedItems)}
              </>
            ) : (
              <ProjectTableComponent
                services={nonDeployedItems}
                allServices={allItems}
                projectSizes={projectSizes}
                projectLanguages={projectLanguages}
                excludeColumns={LIBRARY_EXCLUDED_COLUMNS}
                sortKey={sortKey}
                sortDir={sortDir}
                title="Libraries & Toolkits"
                subtitle={`${nonDeployedItems.length} projects`}
                onSort={handleSort}
              />
            ))}

          {filtered.length === 0 && (
            <div className={styles['empty-state']}>No projects match the selected filters</div>
          )}
        </>
      )}

      {actionUi}
    </div>
  );
}
