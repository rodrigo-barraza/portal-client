"use client";

import { useState, useRef, useEffect } from "react";
import {
  RefreshCw,
  Monitor,
  HardDrive,
  CircuitBoard,
  Activity,
  AlertCircle,
  Database,
} from "lucide-react";
import PageHeaderComponent from "./PageHeaderComponent";
import PortalApiService from "../services/PortalApiService";
import { formatDuration } from "../utils/utilities";
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

export default function DevicesComponent() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const didFetch = useRef(false);

  async function loadDevices() {
    try {
      const res = await PortalApiService.getDevices();
      setDevices(res.devices || []);
    } catch (err) {
      console.error("Devices fetch failed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadDevices();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDevices();
  };

  const totalServices = devices.reduce((sum, d) => sum + d.serviceCount, 0);
  const totalHealthy = devices.reduce((sum, d) => sum + d.healthyCount, 0);

  return (
    <div className={styles.devices}>
      <PageHeaderComponent
        title="Devices"
        subtitle={
          loading
            ? "Loading device topology…"
            : `${devices.length} devices · ${totalHealthy}/${totalServices} services healthy`
        }
      >
        <button
          className={styles.refreshBtn}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw
            size={15}
            strokeWidth={2}
            className={refreshing ? styles.spinning : ""}
          />
          Refresh
        </button>
      </PageHeaderComponent>

      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.loadingDot} />
          <span>Discovering devices…</span>
        </div>
      ) : (
        <div className={styles.deviceList}>
          {devices.map((device, idx) => (
            <DeviceCard key={device.id} device={device} delay={idx * 60} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Device Card ───────────────────────────────────────────────────

function DeviceCard({ device, delay }) {
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

      {/* ── Notes ── */}
      {device.notes && (
        <p className={styles.deviceNotes}>{device.notes}</p>
      )}

      {/* ── Services Table ── */}
      {device.services.length > 0 && (
        <div className={styles.servicesSection}>
          <div className={styles.servicesHeader}>
            <span>Services</span>
          </div>
          <div className={styles.servicesTable}>
            {device.services.map((svc) => (
              <ServiceRow key={svc.id} service={svc} />
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

function ServiceRow({ service }) {
  const isHealthy = service.healthy;
  const displayUrl = service.url?.replace(/^https?:\/\//, "") || "—";

  return (
    <div className={`${styles.serviceRow} ${isHealthy ? styles.healthy : styles.unhealthy}`}>
      <div className={styles.serviceLeft}>
        <div
          className={`${styles.svcDot} ${isHealthy ? styles.healthy : styles.unhealthy}`}
        />
        <span className={styles.svcName}>{service.name}</span>
        <span
          className={`${styles.stageBadge} ${service.stage === "Production" ? styles.stageProduction : styles.stageDevelopment}`}
        >
          {service.stage}
        </span>
      </div>
      <div className={styles.serviceRight}>
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
        <span className={`${styles.stageBadge} ${styles.stageInfra}`}>
          {infra.type === "database" ? "Database" : "Object Store"}
        </span>
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
