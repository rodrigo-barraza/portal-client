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
} from "lucide-react";
import { BadgeComponent, ButtonComponent, LoadingIndicatorComponent, PageHeaderComponent } from "@rodrigo-barraza/components-library";

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
function severityColor(pct, thresholds = [40, 80]) {
  if (pct > thresholds[1]) return "var(--danger)";
  if (pct > thresholds[0]) return "var(--warning)";
  return "var(--success)";
}

export default function DevicesComponent() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [containers, setContainers] = useState([]);
  const didFetch = useRef(false);

  async function loadDevices() {
    try {
      const res = await ApiService.getDevices();
      setDevices(res.devices || []);
    } catch (err) {
      console.error("Devices fetch failed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const fetchContainers = useCallback(async () => {
    try {
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
      if (!map[deviceId]) map[deviceId] = [];
      map[deviceId].push(c);
    }
    // Sort containers within each device by name
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [containers]);

  const sortedDevices = [...devices].sort((a, b) => {
    const aCount = containersByDevice[a.id]?.length || 0;
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
          {sortedDevices.map((device, idx) => (
            <DeviceCard
              key={device.id}
              device={device}
              delay={idx * 60}
              containers={containersByDevice[device.id] || []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Device Card ───────────────────────────────────────────────────

function DeviceCard({ device, delay, containers }) {
  const DeviceIcon = DEVICE_ICON_MAP[device.type] || Monitor;
  const accentColor = DEVICE_COLOR_MAP[device.type] || "var(--accent-color)";
  const runningCount = containers.filter((c) => c.state === "running").length;
  const allRunning = runningCount === containers.length && containers.length > 0;

  return (
    <div
      className={styles.deviceCard}
      style={{
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
          <div
            className={`${styles.statusDot} ${allRunning ? styles.healthy : styles.unhealthy}`}
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
          <div className={styles.servicesHeader}>
            <span>Containers</span>
          </div>
          <div className={styles.servicesTable}>
            {containers.map((container) => (
              <ContainerRow
                key={container.name}
                container={container}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Container Row ─────────────────────────────────────────────────

function ContainerRow({ container }) {
  const isRunning = container.state === "running";

  return (
    <div className={`${styles.serviceRow} ${isRunning ? styles.healthy : styles.unhealthy}`}>
      <div className={styles.serviceLeft}>
        <div
          className={`${styles.svcDot} ${isRunning ? styles.healthy : styles.unhealthy}`}
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
              style={{ "--metric-color": severityColor(container.cpu.percent) }}
              title={`CPU: ${formatPercent(container.cpu.percent, "adaptive")} · ${container.cpu.cores} core${container.cpu.cores !== 1 ? "s" : ""}`}
            >
              <Cpu size={10} strokeWidth={2.4} />
              <span className={styles.metricValue}>{formatPercent(container.cpu.percent, "adaptive")}</span>
            </span>
            {container.memory && (
              <span
                className={styles.metricBadge}
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


