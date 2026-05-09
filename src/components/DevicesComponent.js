"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Monitor,
  HardDrive,
  CircuitBoard,
  Activity,
  AlertCircle,
  Database,
  Globe,
  Lock,
  Cpu,
  MemoryStick,
  Gauge,
} from "lucide-react";
import { BadgeComponent, ButtonComponent, LoadingIndicatorComponent, PageHeaderComponent, VisibilityBadgeComponent } from "@rodrigo-barraza/components-library";

import ApiService from "../services/ApiService";
import { formatDuration } from "@rodrigo-barraza/utilities-library";
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
 * Format bytes into human-readable units.
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

/**
 * Format percentage with appropriate precision.
 */
function formatPercent(pct) {
  if (pct < 0.01) return "0%";
  if (pct < 1) return `${pct.toFixed(2)}%`;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

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
  const [containerStats, setContainerStats] = useState({});
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

  const fetchContainerStats = useCallback(async () => {
    try {
      const currentRes = await ApiService.getContainerStats();
      const statsMap = {};
      if (currentRes?.containers) {
        for (const c of currentRes.containers) {
          statsMap[c.name] = {
            cpu: c.cpu,
            memory: c.memory,
            network: c.network,
            blockIO: c.blockIO,
            pids: c.pids,
          };
        }
      }
      setContainerStats(statsMap);
    } catch {
      // Container stats are supplementary — silently ignore
    }
  }, []);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadDevices();
    fetchContainerStats();
  }, [fetchContainerStats]);

  // Poll container stats every 5 seconds
  useEffect(() => {
    const timer = setInterval(fetchContainerStats, 5_000);
    return () => clearInterval(timer);
  }, [fetchContainerStats]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDevices();
    fetchContainerStats();
  };

  const sortedDevices = [...devices].sort((a, b) => b.serviceCount - a.serviceCount);
  const totalServices = devices.reduce((sum, d) => sum + d.serviceCount, 0);
  const totalHealthy = devices.reduce((sum, d) => sum + d.healthyCount, 0);

  return (
    <div className={styles.devices}>
      <PageHeaderComponent sticky={false}
        title="Devices"
        subtitle={
          loading
            ? "Loading device topology…"
            : `${devices.length} devices · ${totalHealthy}/${totalServices} projects healthy`
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
            <DeviceCard key={device.id} device={device} delay={idx * 60} containerStats={containerStats} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Device Card ───────────────────────────────────────────────────

function DeviceCard({ device, delay, containerStats }) {
  const DeviceIcon = DEVICE_ICON_MAP[device.type] || Monitor;
  const accentColor = DEVICE_COLOR_MAP[device.type] || "var(--accent-color)";
  const allHealthy = device.healthyCount === device.serviceCount;

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
            className={`${styles.statusDot} ${allHealthy ? styles.healthy : styles.unhealthy}`}
          />
          <span className={styles.statusLabel}>
            {device.healthyCount}/{device.serviceCount}
          </span>
        </div>
      </div>

      {/* ── Hostname ── */}
      <div className={styles.hostnameRow}>
        <span className={styles.hostnameLabel}>Hostname</span>
        <code className={styles.hostname}>{device.hostname}</code>
      </div>

      {/* ── Specs ── */}
      {device.specs && (
        <div className={styles.specsBar}>
          <div className={styles.specItem} title={device.specs.cpu}>
            <Cpu size={13} strokeWidth={1.8} className={styles.specIcon} />
            <div className={styles.specContent}>
              <span className={styles.specValue}>{device.specs.cpu}</span>
              <span className={styles.specLabel}>
                {device.specs.cores}C / {device.specs.threads}T
              </span>
            </div>
          </div>
          <div className={styles.specDivider} />
          <div className={styles.specItem}>
            <MemoryStick size={13} strokeWidth={1.8} className={styles.specIcon} />
            <div className={styles.specContent}>
              <span className={styles.specValue}>{device.specs.memoryGB} GB</span>
              <span className={styles.specLabel}>Memory</span>
            </div>
          </div>
          <div className={styles.specDivider} />
          <div className={styles.specItem}>
            <HardDrive size={13} strokeWidth={1.8} className={styles.specIcon} />
            <div className={styles.specContent}>
              <span className={styles.specValue}>
                {device.specs.storageGB >= 1000
                  ? `${(device.specs.storageGB / 1000).toFixed(device.specs.storageGB % 1000 === 0 ? 0 : 1)} TB`
                  : `${device.specs.storageGB} GB`}
              </span>
              <span className={styles.specLabel}>{device.specs.storageType}</span>
            </div>
          </div>
          {device.specs.gpu && (
            <>
              <div className={styles.specDivider} />
              <div className={styles.specItem}>
                <Gauge size={13} strokeWidth={1.8} className={styles.specIcon} />
                <div className={styles.specContent}>
                  <span className={styles.specValue}>{device.specs.gpu}</span>
                  <span className={styles.specLabel}>GPU</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Notes ── */}
      {device.notes && (
        <p className={styles.deviceNotes}>{device.notes}</p>
      )}

      {/* ── Projects Table ── */}
      {device.services.length > 0 && (
        <div className={styles.servicesSection}>
          <div className={styles.servicesHeader}>
            <span>Projects</span>
          </div>
          <div className={styles.servicesTable}>
            {device.services.map((svc) => (
              <ServiceRow
                key={svc.id}
                service={svc}
                stats={svc.dockerProject ? containerStats[svc.dockerProject] : null}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Infrastructure Table ── */}
      {device.infrastructure?.length > 0 && (
        <div className={styles.servicesSection}>
          <div className={`${styles.servicesHeader} ${styles.infraHeader}`}>
            <span>Infrastructure</span>
          </div>
          <div className={styles.servicesTable}>
            {device.infrastructure.map((infra) => (
              <InfraRow key={infra.id} infra={infra} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Service Row ───────────────────────────────────────────────────

function ServiceRow({ service, stats }) {
  const isHealthy = service.healthy;
  const displayUrl = service.url?.replace(/^https?:\/\//, "") || "—";

  return (
    <div className={`${styles.serviceRow} ${isHealthy ? styles.healthy : styles.unhealthy}`}>
      <div className={styles.serviceLeft}>
        <div
          className={`${styles.svcDot} ${isHealthy ? styles.healthy : styles.unhealthy}`}
        />
        <span className={styles.svcName}>{service.name}</span>
        <BadgeComponent variant={service.environment === "Production" ? "success" : "info"}>
          {service.environment}
        </BadgeComponent>
        {service.visibility && (
          <VisibilityBadgeComponent visibility={service.visibility} icons={{ Globe, Lock }} />
        )}
      </div>
      <div className={styles.serviceRight}>
        {/* ── Docker Metrics ── */}
        {stats && (
          <div className={styles.metricBadges}>
            <span
              className={styles.metricBadge}
              style={{ "--metric-color": severityColor(stats.cpu.percent) }}
              title={`CPU: ${formatPercent(stats.cpu.percent)} · ${stats.cpu.cores} core${stats.cpu.cores !== 1 ? "s" : ""}`}
            >
              <Cpu size={10} strokeWidth={2.4} />
              <span className={styles.metricValue}>{formatPercent(stats.cpu.percent)}</span>
            </span>
            <span
              className={styles.metricBadge}
              style={{ "--metric-color": severityColor(stats.memory.percent, [60, 85]) }}
              title={`RAM: ${formatBytes(stats.memory.used)} / ${formatBytes(stats.memory.limit)} (${formatPercent(stats.memory.percent)})`}
            >
              <MemoryStick size={10} strokeWidth={2.4} />
              <span className={styles.metricValue}>{formatBytes(stats.memory.used)}</span>
            </span>
          </div>
        )}

        {service.port && (
          <code className={styles.svcPort}>:{service.port}</code>
        )}
        <span className={styles.svcUrl}>{displayUrl}</span>
        {service.responseTimeMs != null && (
          <span className={styles.svcLatency}>
            <Activity size={11} strokeWidth={2} />
            {formatDuration(service.responseTimeMs)}
          </span>
        )}
        {!isHealthy && service.error && (
          <span className={styles.svcError}>
            <AlertCircle size={11} strokeWidth={2} />
            {service.error}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Infrastructure Row ────────────────────────────────────────────

const INFRA_ICON_MAP = {
  database: Database,
  "object-store": HardDrive,
};

function InfraRow({ infra }) {
  const isHealthy = infra.healthy;
  const InfraIcon = INFRA_ICON_MAP[infra.type] || Database;

  // Build metadata chips
  const chips = [];
  if (infra.metadata?.version) chips.push(`v${infra.metadata.version}`);
  if (infra.metadata?.databases != null) chips.push(`${infra.metadata.databases} dbs`);
  if (infra.metadata?.connections != null) chips.push(`${infra.metadata.connections} conn`);
  if (infra.metadata?.buckets != null) chips.push(`${infra.metadata.buckets} buckets`);

  return (
    <div className={`${styles.serviceRow} ${styles.infraRow} ${isHealthy ? styles.healthy : styles.unhealthy}`}>
      <div className={styles.serviceLeft}>
        <div
          className={`${styles.svcDot} ${isHealthy ? styles.healthy : styles.unhealthy}`}
        />
        <InfraIcon size={13} strokeWidth={1.8} className={styles.infraRowIcon} />
        <span className={styles.svcName}>{infra.name}</span>
        <BadgeComponent variant="info">
          {infra.type === "database" ? "Database" : "Object Store"}
        </BadgeComponent>
        {infra.visibility && (
          <VisibilityBadgeComponent visibility={infra.visibility} icons={{ Globe, Lock }} />
        )}
      </div>
      <div className={styles.serviceRight}>
        {infra.port && (
          <code className={styles.svcPort}>:{infra.port}</code>
        )}
        {chips.map((chip) => (
          <span key={chip} className={styles.infraChip}>{chip}</span>
        ))}
        {infra.responseTimeMs != null && (
          <span className={styles.svcLatency}>
            <Activity size={11} strokeWidth={2} />
            {formatDuration(infra.responseTimeMs)}
          </span>
        )}
        {!isHealthy && infra.error && (
          <span className={styles.svcError}>
            <AlertCircle size={11} strokeWidth={2} />
            {infra.error}
          </span>
        )}
      </div>
    </div>
  );
}
