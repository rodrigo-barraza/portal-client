"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type CSSProperties,
} from "react";
import {
  RefreshCw,
  Monitor,
  HardDrive,
  CircuitBoard,
  Cpu,
  MemoryStick,
  Container,
  ChevronDown,
} from "lucide-react";
import {
  BadgeComponent,
  ButtonComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
  StatusDotComponent,
} from "@rodrigo-barraza/components-library";

import ApiService from "../services/ApiService";
import { formatBytes, formatPercent } from "@rodrigo-barraza/utilities-library";
import type { Device, ContainerStats } from "../types/portal";
import styles from "./DevicesComponent.module.css";

/**
 * Map device type strings to an icon component.
 */
const DEVICE_ICON_MAP = {
  Desktop: Monitor,
  SBC: CircuitBoard,
  NAS: HardDrive,
};

/**
 * Accent color per device type — used for the glow & icon tint.
 */
const DEVICE_COLOR_MAP = {
  Desktop: "var(--accent-primary)",
  SBC: "var(--color-success)",
  NAS: "var(--color-info)",
};

/**
 * Color by severity threshold for CPU/memory values.
 */
function severityColor(percent: number, thresholds = [40, 80]) {
  if (percent > thresholds[1]) return "var(--color-danger)";
  if (percent > thresholds[0]) return "var(--color-warning)";
  return "var(--color-success)";
}

