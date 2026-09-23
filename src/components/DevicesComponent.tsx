"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { CircuitBoard, Container, Cpu, HardDrive, MemoryStick, Monitor, RefreshCw, TriangleAlert } from "lucide-react";
import {
  BadgeComponent,
  ButtonComponent,
  CollapsibleBlockComponent,
  EmptyStateComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
  StatusDotComponent,
} from "@rodrigo-barraza/components-library";
import { formatBytes, formatPercent, getErrorMessage } from "@rodrigo-barraza/utilities-library";

import ApiService from "../services/ApiService";
import { usePortalSettings } from "@/lib/settings";
import type { Device } from "../types/portal";
import { severityColor, thresholdsFromSettings, type SeverityThresholds } from "./monitoring/severity";
import { useVisiblePolling } from "./monitoring/useVisiblePolling";
import {
  deviceStatus,
  groupContainersByDevice,
  isRunning,
  sortDevicesByContainerCount,
  type DeviceContainer,
} from "./devices/deviceModel";
import styles from "./DevicesComponent.module.css";

const DEVICE_ICONS: Record<string, typeof Monitor> = {
  Desktop: Monitor,
  SBC: CircuitBoard,
  NAS: HardDrive,
};

/** Accent per device type — the card glow and icon tint. */
const DEVICE_COLORS: Record<string, string> = {
  Desktop: "var(--accent-primary)",
  SBC: "var(--color-success)",
  NAS: "var(--color-info)",
};

const NO_CONTAINERS: DeviceContainer[] = [];

