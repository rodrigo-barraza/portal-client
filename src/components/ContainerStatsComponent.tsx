"use client";

import { useCallback, useMemo, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import {
  DrawerComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
  SearchInputComponent,
  SegmentedControlComponent,
  SelectComponent,
  TableComponent,
} from "@rodrigo-barraza/components-library";
import ApiService from "../services/ApiService";
import type { ContainerRow } from "../types/portal";
import { usePortalSettings } from "@/lib/settings";
import ContainerDetailPanel from "./ContainerDetailPanelComponent";
import { sumAligned } from "./monitoring/containerHistory";
import { thresholdsFromSettings } from "./monitoring/severity";
import { useActionRunner, type ContainerAction } from "./monitoring/useActionRunner";
import { useRollbackAvailability } from "./monitoring/useRollbackAvailability";
import ContainerActionButtons from "./containers/ContainerActionButtons";
import ContainerCard from "./containers/ContainerCard";
import ContainerSummaryCards from "./containers/ContainerSummaryCards";
import { buildContainerColumns, getContainerRowClassName } from "./containers/containerColumns";
import {
  CONTAINER_TYPES,
  filterContainerRows,
  hostRamByDevice,
  summarizeContainers,
} from "./containers/containerRows";
import { useContainerDashboard } from "./containers/useContainerDashboard";
import styles from "./ContainerStatsComponent.module.css";

type ViewMode = "table" | "cards";

const VIEW_MODE_STORAGE_KEY = "portal-container-view-mode";

const VIEW_SEGMENTS = [
  { value: "table", icon: <List size={12} strokeWidth={2.4} /> },
  { value: "cards", icon: <LayoutGrid size={12} strokeWidth={2.4} /> },
];

const TYPE_OPTIONS = CONTAINER_TYPES.map((type) => ({ value: type, label: `${type}s` }));

function readViewMode(): ViewMode {
  if (typeof window === "undefined") return "table";
  try {
    return window.localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "cards" ? "cards" : "table";
  } catch {
    return "table";
  }
}

function saveViewMode(mode: ViewMode) {
  try {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage unavailable — the choice just isn't remembered.
  }
}

export default function ContainerStatsComponent() {
  const {
    alertThresholdCpu,
    alertThresholdMemory,
    containerPollingInterval,
    showResponseTimes,
  } = usePortalSettings();
  const thresholds = useMemo(
    () => thresholdsFromSettings({ alertThresholdCpu, alertThresholdMemory }),
    [alertThresholdCpu, alertThresholdMemory],
  );

  const { rows, history, systemInfo, loading, error, refreshAfterAction } =
    useContainerDashboard(containerPollingInterval);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDevices, setActiveDevices] = useState<string[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode);

  // ── Actions ─────────────────────────────────────────────────────
  const registeredServiceIds = useMemo(
    () => rows.flatMap((row) => (row.serviceId ? [row.serviceId] : [])),
    [rows],
  );
  const { statuses: rollbackStatuses, recheck: recheckRollback } =
    useRollbackAvailability(registeredServiceIds);

  const { pending, requestAction, actionUi } = useActionRunner({
    onSettled: (_request, succeeded) => {
      if (succeeded) void refreshAfterAction();
    },
  });

  // Start/stop/restart address the container by name + device, so a
  // same-named container on another host is never the one acted on.
  const handleAction = useCallback(
    (row: ContainerRow, action: ContainerAction) => {
      const device = row.device || "";
      const run = async () => {
        switch (action) {
          case "start":
            return ApiService.startContainer(row.containerName, device);
          case "stop":
            return ApiService.stopContainer(row.containerName, device);
          case "restart":
            return ApiService.restartContainer(row.containerName, device);
          case "rollback": {
            const serviceId = row.serviceId;
            if (!serviceId) throw new Error("Only registered services can be rolled back");
            try {
              return await ApiService.rollbackService(serviceId);
            } finally {
              void recheckRollback(serviceId);
            }
          }
        }
      };
      requestAction({ key: row.id, name: row.containerName, action, run });
    },
    [requestAction, recheckRollback],
  );

  // Rollback re-tags the service's image on its registry device — only
  // offer it on the row that actually runs there.
  const isRollbackAvailable = useCallback(
    (row: ContainerRow) => {
      const status = row.serviceId ? rollbackStatuses[row.serviceId] : undefined;
      return Boolean(status?.available && (!status.device || status.device === row.device));
    },
    [rollbackStatuses],
  );

  const renderActions = useCallback(
    (row: ContainerRow) => (
      <ContainerActionButtons
        row={row}
        pending={pending[row.id]}
        rollbackAvailable={isRollbackAvailable(row)}
        onAction={handleAction}
      />
    ),
    [pending, isRollbackAvailable, handleAction],
  );

  // ── Derived data ────────────────────────────────────────────────
  const deviceIds = useMemo(
    () => [...new Set(rows.flatMap((row) => (row.device ? [row.device] : [])))].sort(),
    [rows],
  );
  const filteredRows = useMemo(
    () =>
      filterContainerRows(rows, {
        devices: activeDevices,
        types: activeTypes,
        query: searchQuery,
      }),
    [rows, activeDevices, activeTypes, searchQuery],
  );
  const summary = useMemo(
    () => summarizeContainers(filteredRows, systemInfo, activeDevices),
    [filteredRows, systemInfo, activeDevices],
  );
  const hostRam = useMemo(() => hostRamByDevice(systemInfo), [systemInfo]);
  // Summary sparklines are the sum of the shown containers' own series,
  // so they follow the filters exactly like the figures above them.
  const cpuSeries = useMemo(
    () => sumAligned(filteredRows.map((row) => history[row.id]?.cpu ?? [])),
    [filteredRows, history],
  );
  const memorySeries = useMemo(
    () => sumAligned(filteredRows.map((row) => history[row.id]?.mem ?? [])),
    [filteredRows, history],
  );

  const columns = useMemo(
    () =>
      buildContainerColumns({
        history,
        hostRam,
        thresholds,
        showResponseTimes,
        renderActions,
      }),
    [history, hostRam, thresholds, showResponseTimes, renderActions],
  );

  const selectedContainer = selectedId
    ? (rows.find((row) => row.id === selectedId) ?? null)
    : null;
  const selectRow = useCallback((row: ContainerRow) => setSelectedId(row.id), []);

  if (loading) {
    return (
      <div className={styles['section']}>
        <LoadingIndicatorComponent
          size="small"
          label="Querying containers…"
          className="is-loading-centered-state"
        />
      </div>
    );
  }

  return (
    <div className={`container-stats-component ${styles['section']}`}>
      <PageHeaderComponent
        sticky={false}
        title="Containers"
        subtitle={`${summary.healthy} of ${summary.total} containers healthy · polling every ${containerPollingInterval}s`}
      />

      {/* ── Filters & View Toggle ────────────────────────────────── */}
      <div className={styles['filters-bar']}>
        <div className={styles['filters-container']}>
          <div className={styles['search-wrapper']}>
            <SearchInputComponent
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search containers..."
              compact
            />
          </div>

          {deviceIds.length > 1 && (
            <SelectComponent
              multiple
              label="Host"
              value={activeDevices}
              options={deviceIds.map((deviceId) => ({ value: deviceId, label: deviceId }))}
              onChange={setActiveDevices}
              allLabel="All Hosts"
            />
          )}

          <SelectComponent
            multiple
            label="Type"
            value={activeTypes}
            options={TYPE_OPTIONS}
            onChange={setActiveTypes}
            allLabel="All Types"
          />
        </div>

        <SegmentedControlComponent
          value={viewMode}
          onChange={(value: string) => {
            const mode: ViewMode = value === "cards" ? "cards" : "table";
            setViewMode(mode);
            saveViewMode(mode);
          }}
          segments={VIEW_SEGMENTS}
          compact
        />
      </div>

      {error && rows.length > 0 && (
        <div className={styles['error-banner']} role="status">
          Showing the last successful poll — refresh failed: {error}
        </div>
      )}

      <ContainerSummaryCards
        summary={summary}
        activeDevices={activeDevices}
        cpuSeries={cpuSeries}
        memorySeries={memorySeries}
        thresholds={thresholds}
        showResponseTimes={showResponseTimes}
      />

      {filteredRows.length === 0 ? (
        <div className={styles['empty-state']}>
          {error && rows.length === 0
            ? `Couldn't load containers: ${error}`
            : `No containers found${activeDevices.length > 0 ? ` on ${activeDevices.join(", ")}` : ""}`}
        </div>
      ) : viewMode === "table" ? (
        <TableComponent
          title="Containers"
          subtitle={`${summary.total} containers · ${summary.healthy} healthy`}
          columns={columns}
          data={filteredRows}
          getRowKey={(row: ContainerRow) => row.id}
          emptyText="No containers found"
          getRowClassName={getContainerRowClassName}
          onRowClick={selectRow}
          activeRowKey={selectedId}
          storageKey="container-table"
        />
      ) : (
        <div className={styles['cards-grid']}>
          {filteredRows.map((row) => (
            <ContainerCard
              key={row.id}
              row={row}
              hostRam={hostRam[row.device || ""] || 0}
              thresholds={thresholds}
              active={selectedId === row.id}
              pending={pending[row.id]}
              rollbackAvailable={isRollbackAvailable(row)}
              onSelect={selectRow}
              onAction={handleAction}
            />
          ))}
        </div>
      )}

      <DrawerComponent
        open={selectedContainer !== null}
        onClose={() => setSelectedId(null)}
        title={selectedContainer?.containerName || "Container Detail"}
        width={540}
        headerActions={selectedContainer ? renderActions(selectedContainer) : null}
      >
        {selectedContainer && (
          <ContainerDetailPanel
            key={selectedContainer.id}
            container={selectedContainer}
            stats={selectedContainer._stats}
            history={history[selectedContainer.id]}
            thresholds={thresholds}
          />
        )}
      </DrawerComponent>

      {actionUi}
    </div>
  );
}
