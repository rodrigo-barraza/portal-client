"use client";

import styles from "./ServiceCardComponent.module.css";
import { formatDuration, timeAgo } from "../utils/utilities";

export default function ServiceCardComponent({ service }) {
  const isHealthy = service.healthy;
  const statusClass = isHealthy ? styles.healthy : styles.unhealthy;

  return (
    <div className={`${styles.card} ${statusClass}`}>
      <div className={styles.cardHeader}>
        <div className={styles.nameRow}>
          <div className={`${styles.statusDot} ${statusClass}`} />
          <span className={styles.name}>{service.name}</span>
        </div>
        <span className={styles.statusLabel}>
          {isHealthy ? "Healthy" : "Down"}
        </span>
      </div>

      <div className={styles.details}>
        {service.responseTimeMs != null && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Response</span>
            <span className={styles.detailValue}>
              {formatDuration(service.responseTimeMs)}
            </span>
          </div>
        )}

        {service.metadata?.version && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Version</span>
            <span className={styles.detailValue}>
              {service.metadata.version}
            </span>
          </div>
        )}

        {service.url && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>URL</span>
            <span className={styles.detailValue + " " + styles.mono}>
              {service.url.replace(/^https?:\/\//, "")}
            </span>
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
    </div>
  );
}