export default function DevicesComponent() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [containers, setContainers] = useState<
    Array<Partial<ContainerStats> & { name: string; device?: string }>
  >([]);
  const didFetch = useRef(false);

  async function loadDevices() {
    try {
      const devicesResponse = await ApiService.getDevices();
      setDevices(devicesResponse.devices || []);
    } catch (error) {
      console.error("Devices fetch failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const fetchContainers = useCallback(async () => {
    try {
      const containerStatsResponse = await ApiService.getContainerStats();
      setContainers(containerStatsResponse?.containers || []);
    } catch {
      // Container stats are supplementary — silently ignore
    }
  }, []);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadDevices();
    fetchContainers();
  }, [fetchContainers]);

  // Poll container stats every 5 seconds
  useEffect(() => {
    const timer = setInterval(fetchContainers, 5_000);
    return () => clearInterval(timer);
  }, [fetchContainers]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDevices();
    fetchContainers();
  };

  // Group containers by device name
  const containersByDevice = useMemo(() => {
    const map: Record<
      string,
      Array<Partial<ContainerStats> & { name: string; device?: string }>
    > = {};
    for (const container of containers) {
      const deviceId = container.device || "unknown";
      if (!map[deviceId]) map[deviceId] = [];
      map[deviceId].push(container);
    }
    // Sort containers within each device by name
    for (const key of Object.keys(map)) {
      map[key].sort((firstContainer, secondContainer) => firstContainer.name.localeCompare(secondContainer.name));
    }
    return map;
  }, [containers]);

  const sortedDevices = [...devices].sort((firstDevice: Device, secondDevice: Device) => {
    const firstDeviceCount = containersByDevice[firstDevice.id]?.length || 0;
    const secondDeviceCount = containersByDevice[secondDevice.id]?.length || 0;
    return secondDeviceCount - firstDeviceCount;
  });

  const totalContainers = containers.length;
  const runningContainers = containers.filter(
    (container) => container.state === "running",
  ).length;

  return (
    <div className={styles['devices']}>
      <PageHeaderComponent
        sticky={false}
        title="Devices"
        subtitle={
          loading
            ? "Loading device topology…"
            : `${devices.length} devices · ${runningContainers}/${totalContainers} containers running`
        }
      >
        <ButtonComponent
          variant="secondary"
          icon={RefreshCw}
          loading={refreshing}
          onClick={handleRefresh}
        >
          Refresh
        </ButtonComponent>
      </PageHeaderComponent>

      {loading ? (
        <LoadingIndicatorComponent
          size="small"
          label="Discovering devices…"
          className="is-loading-centered-state"
        />
      ) : (
        <div className={styles['device-list']}>
          {sortedDevices.map((device, index) => (
            <DeviceCard
              key={device.id}
              device={device}
              delay={index * 60}
              containers={containersByDevice[device.id] || []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Device Card ───────────────────────────────────────────────────

function DeviceCard({
  device,
  delay,
  containers,
}: {
  device: Device;
  delay: number;
  containers: Array<
    Partial<ContainerStats> & { name: string; device?: string }
  >;
}) {
  const [containersExpanded, setContainersExpanded] = useState(false);
  const DeviceIcon =
    DEVICE_ICON_MAP[device.type as keyof typeof DEVICE_ICON_MAP] || Monitor;
  const accentColor =
    DEVICE_COLOR_MAP[device.type as keyof typeof DEVICE_COLOR_MAP] ||
    "var(--accent-primary)";
  const runningCount = containers.filter((connection) => connection.state === "running").length;
  const allRunning =
    runningCount === containers.length && containers.length > 0;

  return (
    <div
      className={styles['device-card']}
      style={
        {
          "--device-accent": accentColor,
          animationDelay: `${delay}ms`,
        } as CSSProperties
      }
    >
      {/* ── Device Header ── */}
      <div className={styles['device-header']}>
        <div className={styles['device-info']}>
          <div className={styles['device-icon-wrap']}>
            <DeviceIcon size={20} strokeWidth={1.6} />
          </div>
          <div>
            <h3 className={styles['device-name']}>{device.name}</h3>
            <div className={styles['device-meta']}>
              <span className={styles['device-type']}>{device.type}</span>
              <span className={styles['separator']}>·</span>
              <span className={styles['device-os']}>{device.os}</span>
            </div>
          </div>
        </div>
        <div className={styles['device-status']}>
          <StatusDotComponent
            variant={allRunning ? "healthy" : "unhealthy"}
            size="md"
            pulse={allRunning}
          />
          <span className={styles['status-label']}>
            {runningCount}/{containers.length}
          </span>
        </div>
      </div>

      {/* ── Hostname ── */}
      <div className={styles['hostname-row']}>
        <span className={styles['hostname-label']}>Hostname</span>
        <code className={styles['hostname']}>{device.hostname}</code>
      </div>

      {/* ── Notes ── */}
      {device.notes && <p className={styles['device-notes']}>{device.notes}</p>}

      {/* ── Containers Table ── */}
      {containers.length > 0 && (
        <div className={styles['services-section']}>
          <button
            className={styles['services-header']}
            onClick={() => setContainersExpanded((previousState) => !previousState)}
            aria-expanded={containersExpanded}
          >
            <span>Containers ({containers.length})</span>
            <ChevronDown
              size={14}
              strokeWidth={2}
              className={`${styles['chevron']} ${containersExpanded ? styles['chevron-expanded'] : ""}`}
            />
          </button>
          <div
            className={`${styles['services-collapsible']} ${containersExpanded ? styles['services-expanded'] : ""}`}
          >
            <div className={styles['services-table']}>
              {containers.map((container) => (
                <ContainerRow key={container.name} container={container} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Container Row ─────────────────────────────────────────────────

function ContainerRow({
  container,
}: {
  container: Partial<ContainerStats> & { name: string; device?: string };
}) {
  const isRunning = container.state === "running";

  return (
    <div
      className={`devices-component ${styles['service-row']} ${isRunning ? styles['healthy'] : styles['unhealthy']}`}
    >
      <div className={styles['service-left']}>
        <StatusDotComponent
          variant={isRunning ? "healthy" : "unhealthy"}
          size="sm"
          pulse={isRunning}
        />
        <Container
          size={13}
          strokeWidth={1.8}
          className={styles['container-icon']}
        />
        <span className={styles['service-name']}>{container.name}</span>
        <BadgeComponent variant={isRunning ? "success" : "danger"}>
          {container.state || "unknown"}
        </BadgeComponent>
      </div>
      <div className={styles['service-right']}>
        {/* ── Docker Metrics ── */}
        {container.cpu && (
          <div className={styles['metric-badges']}>
            <span
              className={styles['metric-badge']}
              style={
                {
                  "--metric-color": severityColor(container.cpu.percent),
                } as CSSProperties
              }
              title={`CPU: ${formatPercent(container.cpu.percent, "adaptive")} · ${container.cpu.cores} core${container.cpu.cores !== 1 ? "s" : ""}`}
            >
              <Cpu size={10} strokeWidth={2.4} />
              <span className={styles['metric-value']}>
                {formatPercent(container.cpu.percent, "adaptive")}
              </span>
            </span>
            {container.memory && (
              <span
                className={styles['metric-badge']}
                style={
                  {
                    "--metric-color": severityColor(
                      container.memory.percent,
                      [60, 85],
                    ),
                  } as CSSProperties
                }
                title={`RAM: ${formatBytes(container.memory.used)} / ${formatBytes(container.memory.limit)} (${formatPercent(container.memory.percent, "adaptive")})`}
              >
                <MemoryStick size={10} strokeWidth={2.4} />
                <span className={styles['metric-value']}>
                  {formatBytes(container.memory.used)}
                </span>
              </span>
            )}
          </div>
        )}

        {container.status && (
          <span className={styles['container-status']}>{container.status}</span>
        )}
      </div>
    </div>
  );
}
