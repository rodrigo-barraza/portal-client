"use client";

import { ArrowUp, Database, Github, Globe, HardDrive, Lock, Monitor, Server } from "lucide-react";
import styles from "./ServiceCardComponent.module.css";
import { formatDuration, timeAgo } from "../utils/utilities";

/**
 * Format seconds into a human-readable uptime string.
 * e.g. 86400 → "1d", 3661 → "1h 1m"
 */
function formatUptime(seconds) {
  if (seconds == null) return null;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Map serviceType to a Lucide icon — matches TopologyComponent.
 */
const SERVICE_TYPE_ICONS = {
  API: Server,
  Client: Monitor,
  Database: Database,
  Storage: HardDrive,
};

export default function ServiceCardComponent({ service }) {
  const isHealthy = service.healthy;
  const statusClass = isHealthy ? styles.healthy : styles.unhealthy;
  const isProduction = service.environment === "Production";
  const isInfra = service.isInfrastructure;

  const TypeIcon = SERVICE_TYPE_ICONS[service.serviceType] || Globe;

  return (
    <div className={`${styles.card} ${statusClass}`}>
      <div className={styles.cardHeader}>
        <div className={styles.nameRow}>
          <div className={`${styles.statusDot} ${statusClass}`} />
          <TypeIcon
            size={14}
            strokeWidth={1.8}
            className={styles.infraIcon}
          />
          <span className={styles.name}>{service.name}</span>
        </div>
      </div>

      <div className={styles.details}>
        {/* ── Stage / Visibility / Status ── */}
        <div className={styles.detail}>
          <span className={styles.detailLabel}>Environment</span>
          <span
            className={`${styles.stageBadge} ${isProduction ? styles.stageProduction : styles.stageDevelopment}`}
          >
            {service.environment || "Unknown"}
          </span>
        </div>

        {service.serviceType && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Type</span>
            <span className={`${styles.stageBadge} ${styles.serviceTypeBadge}`}>
              {service.serviceType}
            </span>
          </div>
        )}

        {service.visibility && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Visibility</span>
            <span
              className={`${styles.stageBadge} ${service.visibility === "external" ? styles.visibilityExternal : styles.visibilityInternal}`}
            >
              {service.visibility === "external" ? (
                <><Globe size={9} strokeWidth={2.2} /> External</>
              ) : (
                <><Lock size={9} strokeWidth={2.2} /> Internal</>
              )}
            </span>
          </div>
        )}

        <div className={styles.detail}>
          <span className={styles.detailLabel}>Status</span>
          <span className={styles.statusLabel}>
            {isHealthy ? "Healthy" : "Down"}
          </span>
        </div>

        {service.responseTimeMs != null && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Response</span>
            <span className={styles.detailValue}>
              {formatDuration(service.responseTimeMs)}
            </span>
          </div>
        )}

        {service.host && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Host</span>
            <span className={styles.detailValue}>{service.host}</span>
          </div>
        )}

        {/* ── Infrastructure-specific metadata ── */}
        {isInfra && service.metadata && (
          <>
            {service.metadata.version && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Version</span>
                <span className={`${styles.detailValue} ${styles.mono}`}>
                  {service.metadata.version}
                </span>
              </div>
            )}
            {service.metadata.uptime != null && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Uptime</span>
                <span className={styles.detailValue}>
                  {formatUptime(service.metadata.uptime)}
                </span>
              </div>
            )}
            {service.metadata.connections != null && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Connections</span>
                <span className={styles.detailValue}>
                  {service.metadata.connections}
                </span>
              </div>
            )}
            {service.metadata.databases != null && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Databases</span>
                <span className={styles.detailValue}>
                  {service.metadata.databases}
                </span>
              </div>
            )}
            {service.metadata.buckets != null && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Buckets</span>
                <span className={styles.detailValue}>
                  {service.metadata.buckets}
                </span>
              </div>
            )}
            {service.metadata.bucketNames?.length > 0 && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Bucket Names</span>
                <span className={`${styles.detailValue} ${styles.mono}`}>
                  {service.metadata.bucketNames.join(", ")}
                </span>
              </div>
            )}
          </>
        )}

        {/* ── Standard service metadata ── */}
        {!isInfra && service.metadata?.version && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Version</span>
            <span className={styles.detailValue}>
              {service.metadata.version}
            </span>
          </div>
        )}

        {service.port && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Port</span>
            <code className={`${styles.detailValue} ${styles.mono}`}>
              :{service.port}
            </code>
          </div>
        )}

        {service.url && !isInfra && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Endpoint</span>
            <a
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.detailValue} ${styles.mono} ${styles.endpointLink}`}
            >
              {service.url.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}

        {service.hostname && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Hostname</span>
            <a
              href={`https://${service.hostname}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.detailValue} ${styles.mono} ${styles.endpointLink}`}
            >
              <Globe size={12} strokeWidth={2} />
              {service.hostname}
            </a>
          </div>
        )}

        {service.repo && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Repository</span>
            <a
              href={service.repo}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.detailValue} ${styles.mono} ${styles.repoLink}`}
            >
              <Github size={12} strokeWidth={2} />
              {service.repo.replace("https://github.com/", "")}
            </a>
          </div>
        )}

        {service.checkedAt && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Checked</span>
            <span className={styles.detailValue}>
              {timeAgo(service.checkedAt)}
            </span>
          </div>
        )}
      </div>

      {service.error && !isHealthy && (
        <div className={styles.errorBar}>
          {service.error}
        </div>
      )}

      {/* ── Connections (dependency graph) ── */}
      {service.dependsOn?.length > 0 && (
        <div className={styles.connections}>
          <span className={styles.connectionLabel}>
            <ArrowUp size={10} strokeWidth={2.4} />
            Requires
          </span>
          <div className={styles.connectionTags}>
            {service.dependsOn.map((dep, i) => (
              <span key={`dep-${i}-${dep.name || dep.id || ''}`} className={styles.connectionTag}>
                {dep.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

