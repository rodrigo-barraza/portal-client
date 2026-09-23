"use client";

import { formatBytes } from "@rodrigo-barraza/utilities-library";
import styles from "../StorageComponent.module.css";

/** A labelled byte value with a proportional bar. */
export function UsageBar({
  value,
  max,
  color,
  label,
  sublabel,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  sublabel?: string;
}) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={styles["usage-bar-row"]}>
      <div className={styles["usage-bar-info"]}>
        <span className={styles["usage-bar-label"]} title={label}>
          {label}
        </span>
        <span className={styles["usage-bar-value"]}>
          {formatBytes(value)}
          {sublabel && <span className={styles["usage-bar-sub"]}> · {sublabel}</span>}
        </span>
      </div>
      <div className={styles["usage-bar-track"]}>
        <div className={styles["usage-bar-fill"]} style={{ width: `${percentage}%`, background: color }} />
      </div>
    </div>
  );
}
