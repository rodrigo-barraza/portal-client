"use client";

import type { ReactNode } from "react";
import { HardDrive } from "lucide-react";
import { formatBytes } from "@rodrigo-barraza/utilities-library";
import type { StorageBucket } from "../../types/portal";
import { activationProps } from "./keyboardActivation";
import { formatDate, staggerDelay } from "./storageFiles";
import styles from "../StorageComponent.module.css";

function SkeletonLine({ width }: { width: number | string }) {
  return <span className={styles["skeleton-line"]} style={{ width }} />;
}

/**
 * A bucket stat: the value once known, a shimmer while the stream is
 * still collecting it, and a dash if the stream ended without it.
 */
function statValue(value: number | null, streaming: boolean, format: (value: number) => string, width: number): ReactNode {
  if (value != null) return format(value);
  return streaming ? <SkeletonLine width={width} /> : "—";
}

const formatCount = (value: number) => value.toLocaleString();

interface BucketViewProps {
  buckets: StorageBucket[];
  skeletonCount: number;
  streaming: boolean;
  onOpen: (bucketName: string) => void;
}

export function BucketCardGrid({ buckets, skeletonCount, streaming, onOpen }: BucketViewProps) {
  return (
    <div className={styles["bucket-grid"]}>
      {buckets.map((bucket, index) => (
        <div
          key={bucket.name}
          className={styles["bucket-card"]}
          style={{ animationDelay: staggerDelay(index, 50) }}
          {...activationProps(() => onOpen(bucket.name))}
        >
          <div className={styles["bucket-card-inner"]}>
            <div className={styles["bucket-header"]}>
              <div className={styles["bucket-icon-wrap"]}>
                <HardDrive size={18} strokeWidth={1.8} />
              </div>
              <span className={styles["bucket-name"]}>{bucket.name}</span>
            </div>
            <div className={styles["bucket-meta"]}>
              <div className={styles["bucket-stat"]}>
                <span className={styles["bucket-stat-label"]}>Objects</span>
                <span className={styles["bucket-stat-value"]}>
                  {statValue(bucket.objectCount, streaming, formatCount, 48)}
                </span>
              </div>
              <div className={styles["bucket-stat"]}>
                <span className={styles["bucket-stat-label"]}>Size</span>
                <span className={styles["bucket-stat-value"]}>
                  {statValue(bucket.totalSize, streaming, formatBytes, 64)}
                </span>
              </div>
            </div>
          </div>
          {bucket.creationDate && (
            <div className={styles["bucket-date"]}>Created {formatDate(bucket.creationDate)}</div>
          )}
        </div>
      ))}

      {Array.from({ length: skeletonCount }, (_, index) => (
        <div
          key={`skeleton-${index}`}
          className={`${styles["bucket-card"]} ${styles["bucket-card-skeleton"]}`}
          style={{ animationDelay: staggerDelay(buckets.length + index, 50) }}
          aria-hidden="true"
        >
          <div className={styles["bucket-card-inner"]}>
            <div className={styles["bucket-header"]}>
              <div className={`${styles["bucket-icon-wrap"]} ${styles["skeleton-icon"]}`}>
                <HardDrive size={18} strokeWidth={1.8} />
              </div>
              <SkeletonLine width="60%" />
            </div>
            <div className={styles["bucket-meta"]}>
              <div className={styles["bucket-stat"]}>
                <span className={styles["bucket-stat-label"]}>Objects</span>
                <SkeletonLine width={48} />
              </div>
              <div className={styles["bucket-stat"]}>
                <span className={styles["bucket-stat-label"]}>Size</span>
                <SkeletonLine width={64} />
              </div>
            </div>
          </div>
          <div className={styles["bucket-date"]}>
            <SkeletonLine width="40%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BucketTableView({ buckets, skeletonCount, streaming, onOpen }: BucketViewProps) {
  return (
    <div className={styles["object-list-container"]}>
      <div className={styles["bucket-column-header"]}>
        <span>Bucket</span>
        <span>Objects</span>
        <span>Size</span>
        <span>Created</span>
      </div>

      {buckets.map((bucket, index) => (
        <div
          key={bucket.name}
          className={`${styles["object-row"]} ${styles["folder-row"]}`}
          style={{ animationDelay: staggerDelay(index, 30) }}
          {...activationProps(() => onOpen(bucket.name))}
        >
          <div className={styles["object-name"]}>
            <div className={styles["bucket-row-icon"]}>
              <HardDrive size={15} strokeWidth={1.8} />
            </div>
            <span className={styles["object-name-text"]}>{bucket.name}</span>
          </div>
          <span className={styles["object-size"]}>
            {statValue(bucket.objectCount, streaming, formatCount, 40)}
          </span>
          <span className={styles["object-size"]}>
            {statValue(bucket.totalSize, streaming, formatBytes, 56)}
          </span>
          <span className={styles["object-date"]}>{formatDate(bucket.creationDate)}</span>
        </div>
      ))}

      {Array.from({ length: skeletonCount }, (_, index) => (
        <div
          key={`skeleton-row-${index}`}
          className={`${styles["object-row"]} ${styles["bucket-skeleton-row"]}`}
          style={{ animationDelay: staggerDelay(buckets.length + index, 30) }}
          aria-hidden="true"
        >
          <div className={styles["object-name"]}>
            <div className={`${styles["bucket-row-icon"]} ${styles["skeleton-icon"]}`}>
              <HardDrive size={15} strokeWidth={1.8} />
            </div>
            <SkeletonLine width="45%" />
          </div>
          <div className={styles["object-size"]}>
            <SkeletonLine width={40} />
          </div>
          <div className={styles["object-size"]}>
            <SkeletonLine width={56} />
          </div>
          <div className={styles["object-date"]}>
            <SkeletonLine width={72} />
          </div>
        </div>
      ))}
    </div>
  );
}
