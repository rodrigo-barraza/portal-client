"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  ArrowDown,
  Database,
  Globe,
  HardDrive,
  Lock,
  Monitor,
  Play,
  RotateCcw,
  ScrollText,
  Server,
  Square,
} from "lucide-react";
import { BadgeComponent } from "@rodrigo-barraza/components";
import { formatDuration, timeAgo } from "@rodrigo-barraza/utilities";
import styles from "./ServiceTableComponent.module.css";

/**
 * Map serviceType to a Lucide icon — matches TopologyComponent / ServiceCardComponent.
 */
const SERVICE_TYPE_ICONS = {
  API: Server,
  Client: Monitor,
  Database: Database,
  Storage: HardDrive,
};

const COLUMNS = [
  { key: "name",       label: "Service" },
  { key: "status",     label: "Status" },
  { key: "type",       label: "Type" },
  { key: "visibility", label: "Visibility" },
  { key: "port",       label: "Port" },
  { key: "response",   label: "Response" },
];

export default function ServiceTableComponent({
  services,
  sortKey,
  sortDir,
  onSort,
  onRestart,
  onStop,
  onStart,
}) {
  if (services.length === 0) {
    return (
      <div className={styles.emptyState}>
        No services match the selected filters
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`${styles.th} ${
                  sortKey === col.key ? styles.thActive : ""
                }`}
                onClick={() => onSort(col.key)}
              >
                <span className={styles.thContent}>
                  {col.label}
                  {sortKey === col.key && (
                    <span className={styles.sortIcon}>
                      {sortDir === "asc" ? (
                        <ArrowUp size={10} strokeWidth={2.6} />
                      ) : (
                        <ArrowDown size={10} strokeWidth={2.6} />
                      )}
                    </span>
                  )}
                </span>
              </th>
            ))}
            <th className={styles.th}>Device</th>
            <th className={`${styles.th} ${styles.thActions}`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <ServiceRow
              key={service.id}
              service={service}
              onRestart={onRestart}
              onStop={onStop}
              onStart={onStart}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ServiceRow({ service, onRestart, onStop, onStart }) {
  const [restarting, setRestarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [starting, setStarting] = useState(false);

  const isHealthy = service.healthy;
  const TypeIcon = SERVICE_TYPE_ICONS[service.serviceType] || Globe;

  return (
    <tr className={`${styles.row} ${isHealthy ? styles.rowHealthy : styles.rowUnhealthy}`}>
      {/* ── Service Name ── */}
      <td className={styles.td}>
        <div className={styles.nameCell}>
          <TypeIcon
            size={14}
            strokeWidth={2.6}
            className={`${styles.typeIcon} ${isHealthy ? styles.iconHealthy : styles.iconUnhealthy}`}
          />
          <span className={styles.serviceName}>{service.name}</span>
        </div>
      </td>

      {/* ── Status ── */}
      <td className={styles.td}>
        <span className={`${styles.statusDot} ${isHealthy ? styles.dotHealthy : styles.dotUnhealthy}`} />
        <span className={`${styles.statusText} ${isHealthy ? styles.textHealthy : styles.textUnhealthy}`}>
          {isHealthy ? "Healthy" : "Down"}
        </span>
      </td>

      {/* ── Type ── */}
      <td className={styles.td}>
        {service.serviceType && (
          <BadgeComponent variant="info">
            {service.serviceType}
          </BadgeComponent>
        )}
      </td>

      {/* ── Visibility ── */}
      <td className={styles.td}>
        {service.visibility && (
          <BadgeComponent
            variant={service.visibility === "external" ? "accent" : "info"}
          >
            {service.visibility === "external" ? (
              <><Globe size={9} strokeWidth={2.2} /> External</>
            ) : (
              <><Lock size={9} strokeWidth={2.2} /> Internal</>
            )}
          </BadgeComponent>
        )}
      </td>

      {/* ── Port ── */}
      <td className={styles.td}>
        {service.port && (
          <code className={styles.mono}>:{service.port}</code>
        )}
      </td>

      {/* ── Response ── */}
      <td className={styles.td}>
        {service.responseTimeMs != null && (
          <span className={styles.mono}>
            {formatDuration(service.responseTimeMs)}
          </span>
        )}
      </td>

      {/* ── Device ── */}
      <td className={styles.td}>
        {service.device && (
          <span className={styles.deviceText}>{service.device}</span>
        )}
      </td>

      {/* ── Actions ── */}
      <td className={`${styles.td} ${styles.tdActions}`}>
        {service.restartable && (
          <div className={styles.actionRow}>
            {isHealthy ? (
              <button
                className={`${styles.actionBtn} ${styles.stopBtn} ${stopping ? styles.actionBtnLoading : ""}`}
                disabled={stopping || restarting}
                onClick={async () => {
                  setStopping(true);
                  try { await onStop?.(service.id); }
                  finally { setTimeout(() => setStopping(false), 5000); }
                }}
                title="Stop"
              >
                <Square size={9} strokeWidth={2.6} />
              </button>
            ) : (
              <button
                className={`${styles.actionBtn} ${styles.startBtn} ${starting ? styles.actionBtnLoading : ""}`}
                disabled={starting || restarting}
                onClick={async () => {
                  setStarting(true);
                  try { await onStart?.(service.id); }
                  finally { setTimeout(() => setStarting(false), 5000); }
                }}
                title="Start"
              >
                <Play size={9} strokeWidth={2.6} fill="currentColor" />
              </button>
            )}

            <Link
              href={`/logs?service=${service.id}`}
              className={`${styles.actionBtn} ${styles.logsBtn}`}
              title="Logs"
            >
              <ScrollText size={9} strokeWidth={2.6} />
            </Link>

            <button
              className={`${styles.actionBtn} ${styles.restartBtn} ${restarting ? styles.actionBtnLoading : ""}`}
              disabled={restarting || stopping || starting}
              onClick={async () => {
                setRestarting(true);
                try { await onRestart?.(service.id); }
                finally { setTimeout(() => setRestarting(false), 5000); }
              }}
              title="Restart"
            >
              <RotateCcw size={9} strokeWidth={2.6} className={restarting ? styles.spin : ""} />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
