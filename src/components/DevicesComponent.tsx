"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import { BadgeComponent, ButtonComponent, LoadingIndicatorComponent, PageHeaderComponent, StatusDotComponent } from "@rodrigo-barraza/components-library";

import ApiService from "../services/ApiService";
import { formatBytes, formatPercent } from "@rodrigo-barraza/utilities-library";
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
  Desktop: "var(--accent-color)",
  SBC: "var(--success)",
  NAS: "var(--info)",
};


/**
 * Color by severity threshold for CPU/memory values.
 */
// @ts-ignore
function severityColor(pct, thresholds = [40, 80]) {
  if (pct > thresholds[1]) return "var(--danger)";
  if (pct > thresholds[0]) return "var(--warning)";
  return "var(--success)";
}

export default function DevicesComponent() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [containers, setContainers] = useState<any[]>([]);
  const didFetch = useRef(false);

  async function loadDevices() {
    try {
      const res = await ApiService.getDevices();
      setDevices(res.devices || []);
    } catch (error) {
      console.error("Devices fetch failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const fetchContainers = useCallback(async () => {
    try {
      // @ts-ignore
      const res = await ApiService.getContainerStats();
      setContainers(res?.containers || []);
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
    const map = {};
    for (const c of containers) {
      const deviceId = c.device || "unknown";
      // @ts-ignore
      if (!map[deviceId]) map[deviceId] = [];
      // @ts-ignore
      map[deviceId].push(c);
    }
    // Sort containers within each device by name
    for (const key of Object.keys(map)) {
      // @ts-ignore
      map[key].sort((a: any, b: any) => a.name.localeCompare(b.name));
    }
    return map;
  }, [containers]);

  const sortedDevices = [...devices].sort((a: any, b: any) => {
    // @ts-ignore
    const aCount = containersByDevice[a.id]?.length || 0;
    // @ts-ignore
    const bCount = containersByDevice[b.id]?.length || 0;
    return bCount - aCount;
  });

  const totalContainers = containers.length;
  const runningContainers = containers.filter((c) => c.state === "running").length;

  return (
    <div className={styles.devices}>
      <PageHeaderComponent sticky={false}
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
        <LoadingIndicatorComponent size="small" label="Discovering devices…" className="loading-center" />
      ) : (
        <div className={styles.deviceList}>
          {sortedDevices.map((device, index) => (
            <DeviceCard
              key={device.id}
              device={device}
              delay={index * 60}
              // @ts-ignore
              containers={containersByDevice[device.id] || []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Device Card ───────────────────────────────────────────────────

function DeviceCard({ device, delay, containers }: { [key: string]: any }) {
  const [containersExpanded, setContainersExpanded] = useState(false);
  // @ts-ignore
  const DeviceIcon = DEVICE_ICON_MAP[device.type] || Monitor;
  // @ts-ignore
  const accentColor = DEVICE_COLOR_MAP[device.type] || "var(--accent-color)";
  // @ts-ignore
  const runningCount = containers.filter((c) => c.state === "running").length;
  const allRunning = runningCount === containers.length && containers.length > 0;

  return (
    <div
      className={styles.deviceCard}
      style={{
        // @ts-ignore
        "--device-accent": accentColor,
        animationDelay: `${delay}ms`,
      }}
    >
      {/* ── Device Header ── */}
      <div className={styles.deviceHeader}>
        <div className={styles.deviceInfo}>
          <div className={styles.deviceIconWrap}>
            <DeviceIcon size={20} strokeWidth={1.6} />
          </div>
          <div>
            <h3 className={styles.deviceName}>{device.name}</h3>
            <div className={styles.deviceMeta}>
              <span className={styles.deviceType}>{device.type}</span>
              <span className={styles.separator}>·</span>
              <span className={styles.deviceOs}>{device.os}</span>
            </div>
          </div>
        </div>
        <div className={styles.deviceStatus}>
          <StatusDotComponent
            variant={allRunning ? "healthy" : "unhealthy"}
            size="md"
            pulse={allRunning}
          />
          <span className={styles.statusLabel}>
            {runningCount}/{containers.length}
          </span>
        </div>
      </div>

      {/* ── Hostname ── */}
      <div className={styles.hostnameRow}>
        <span className={styles.hostnameLabel}>Hostname</span>
        <code className={styles.hostname}>{device.hostname}</code>
      </div>


      {/* ── Notes ── */}
      {device.notes && (
        <p className={styles.deviceNotes}>{device.notes}</p>
      )}

      {/* ── Containers Table ── */}
      {containers.length > 0 && (
        <div className={styles.servicesSection}>
          <button
            className={styles.servicesHeader}
            onClick={() => setContainersExpanded((prev) => !prev)}
            aria-expanded={containersExpanded}
          >
            <span>Containers ({containers.length})</span>
            <ChevronDown
              size={14}
              strokeWidth={2}
              className={`${styles.chevron} ${containersExpanded ? styles.chevronExpanded : ""}`}
            />
          </button>
          <div className={`${styles.servicesCollapsible} ${containersExpanded ? styles.servicesExpanded : ""}`}>
            <div className={styles.servicesTable}>
              {containers.map((container: any) => (
                <ContainerRow
                  key={container.name}
                  container={container}
                />
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Container Row ─────────────────────────────────────────────────

function ContainerRow({ container }: { [key: string]: any }) {
  const isRunning = container.state === "running";

  return (
    <div className={`${styles.serviceRow} ${isRunning ? styles.healthy : styles.unhealthy}`}>
      <div className={styles.serviceLeft}>
        <StatusDotComponent
          variant={isRunning ? "healthy" : "unhealthy"}
          size="sm"
          pulse={isRunning}
        />
        <Container size={13} strokeWidth={1.8} className={styles.containerIcon} />
        <span className={styles.svcName}>{container.name}</span>
        <BadgeComponent variant={isRunning ? "success" : "danger"}>
          {container.state || "unknown"}
        </BadgeComponent>
      </div>
      <div className={styles.serviceRight}>
        {/* ── Docker Metrics ── */}
        {container.cpu && (
          <div className={styles.metricBadges}>
            <span
              className={styles.metricBadge}
              // @ts-ignore
              style={{ "--metric-color": severityColor(container.cpu.percent) }}
              title={`CPU: ${formatPercent(container.cpu.percent, "adaptive")} · ${container.cpu.cores} core${container.cpu.cores !== 1 ? "s" : ""}`}
            >
              <Cpu size={10} strokeWidth={2.4} />
              <span className={styles.metricValue}>{formatPercent(container.cpu.percent, "adaptive")}</span>
            </span>
            {container.memory && (
              <span
                className={styles.metricBadge}
                // @ts-ignore
                style={{ "--metric-color": severityColor(container.memory.percent, [60, 85]) }}
                title={`RAM: ${formatBytes(container.memory.used)} / ${formatBytes(container.memory.limit)} (${formatPercent(container.memory.percent, "adaptive")})`}
              >
                <MemoryStick size={10} strokeWidth={2.4} />
                <span className={styles.metricValue}>{formatBytes(container.memory.used)}</span>
              </span>
            )}
          </div>
        )}

        {container.status && (
          <span className={styles.containerStatus}>{container.status}</span>
        )}
      </div>
    </div>
  );
}


