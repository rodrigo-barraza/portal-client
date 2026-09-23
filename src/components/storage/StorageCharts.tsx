"use client";

import { formatBytes } from "@rodrigo-barraza/utilities-library";
import type { DonutSegment } from "../../types/portal";
import styles from "../StorageComponent.module.css";

/** SVG ring of byte-sized segments with the total in the middle. */
export function DonutChart({
  segments,
  size = 130,
  strokeWidth = 16,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  // Each arc starts where the previous segments' values end
  const arcs = segments.map((segment, index) => ({
    segment,
    start: segments.slice(0, index).reduce((sum, previous) => sum + previous.value, 0),
  }));

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={styles["donut"]}
      role="img"
      aria-label={`Total ${formatBytes(total)}`}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--background-elevated)"
        strokeWidth={strokeWidth}
      />
      {arcs.map(({ segment, start }, index) => {
        const dashLength = total > 0 ? (segment.value / total) * circumference : 0;
        return (
          <circle
            key={segment.label}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={total > 0 ? -(start / total) * circumference : 0}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            className={styles["donut-segment"]}
            style={{ animationDelay: `${index * 100}ms` }}
          />
        );
      })}
      <text x={center} y={center - 4} textAnchor="middle" className={styles["donut-total"]}>
        {formatBytes(total)}
      </text>
      <text x={center} y={center + 12} textAnchor="middle" className={styles["donut-label"]}>
        Total
      </text>
    </svg>
  );
}

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