export default function DevicesComponent() {
  const settings = usePortalSettings();
  const thresholds = useMemo(
    () => thresholdsFromSettings(settings),
    [settings],
  );

  const [devicesResult, setDevicesResult] = useState<{ devices: Device[]; error: string | null } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [containers, setContainers] = useState<DeviceContainer[]>(NO_CONTAINERS);

  useEffect(() => {
    let active = true;
    (ApiService.getDevices() as Promise<{ devices?: Device[] }>)
      .then((response) => active && setDevicesResult({ devices: response.devices || [], error: null }))
      .catch(
        (error: unknown) =>
          // A failed refresh keeps the devices already on screen
          active &&
          setDevicesResult((previous) => ({ devices: previous?.devices ?? [], error: getErrorMessage(error) })),
      )
      .finally(() => active && setRefreshing(false));
    return () => {
      active = false;
    };
  }, [reloadToken]);

  // Container stats are supplementary: polled on the Settings → Monitoring
  // interval, only while the tab is visible, never overlapping.
  const pollContainers = useCallback(async (isCurrent: () => boolean) => {
    try {
      const response = (await ApiService.getContainerStats()) as { containers?: DeviceContainer[] };
      if (isCurrent()) setContainers(response?.containers || NO_CONTAINERS);
    } catch {
      // Keep the last snapshot; the next poll retries
    }
  }, []);
  const refreshContainers = useVisiblePolling(
    pollContainers,
    Math.max(1, settings.containerPollingInterval) * 1000,
  );

  const handleRefresh = () => {
    setRefreshing(true);
    setReloadToken((token) => token + 1);
    void refreshContainers();
  };

  const containersByDevice = useMemo(() => groupContainersByDevice(containers), [containers]);
  const devices = devicesResult?.devices;
  const sortedDevices = useMemo(
    () => sortDevicesByContainerCount(devices ?? [], containersByDevice),
    [devices, containersByDevice],
  );

  const loading = devicesResult === null;
  const runningContainers = containers.filter(isRunning).length;

  return (
    <div className={`devices-component ${styles["devices"]}`}>
      <PageHeaderComponent
        sticky={false}
        title="Devices"
        subtitle={
          loading
            ? "Loading device topology…"
            : `${sortedDevices.length} devices · ${runningContainers}/${containers.length} containers running`
        }
      >
        <ButtonComponent variant="secondary" icon={RefreshCw} loading={refreshing} onClick={handleRefresh}>
          Refresh
        </ButtonComponent>
      </PageHeaderComponent>

      {loading ? (
        <LoadingIndicatorComponent size="small" label="Discovering devices…" className="is-loading-centered-state" />
      ) : devicesResult.error && sortedDevices.length === 0 ? (
        <EmptyStateComponent
          icon={<TriangleAlert size={40} strokeWidth={1.5} />}
          title="Couldn't load devices"
          subtitle={devicesResult.error}
        >
          <ButtonComponent variant="secondary" icon={RefreshCw} loading={refreshing} onClick={handleRefresh}>
            Retry
          </ButtonComponent>
        </EmptyStateComponent>
      ) : (
        <>
          {devicesResult.error && (
            <p className={styles["refresh-error"]} role="alert">
              <TriangleAlert size={14} /> Refresh failed — showing the previous devices. {devicesResult.error}
            </p>
          )}
          <div className={styles["device-list"]}>
            {sortedDevices.map((device, index) => (
              <DeviceCard
                key={device.id}
                device={device}
                delay={Math.min(index, 10) * 60}
                containers={containersByDevice[device.id] ?? NO_CONTAINERS}
                thresholds={thresholds}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Device Card ───────────────────────────────────────────────────

function DeviceCard({
  device,
  delay,
  containers,
  thresholds,
}: {
  device: Device;
  delay: number;
  containers: DeviceContainer[];
  thresholds: SeverityThresholds;
}) {
  const DeviceIcon = DEVICE_ICONS[device.type ?? ""] ?? Monitor;
  const accentColor = DEVICE_COLORS[device.type ?? ""] ?? "var(--accent-primary)";
  const status = deviceStatus(containers);

  return (
    <div
      className={styles["device-card"]}
      style={{ "--device-accent": accentColor, animationDelay: `${delay}ms` } as CSSProperties}
    >
      <div className={styles["device-header"]}>
        <div className={styles["device-info"]}>
          <div className={styles["device-icon-wrap"]}>
            <DeviceIcon size={20} strokeWidth={1.6} />
          </div>
          <div>
            <h3 className={styles["device-name"]}>{device.name}</h3>
            <div className={styles["device-meta"]}>
              {device.type && <span className={styles["device-type"]}>{device.type}</span>}
              {device.type && device.os && <span className={styles["separator"]}>·</span>}
              {device.os && <span className={styles["device-os"]}>{device.os}</span>}
            </div>
          </div>
        </div>
        <div
          className={styles["device-status"]}
          title={status.total === 0 ? "No containers reported" : `${status.running} of ${status.total} containers running`}
        >
          <StatusDotComponent variant={status.variant} size="md" pulse={status.variant === "healthy"} />
          <span className={styles["status-label"]}>
            {status.running}/{status.total}
          </span>
        </div>
      </div>

      {device.hostname && (
        <div className={styles["hostname-row"]}>
          <span className={styles["hostname-label"]}>Hostname</span>
          <code className={styles["hostname"]}>{device.hostname}</code>
        </div>
      )}

      {/* Live specs, reported by the device's Docker Engine */}
      {device.specs && (
        <div className={styles["specs-row"]}>
          <span className={styles["spec-item"]} title="CPU cores">
            <Cpu size={13} strokeWidth={1.8} />
            {device.specs.cpus} cores
          </span>
          <span className={styles["spec-item"]} title="Total memory">
            <MemoryStick size={13} strokeWidth={1.8} />
            {formatBytes(device.specs.memoryBytes)}
          </span>
          <span className={styles["spec-item"]} title="Docker Engine version">
            <Container size={13} strokeWidth={1.8} />
            Docker {device.specs.dockerVersion}
          </span>
        </div>
      )}

      {device.notes && <p className={styles["device-notes"]}>{device.notes}</p>}

      {containers.length > 0 && (
        <div className={styles["services-section"]}>
          <CollapsibleBlockComponent label="Containers" badge={containers.length} defaultCollapsed>
            <div className={styles["services-table"]}>
              {containers.map((container) => (
                <ContainerRow key={container.name} container={container} thresholds={thresholds} />
              ))}
            </div>
          </CollapsibleBlockComponent>
        </div>
      )}
    </div>
  );
}

// ── Container Row ─────────────────────────────────────────────────

function ContainerRow({
  container,
  thresholds,
}: {
  container: DeviceContainer;
  thresholds: SeverityThresholds;
}) {
  const running = isRunning(container);
  // Stopped containers report zeroed stats — showing "0% · 0 B" would read
  // as an idle running container, so metrics appear only while running.
  const { cpu, memory } = container;

  return (
    <div className={styles["service-row"]}>
      <div className={styles["service-left"]}>
        <StatusDotComponent variant={running ? "healthy" : "unhealthy"} size="sm" pulse={running} />
        <Container size={13} strokeWidth={1.8} className={styles["container-icon"]} />
        <span className={styles["service-name"]}>{container.name}</span>
        <BadgeComponent variant={running ? "success" : "error"}>{container.state || "unknown"}</BadgeComponent>
      </div>
      <div className={styles["service-right"]}>
        {running && cpu && (
          <div className={styles["metric-badges"]}>
            <span
              className={styles["metric-badge"]}
              style={{ "--metric-color": severityColor(cpu.percent, thresholds.cpu) } as CSSProperties}
              title={`CPU: ${formatPercent(cpu.percent, "adaptive")} · ${cpu.cores} core${cpu.cores !== 1 ? "s" : ""}`}
            >
              <Cpu size={10} strokeWidth={2.4} />
              <span className={styles["metric-value"]}>{formatPercent(cpu.percent, "adaptive")}</span>
            </span>
            {memory && (
              <span
                className={styles["metric-badge"]}
                style={{ "--metric-color": severityColor(memory.percent, thresholds.memory) } as CSSProperties}
                title={`RAM: ${formatBytes(memory.used)} / ${formatBytes(memory.limit)} (${formatPercent(memory.percent, "adaptive")})`}
              >
                <MemoryStick size={10} strokeWidth={2.4} />
                <span className={styles["metric-value"]}>{formatBytes(memory.used)}</span>
              </span>
            )}
          </div>
        )}
        {container.status && <span className={styles["container-status"]}>{container.status}</span>}
      </div>
    </div>
  );
}
