/**
 * Pure shaping for the storage overview panels — MinIO bucket and Docker
 * disk-usage donuts, and normalizing the /stats/system response.
 */

import type {
  DiskUsage,
  DonutSegment,
  StorageBucket,
  SystemInfo,
  SystemInfoResponse,
} from "../../types/portal";

export const DISK_COLORS = {
  images: "#6366f1",
  volumes: "#8b5cf6",
  buildCache: "#a855f7",
  containers: "#ec4899",
};

const BUCKET_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#f97316",
];

/** One Docker host's system info; the all-hosts listing names each host. */
export type DockerHostInfo = SystemInfo & { deviceName?: string };

/**
 * /stats/system without a device returns one entry per Docker host that
 * answered (an array); with a device, a single object. null = it failed.
 */
export function normalizeDockerHosts(response: SystemInfoResponse | null): DockerHostInfo[] {
  if (!response) return [];
  return Array.isArray(response) ? response : [response];
}

export function diskSegments(disk: DiskUsage): DonutSegment[] {
  return [
    { value: disk.images.totalSize, color: DISK_COLORS.images, label: "Images" },
    { value: disk.volumes.totalSize, color: DISK_COLORS.volumes, label: "Volumes" },
    { value: disk.buildCache.totalSize, color: DISK_COLORS.buildCache, label: "Build Cache" },
    { value: disk.containers.totalWritableSize, color: DISK_COLORS.containers, label: "Containers" },
  ].filter((segment) => segment.value > 0);
}

/** Non-empty buckets, largest first, each with a palette color. */
export function bucketSegments(buckets: StorageBucket[]): DonutSegment[] {
  return buckets
    .filter((bucket) => (bucket.totalSize ?? 0) > 0)
    .sort((first, second) => (second.totalSize ?? 0) - (first.totalSize ?? 0))
    .map((bucket, index) => ({
      value: bucket.totalSize ?? 0,
      color: BUCKET_COLORS[index % BUCKET_COLORS.length],
      label: bucket.name,
      objectCount: bucket.objectCount ?? 0,
    }));
}

/** Object and byte totals over buckets whose stats have arrived. */
export function summarizeBuckets(buckets: StorageBucket[]): { objects: number; bytes: number } {
  let objects = 0;
  let bytes = 0;
  for (const bucket of buckets) {
    objects += bucket.objectCount ?? 0;
    bytes += bucket.totalSize ?? 0;
  }
  return { objects, bytes };
}

/** Middle-truncate a long name, keeping its head and tail readable. */
export function truncateMiddle(value: string, maxLength: number, head: number, tail: number): string {
  return value.length > maxLength ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}
