"use client";

import { useMemo } from "react";
import { Box, Database, HardDrive, Layers, Package } from "lucide-react";
import { formatBytes } from "@rodrigo-barraza/utilities-library";
import type { StorageSummary } from "../../types/portal";
import { DonutChart } from "../AnalyticsPrimitives";
import { UsageBar } from "./StorageUsageBar";
import {
  bucketSegments,
  diskSegments,
  DISK_COLORS,
  truncateMiddle,
  type DockerHostInfo,
} from "./storageOverview";
import styles from "../StorageComponent.module.css";

const LIST_LIMIT = 8;

function PanelHeader({
  icon: Icon,
  title,
  meta,
}: {
  icon: typeof Database;
  title: string;
  meta?: string;
}) {
  return (
    <div className={styles["storage-panel-header"]}>
      <Icon size={15} strokeWidth={2.2} className={styles["storage-panel-icon"]} />
      <span className={styles["storage-panel-title"]}>{title}</span>
      {meta && <span className={styles["storage-panel-meta"]}>{meta}</span>}
    </div>
  );
}

function MinioPanel({ summary }: { summary: StorageSummary }) {
  const segments = useMemo(() => bucketSegments(summary.buckets || []), [summary]);
  if (segments.length === 0) return null;
  const largest = segments[0].value;

  return (
    <div className={styles["storage-panel"]}>
      <PanelHeader
        icon={Database}
        title="MinIO Object Storage"
        meta={`${(summary.totalObjects ?? 0).toLocaleString()} objects`}
      />
      <div className={styles["storage-panel-body"]}>
        <DonutChart segments={segments} size={130} strokeWidth={16} formatValue={formatBytes} />
        <div className={styles["storage-legend"]}>
          {segments.map((segment) => (
            <UsageBar
              key={segment.label}
              value={segment.value}
              max={largest}
              color={segment.color}
              label={segment.label}
              sublabel={`${(segment.objectCount ?? 0).toLocaleString()} objects`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DockerDiskPanel({ host }: { host: DockerHostInfo }) {
  const disk = host.disk!;
  const segments = useMemo(() => diskSegments(disk), [disk]);
  const images = (disk.images.items ?? []).slice(0, LIST_LIMIT);
  const volumes = (disk.volumes.items ?? []).slice(0, LIST_LIMIT);
  const meta = [host.deviceName ?? host.deviceId, host.serverVersion && `v${host.serverVersion}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={styles["storage-panel"]}>
      <PanelHeader icon={Layers} title="Docker Disk Usage" meta={meta} />
      <div className={styles["storage-panel-body"]}>
        <DonutChart segments={segments} size={130} strokeWidth={16} formatValue={formatBytes} />
        <div className={styles["storage-legend"]}>
          <UsageBar
            value={disk.images.totalSize}
            max={disk.totalReclaimable}
            color={DISK_COLORS.images}
            label="Images"
            sublabel={`${disk.images.count} images`}
          />
          <UsageBar
            value={disk.volumes.totalSize}
            max={disk.totalReclaimable}
            color={DISK_COLORS.volumes}
            label="Volumes"
            sublabel={`${disk.volumes.count} volumes`}
          />
          <UsageBar
            value={disk.buildCache.totalSize}
            max={disk.totalReclaimable}
            color={DISK_COLORS.buildCache}
            label="Build Cache"
            sublabel={`${disk.buildCache.count} layers`}
          />
          <UsageBar
            value={disk.containers.totalWritableSize}
            max={disk.totalReclaimable}
            color={DISK_COLORS.containers}
            label="Container Layers"
            sublabel={`${disk.containers.count} containers`}
          />
        </div>
      </div>

      {images.length > 0 && (
        <div className={styles["image-list"]}>
          <div className={styles["image-list-header"]}>
            <Package size={12} strokeWidth={2.2} />
            <span>Largest Images</span>
          </div>
          {images.map((image) => {
            const tag = image.tags?.[0] || image.id || "unknown";
            return (
              <div key={image.id ?? tag} className={styles["image-row"]}>
                <Box size={12} strokeWidth={1.8} className={styles["image-icon"]} />
                <span className={styles["image-name"]} title={tag}>
                  {truncateMiddle(tag, 50, 0, 48)}
                </span>
                <span className={styles["image-size"]}>{formatBytes(image.size)}</span>
              </div>
            );
          })}
        </div>
      )}

      {volumes.length > 0 && (
        <div className={styles["image-list"]}>
          <div className={styles["image-list-header"]}>
            <HardDrive size={12} strokeWidth={2.2} />
            <span>Volumes</span>
          </div>
          {volumes.map((volume) => {
            const name = volume.name || "unknown";
            return (
              <div key={name} className={styles["image-row"]}>
                <Database size={12} strokeWidth={1.8} className={styles["image-icon"]} />
                <span className={styles["image-name"]} title={name}>
                  {truncateMiddle(name, 40, 12, 24)}
                </span>
                <span className={styles["image-size"]}>{formatBytes(volume.size)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** MinIO bucket usage plus one Docker disk-usage panel per Docker host. */
export function StorageOverview({
  summary,
  dockerHosts,
}: {
  summary: StorageSummary | null;
  dockerHosts: DockerHostInfo[];
}) {
  return (
    <div className={styles["storage-grid"]}>
      {summary && <MinioPanel summary={summary} />}
      {dockerHosts.map((host) => (
        <DockerDiskPanel key={host.deviceId ?? host.deviceName} host={host} />
      ))}
    </div>
  );
}
