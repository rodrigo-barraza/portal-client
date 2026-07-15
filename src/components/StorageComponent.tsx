"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw,
  HardDrive,
  Folder,
  File,
  FileImage,
  FileAudio,
  FileVideo,
  FileText,
  FileCode,
  FileArchive,
  Download,
  Eye,
  Trash2,
  Search,
  ChevronRight,
  Database,
  LayoutGrid,
  Table2,
  Layers,
  Package,
  Box,
  SearchX,
} from "lucide-react";
import {
  ButtonComponent,
  LoadingIndicatorComponent,
  ModalComponent,
  PageHeaderComponent,
  SearchInputComponent,
  SegmentedControlComponent,
  IconButtonComponent,
} from "@rodrigo-barraza/components-library";
import { formatBytes } from "@rodrigo-barraza/utilities-library";

import ApiService from "../services/ApiService";
import type {
  SystemInfo,
  StorageSummary,
  StorageBucket,
  StorageObject,
  BucketStreamEvent,
  DonutSegment,
  StorageSearchResult,
} from "../types/portal";
import styles from "./StorageComponent.module.css";

// ── Donut Chart (SVG ring) ────────────────────────────────────────
function DonutChart({
  segments,
  size = 120,
  strokeWidth = 14,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  // Precompute each segment's starting offset (cumulative value before it)
  const arcs = useMemo(() => {
    const result: (DonutSegment & { startValue: number })[] = [];
    let accumulated = 0;
    for (const segment of segments) {
      result.push({ ...segment, startValue: accumulated });
      accumulated += segment.value;
    }
    return result;
  }, [segments]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={styles['donut']}
    >
      {/* Track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--background-elevated)"
        strokeWidth={strokeWidth}
      />
      {/* Segments */}
      {arcs.map((segment, i) => {
        const percentage = total > 0 ? segment.value / total : 0;
        const dashLength = percentage * circumference;
        const dashOffset = total > 0 ? -(segment.startValue / total) * circumference : 0;

        return (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            className={styles['donut-segment']}
            style={{ animationDelay: `${i * 100}ms` }}
          />
        );
      })}
      {/* Center text */}
      <text
        x={center}
        y={center - 4}
        textAnchor="middle"
        className={styles['donut-total']}
      >
        {formatBytes(total)}
      </text>
      <text
        x={center}
        y={center + 12}
        textAnchor="middle"
        className={styles['donut-label']}
      >
        Total
      </text>
    </svg>
  );
}

// ── Percentage Bar ────────────────────────────────────────────────
function UsageBar({
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
    <div className={styles['usage-bar-row']}>
      <div className={styles['usage-bar-info']}>
        <span className={styles['usage-bar-label']}>{label}</span>
        <span className={styles['usage-bar-value']}>
          {formatBytes(value)}
          {sublabel && (
            <span className={styles['usage-bar-sub']}> · {sublabel}</span>
          )}
        </span>
      </div>
      <div className={styles['usage-bar-track']}>
        <div
          className={styles['usage-bar-fill']}
          style={{ width: `${percentage}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Disk Category Colors ──────────────────────────────────────────
const DISK_COLORS = {
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

// ── File type helpers ────────────────────────────────────────────

const IMAGE_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".ico",
]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mkv", ".mov", ".avi"]);
const TEXT_EXTS = new Set([
  ".txt",
  ".md",
  ".csv",
  ".log",
  ".ini",
  ".yml",
  ".yaml",
  ".toml",
]);
const CODE_EXTS = new Set([
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".css",
  ".html",
  ".json",
  ".xml",
  ".sh",
]);
const ARCHIVE_EXTS = new Set([
  ".zip",
  ".gz",
  ".tar",
  ".rar",
  ".7z",
  ".bz2",
  ".xz",
]);

function getFileExt(name: string) {
  return (name || "").match(/\.[^.]+$/)?.[0]?.toLowerCase() || "";
}

function getFileIcon(name: string) {
  const ext = getFileExt(name);
  if (IMAGE_EXTS.has(ext)) return FileImage;
  if (AUDIO_EXTS.has(ext)) return FileAudio;
  if (VIDEO_EXTS.has(ext)) return FileVideo;
  if (TEXT_EXTS.has(ext)) return FileText;
  if (CODE_EXTS.has(ext)) return FileCode;
  if (ARCHIVE_EXTS.has(ext)) return FileArchive;
  return File;
}

function isImage(name: string) {
  return IMAGE_EXTS.has(getFileExt(name));
}

function isPreviewable(name: string) {
  const ext = getFileExt(name);
  return IMAGE_EXTS.has(ext) || AUDIO_EXTS.has(ext) || VIDEO_EXTS.has(ext);
}

function getMediaType(name: string) {
  const ext = getFileExt(name);
  if (IMAGE_EXTS.has(ext)) return "image";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (VIDEO_EXTS.has(ext)) return "video";
  return null;
}

/** Extract the display name from a full key — strip the prefix to show just the leaf. */
function displayName(fullKey: string, prefix: string) {
  if (!prefix) return fullKey;
  return fullKey.startsWith(prefix) ? fullKey.slice(prefix.length) : fullKey;
}

/** Format a prefix as a folder label. */
function folderLabel(prefix: string, currentPrefix: string) {
  const relative = currentPrefix ? prefix.slice(currentPrefix.length) : prefix;
  return relative.replace(/\/$/, "");
}

/**
 * Trigger a browser download via a transient anchor element —
 * preserves `<a download>` semantics for button-based actions.
 */
function triggerDownload(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.setAttribute("download", "");
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

// ── Component ────────────────────────────────────────────────────

export default function StorageComponent() {
  const [view, setView] = useState("buckets"); // "buckets" | "objects"
  const [bucketViewMode, setBucketViewMode] = useState("cards"); // "cards" | "table"
  const [objectViewMode, setObjectViewMode] = useState("table"); // "table" | "grid"
  const [buckets, setBuckets] = useState<StorageBucket[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const didFetch = useRef(false);
  const streamRef = useRef<{ close: () => void } | null>(null);

  // Progressive loading state
  const [streaming, setStreaming] = useState(true);
  const [totalExpected, setTotalExpected] = useState(0);
  const [skeletonCount, setSkeletonCount] = useState(0);

  // Object browser state
  const [activeBucket, setActiveBucket] = useState<string | null>(null);
  const [prefix, setPrefix] = useState("");
  const [objects, setObjects] = useState<StorageObject[]>([]);
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [objectsLoading, setObjectsLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Global file search state
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<StorageSearchResult[]>([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchTotalScanned, setGlobalSearchTotalScanned] = useState(0);
  const [globalSearchTruncated, setGlobalSearchTruncated] = useState(false);
  const [isGlobalSearchActive, setIsGlobalSearchActive] = useState(false);
  const globalSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preview state
  const [previewObject, setPreviewObject] = useState<StorageObject | null>(
    null,
  );
  const [previewStat, setPreviewStat] = useState<StorageObject | null>(null);

  // Storage overview state
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [storageSummary, setStorageSummary] = useState<StorageSummary | null>(
    null,
  );
  const [overviewLoading, setOverviewLoading] = useState(true);

  // ── Progressive bucket streaming ────────────────────────────
  const streamBuckets = useCallback(() => {
    setStreaming(true);
    setBuckets([]);
    setTotalExpected(0);
    setSkeletonCount(0);

    streamRef.current?.close();
    streamRef.current = ApiService.streamStorageBuckets(
      (event: BucketStreamEvent) => {
        switch (event.type) {
          case "init":
            setTotalExpected(event.totalBuckets || 0);
            setSkeletonCount(event.totalBuckets || 0);
            break;
          case "bucket":
            if (event.bucket) setBuckets((previousState) => [...previousState, event.bucket!]);
            setSkeletonCount((previousState) => Math.max(0, previousState - 1));
            break;
          case "done":
            setStreaming(false);
            setRefreshing(false);
            setSkeletonCount(0);
            break;
          case "error":
            console.error("Bucket stream error:", event.message);
            setStreaming(false);
            setRefreshing(false);
            setSkeletonCount(0);
            break;
        }
      },
    );
  }, []);

  // ── Fetch storage overview data ──────────────────────────────
  const loadOverviewData = useCallback(async () => {
    try {
      const [sysRes, storageRes] = await Promise.all([
        ApiService.getSystemInfo().catch(() => null),
        ApiService.getStorageSummary().catch(() => null),
      ]);
      setSystemInfo(sysRes);
      setStorageSummary(storageRes);
    } catch (error) {
      console.error("Storage overview fetch failed:", error);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    streamBuckets();
    loadOverviewData();
    return () => {
      streamRef.current?.close();
      if (globalSearchTimerRef.current) clearTimeout(globalSearchTimerRef.current);
    };
  }, [streamBuckets, loadOverviewData]);

  // ── Object listing ───────────────────────────────────────────
  const loadObjects = useCallback(async (bucket: string, pfx = "") => {
    setObjectsLoading(true);
    try {
      const objectsResponse = await ApiService.getStorageObjects(bucket, { prefix: pfx });
      setObjects(objectsResponse.objects || []);
      setPrefixes(objectsResponse.prefixes || []);
    } catch (error) {
      console.error("Object listing failed:", error);
    } finally {
      setObjectsLoading(false);
    }
  }, []);

  // ── Navigation handlers ──────────────────────────────────────

  const openBucket = (bucketName: string) => {
    setActiveBucket(bucketName);
    setPrefix("");
    setSearch("");
    setView("objects");
    loadObjects(bucketName, "");
  };

  const navigateToPrefix = (newPrefix: string) => {
    setPrefix(newPrefix);
    setSearch("");
    loadObjects(activeBucket!, newPrefix);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (view === "buckets") {
      streamBuckets();
    } else {
      loadObjects(activeBucket!, prefix).finally(() => setRefreshing(false));
    }
  };

  // ── Preview ──────────────────────────────────────────────────

  const openPreview = async (object: StorageObject) => {
    setPreviewObject(object);
    try {
      const stat = await ApiService.statStorageObject(
        activeBucket!,
        object.name,
      );
      setPreviewStat(stat);
    } catch {
      setPreviewStat(null);
    }
  };

  const closePreview = () => {
    setPreviewObject(null);
    setPreviewStat(null);
  };

  // ── Delete ───────────────────────────────────────────────────

  const handleDelete = async (object: StorageObject) => {
    if (!confirm(`Delete "${object.name}"?`)) return;
    try {
      await ApiService.deleteStorageObject(activeBucket!, object.name);
      loadObjects(activeBucket!, prefix);
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  // ── Global file search (debounced) ──────────────────────────

  const executeGlobalSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setGlobalSearchResults([]);
      setGlobalSearchLoading(false);
      setIsGlobalSearchActive(false);
      setGlobalSearchTotalScanned(0);
      setGlobalSearchTruncated(false);
      return;
    }

    setGlobalSearchLoading(true);
    setIsGlobalSearchActive(true);
    try {
      const response = await ApiService.searchStorageObjects(query, { limit: 200 });
      setGlobalSearchResults(response.results || []);
      setGlobalSearchTotalScanned(response.totalScanned || 0);
      setGlobalSearchTruncated(response.truncated || false);
    } catch (error) {
      console.error("Global search failed:", error);
      setGlobalSearchResults([]);
    } finally {
      setGlobalSearchLoading(false);
    }
  }, []);

  const handleGlobalSearchChange = useCallback((value: string) => {
    setGlobalSearchQuery(value);

    if (globalSearchTimerRef.current) {
      clearTimeout(globalSearchTimerRef.current);
    }

    if (value.length < 2) {
      setGlobalSearchResults([]);
      setIsGlobalSearchActive(false);
      setGlobalSearchLoading(false);
      return;
    }

    setGlobalSearchLoading(true);
    globalSearchTimerRef.current = setTimeout(() => {
      executeGlobalSearch(value);
    }, 400);
  }, [executeGlobalSearch]);

  const navigateToSearchResult = useCallback((result: StorageSearchResult) => {
    const pathParts = result.name.split("/");
    const resultPrefix = pathParts.length > 1 ? pathParts.slice(0, -1).join("/") + "/" : "";

    setActiveBucket(result.bucket);
    setPrefix(resultPrefix);
    setSearch("");
    setView("objects");
    setGlobalSearchQuery("");
    setGlobalSearchResults([]);
    setIsGlobalSearchActive(false);
    loadObjects(result.bucket, resultPrefix);
  }, [loadObjects]);

  // ── Filter objects by search ─────────────────────────────────

  const filteredObjects = useMemo(() => {
    if (!search) return objects;
    const normalizedSearch = search.toLowerCase();
    return objects.filter((object) => {
      const name = displayName(object.name, prefix).toLowerCase();
      return name.includes(normalizedSearch);
    });
  }, [objects, search, prefix]);

  const filteredPrefixes = useMemo(() => {
    if (!search) return prefixes;
    const normalizedSearch = search.toLowerCase();
    return prefixes.filter((property) =>
      folderLabel(property, prefix).toLowerCase().includes(normalizedSearch),
    );
  }, [prefixes, search, prefix]);

  // ── Breadcrumb path segments ─────────────────────────────────

  const breadcrumbSegments = useMemo(() => {
    const segments: { label: string; prefix: string | null }[] = [
      { label: "Buckets", prefix: null },
    ];
    if (activeBucket) {
      segments.push({ label: activeBucket, prefix: "" });
      if (prefix) {
        const parts = prefix.replace(/\/$/, "").split("/");
        let accumulated = "";
        for (const part of parts) {
          accumulated += part + "/";
          segments.push({ label: part, prefix: accumulated });
        }
      }
    }
    return segments;
  }, [activeBucket, prefix]);

  // ── Total size of current listing ────────────────────────────

  const totalSize = useMemo(() => {
    return objects.reduce((sum, object) => sum + (object.size || 0), 0);
  }, [objects]);

  const totalBucketSize = useMemo(() => {
    return buckets.reduce((sum, b) => sum + (b.totalSize || 0), 0);
  }, [buckets]);

  const totalBucketObjects = useMemo(() => {
    return buckets.reduce((sum, b) => sum + (b.objectCount || 0), 0);
  }, [buckets]);

  // ── Disk usage donut segments ─────────────────────────────────
  const diskSegments = useMemo(() => {
    if (!systemInfo?.disk) return [];
    const diskUsage = systemInfo.disk;
    return [
      {
        value: diskUsage.images.totalSize,
        color: DISK_COLORS.images,
        label: "Images",
      },
      {
        value: diskUsage.volumes.totalSize,
        color: DISK_COLORS.volumes,
        label: "Volumes",
      },
      {
        value: diskUsage.buildCache.totalSize,
        color: DISK_COLORS.buildCache,
        label: "Build Cache",
      },
      {
        value: diskUsage.containers.totalWritableSize,
        color: DISK_COLORS.containers,
        label: "Containers",
      },
    ].filter((s) => s.value > 0);
  }, [systemInfo]);

  // ── Bucket donut segments ─────────────────────────────────────
  const bucketSegments = useMemo(() => {
    if (!storageSummary?.buckets) return [];
    return storageSummary.buckets
      .filter((bucket) => bucket.totalSize > 0)
      .sort((firstBucket, secondBucket) => secondBucket.totalSize - firstBucket.totalSize)
      .map((bucket, i) => ({
        value: bucket.totalSize,
        color: BUCKET_COLORS[i % BUCKET_COLORS.length],
        label: bucket.name,
        objectCount: bucket.objectCount,
      }));
  }, [storageSummary]);

  const maxBucketSize =
    bucketSegments.length > 0
      ? Math.max(...bucketSegments.map((s) => s.value))
      : 0;

  // ── Subtitle helper ──────────────────────────────────────────
  const subtitle = useMemo(() => {
    if (view !== "buckets") {
      return `${activeBucket} — ${objects.length} objects · ${formatBytes(totalSize)}`;
    }
    if (streaming && buckets.length === 0) {
      return "Discovering MinIO buckets…";
    }
    if (streaming) {
      return `${buckets.length}/${totalExpected} buckets loaded · ${totalBucketObjects.toLocaleString()} objects · ${formatBytes(totalBucketSize)}`;
    }
    return `${buckets.length} buckets · ${totalBucketObjects.toLocaleString()} objects · ${formatBytes(totalBucketSize)}`;
  }, [
    view,
    streaming,
    buckets.length,
    totalExpected,
    totalBucketObjects,
    totalBucketSize,
    activeBucket,
    objects.length,
    totalSize,
  ]);

  return (
    <div className={styles['storage']}>
      <PageHeaderComponent
        sticky={false}
        title="Object Store"
        subtitle={subtitle}
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

      {/* ── Storage Overview ────────────────────────────────────── */}
      {view === "buckets" && (
        <div className={styles['overview-section']}>
          {overviewLoading ? (
            <LoadingIndicatorComponent
              size="small"
              label="Querying storage…"
              className="is-loading-centered-state"
            />
          ) : (
            <div className={styles['storage-grid']}>
              {/* ── MinIO Buckets ── */}
              {storageSummary && bucketSegments.length > 0 && (
                <div className={styles['storage-panel']}>
                  <div className={styles['storage-panel-header']}>
                    <Database
                      size={15}
                      strokeWidth={2.2}
                      className={styles['storage-panel-icon']}
                    />
                    <span className={styles['storage-panel-title']}>
                      MinIO Object Storage
                    </span>
                    <span className={styles['storage-panel-meta']}>
                      {storageSummary.totalObjects?.toLocaleString()} objects
                    </span>
                  </div>

                  <div className={styles['storage-panel-body']}>
                    <DonutChart
                      segments={bucketSegments}
                      size={130}
                      strokeWidth={16}
                    />
                    <div className={styles['storage-legend']}>
                      {bucketSegments.map((segment, i) => (
                        <div key={i} className={styles['legend-item']}>
                          <UsageBar
                            value={segment.value}
                            max={maxBucketSize}
                            color={segment.color}
                            label={segment.label}
                            sublabel={`${segment.objectCount.toLocaleString()} objects`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Docker Disk Usage ── */}
              {systemInfo?.disk && (
                <div className={styles['storage-panel']}>
                  <div className={styles['storage-panel-header']}>
                    <Layers
                      size={15}
                      strokeWidth={2.2}
                      className={styles['storage-panel-icon']}
                    />
                    <span className={styles['storage-panel-title']}>
                      Docker Disk Usage
                    </span>
                    <span className={styles['storage-panel-meta']}>
                      v{systemInfo.serverVersion}
                    </span>
                  </div>

                  <div className={styles['storage-panel-body']}>
                    <DonutChart
                      segments={diskSegments}
                      size={130}
                      strokeWidth={16}
                    />
                    <div className={styles['storage-legend']}>
                      <UsageBar
                        value={systemInfo.disk.images.totalSize}
                        max={systemInfo.disk.totalReclaimable}
                        color={DISK_COLORS.images}
                        label="Images"
                        sublabel={`${systemInfo.disk.images.count} images`}
                      />
                      <UsageBar
                        value={systemInfo.disk.volumes.totalSize}
                        max={systemInfo.disk.totalReclaimable}
                        color={DISK_COLORS.volumes}
                        label="Volumes"
                        sublabel={`${systemInfo.disk.volumes.count} volumes`}
                      />
                      <UsageBar
                        value={systemInfo.disk.buildCache.totalSize}
                        max={systemInfo.disk.totalReclaimable}
                        color={DISK_COLORS.buildCache}
                        label="Build Cache"
                        sublabel={`${systemInfo.disk.buildCache.count} layers`}
                      />
                      <UsageBar
                        value={systemInfo.disk.containers.totalWritableSize}
                        max={systemInfo.disk.totalReclaimable}
                        color={DISK_COLORS.containers}
                        label="Container Layers"
                        sublabel={`${systemInfo.disk.containers.count} containers`}
                      />
                    </div>
                  </div>

                  {/* ── Top Images ── */}
                  {(systemInfo.disk.images.items?.length ?? 0) > 0 && (
                    <div className={styles['image-list']}>
                      <div className={styles['image-list-header']}>
                        <Package size={12} strokeWidth={2.2} />
                        <span>Largest Images</span>
                      </div>
                      {(systemInfo.disk.images.items ?? [])
                        .slice(0, 8)
                        .map((image, i) => {
                          const tag = image.tags?.[0] || image.id || "unknown";
                          const displayTag =
                            tag.length > 50 ? `…${tag.slice(-48)}` : tag;
                          return (
                            <div key={i} className={styles['image-row']}>
                              <Box
                                size={12}
                                strokeWidth={1.8}
                                className={styles['image-icon']}
                              />
                              <span className={styles['image-name']} title={tag}>
                                {displayTag}
                              </span>
                              <span className={styles['image-size']}>
                                {formatBytes(image.size)}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* ── Volumes ── */}
                  {(systemInfo.disk.volumes.items?.length ?? 0) > 0 && (
                    <div className={styles['image-list']}>
                      <div className={styles['image-list-header']}>
                        <HardDrive size={12} strokeWidth={2.2} />
                        <span>Volumes</span>
                      </div>
                      {(systemInfo.disk.volumes.items ?? [])
                        .slice(0, 8)
                        .map((vol, i) => {
                          const volName = vol.name || "unknown";
                          const name =
                            volName.length > 40
                              ? `${volName.slice(0, 12)}…${volName.slice(-24)}`
                              : volName;
                          return (
                            <div key={i} className={styles['image-row']}>
                              <Database
                                size={12}
                                strokeWidth={1.8}
                                className={styles['image-icon']}
                              />
                              <span
                                className={styles['image-name']}
                                title={vol.name}
                              >
                                {name}
                              </span>
                              <span className={styles['image-size']}>
                                {formatBytes(vol.size)}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Breadcrumb Navigation ── */}
      {view === "objects" && (
        <div className={styles['breadcrumb']}>
          <div className={styles['breadcrumb-path']}>
            {breadcrumbSegments.map((seg, index) => {
              const isLast = index === breadcrumbSegments.length - 1;
              return (
                <span
                  key={index}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  {index > 0 && (
                    <ChevronRight size={12} className={styles['breadcrumb-sep']} />
                  )}
                  <button
                    className={`${styles['breadcrumb-item']} ${isLast ? styles['is-active-state'] : ""}`}
                    onClick={() => {
                      if (seg.prefix === null) {
                        setView("buckets");
                        setActiveBucket(null);
                      } else {
                        navigateToPrefix(seg.prefix);
                      }
                    }}
                  >
                    {index === 0 && <Database size={13} />}
                    {index === 1 && <HardDrive size={13} />}
                    {index > 1 && <Folder size={13} />}
                    {seg.label}
                  </button>
                </span>
              );
            })}
          </div>

          {/* ── View Mode Toggle ── */}
          <div className={styles['view-toggle']}>
            <SegmentedControlComponent
              value={objectViewMode}
              onChange={(value: string) => setObjectViewMode(value as "table" | "grid")}
              segments={[
                { value: "table", icon: <Table2 size={13} strokeWidth={2.2} /> },
                { value: "grid", icon: <LayoutGrid size={13} strokeWidth={2.2} /> },
              ]}
              compact
            />
          </div>
        </div>
      )}

      {/* ── Global File Search ── */}
      {view === "buckets" && (
        <div className={styles['global-search-section']}>
          <SearchInputComponent
            value={globalSearchQuery}
            onChange={handleGlobalSearchChange}
            placeholder="Search files across all stores…"
            compact
          />
        </div>
      )}

      {/* ── Global Search Results ── */}
      {view === "buckets" && isGlobalSearchActive && (
        <GlobalSearchResultsView
          results={globalSearchResults}
          isLoading={globalSearchLoading}
          query={globalSearchQuery}
          totalScanned={globalSearchTotalScanned}
          truncated={globalSearchTruncated}
          onResultClick={navigateToSearchResult}
        />
      )}

      {/* ── Bucket Views (Progressive) ── */}
      {view === "buckets" && !isGlobalSearchActive && (
        <>
          {/* ── Bucket View Mode Toggle ── */}
          <div className={styles['bucket-view-bar']}>
            <SegmentedControlComponent
              value={bucketViewMode}
              onChange={(value: string) => setBucketViewMode(value as "cards" | "table")}
              segments={[
                { value: "cards", icon: <LayoutGrid size={13} strokeWidth={2.2} /> },
                { value: "table", icon: <Table2 size={13} strokeWidth={2.2} /> },
              ]}
              compact
            />
          </div>

          {!streaming && buckets.length === 0 ? (
            <div className={styles['empty-state']}>
              <HardDrive size={48} />
              <span>No buckets found</span>
            </div>
          ) : bucketViewMode === "table" ? (
            /* ── Bucket Table View ── */
            <BucketTableView
              buckets={buckets}
              skeletonCount={skeletonCount}
              openBucket={openBucket}
            />
          ) : (
            /* ── Bucket Card Grid View ── */
            <div className={styles['bucket-grid']}>
              {/* ── Populated bucket cards ── */}
              {buckets.map((bucket, index) => (
                <div
                  key={bucket.name}
                  className={styles['bucket-card']}
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => openBucket(bucket.name)}
                >
                  <div className={styles['bucket-card-inner']}>
                    <div className={styles['bucket-header']}>
                      <div className={styles['bucket-icon-wrap']}>
                        <HardDrive size={18} strokeWidth={1.8} />
                      </div>
                      <span className={styles['bucket-name']}>{bucket.name}</span>
                    </div>
                    <div className={styles['bucket-meta']}>
                      <div className={styles['bucket-stat']}>
                        <span className={styles['bucket-stat-label']}>Objects</span>
                        <span className={styles['bucket-stat-value']}>
                          {bucket.objectCount.toLocaleString()}
                        </span>
                      </div>
                      <div className={styles['bucket-stat']}>
                        <span className={styles['bucket-stat-label']}>Size</span>
                        <span className={styles['bucket-stat-value']}>
                          {formatBytes(bucket.totalSize)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {bucket.creationDate && (
                    <div className={styles['bucket-date']}>
                      Created{" "}
                      {new Date(bucket.creationDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}

              {/* ── Skeleton placeholder cards for remaining buckets ── */}
              {Array.from({ length: skeletonCount }, (_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className={`${styles['bucket-card']} ${styles['bucket-card-skeleton']}`}
                  style={{ animationDelay: `${(buckets.length + i) * 50}ms` }}
                >
                  <div className={styles['bucket-card-inner']}>
                    <div className={styles['bucket-header']}>
                      <div
                        className={`${styles['bucket-icon-wrap']} ${styles['skeleton-icon']}`}
                      >
                        <HardDrive size={18} strokeWidth={1.8} />
                      </div>
                      <div
                        className={styles['skeleton-line']}
                        style={{ width: "60%" }}
                      />
                    </div>
                    <div className={styles['bucket-meta']}>
                      <div className={styles['bucket-stat']}>
                        <span className={styles['bucket-stat-label']}>Objects</span>
                        <div
                          className={styles['skeleton-line']}
                          style={{ width: 48 }}
                        />
                      </div>
                      <div className={styles['bucket-stat']}>
                        <span className={styles['bucket-stat-label']}>Size</span>
                        <div
                          className={styles['skeleton-line']}
                          style={{ width: 64 }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className={styles['bucket-date']}>
                    <div
                      className={styles['skeleton-line']}
                      style={{ width: "40%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Object Views ── */}
      {view === "objects" &&
        (objectsLoading ? (
          <LoadingIndicatorComponent
            size="small"
            label={`Loading ${activeBucket}…`}
            className="is-loading-centered-state"
          />
        ) : objectViewMode === "table" ? (
          /* ── Table View ── */
          <ObjectTableView
            objects={filteredObjects}
            prefixes={filteredPrefixes}
            prefix={prefix}
            activeBucket={activeBucket!}
            search={search}
            setSearch={setSearch}
            navigateToPrefix={navigateToPrefix}
            openPreview={openPreview}
            handleDelete={handleDelete}
          />
        ) : (
          /* ── Grid View ── */
          <ObjectGridView
            objects={filteredObjects}
            prefixes={filteredPrefixes}
            prefix={prefix}
            activeBucket={activeBucket!}
            search={search}
            setSearch={setSearch}
            navigateToPrefix={navigateToPrefix}
            openPreview={openPreview}
            handleDelete={handleDelete}
          />
        ))}

      {/* ── Preview Overlay ── */}
      {previewObject && (
        <PreviewOverlay
          bucketName={activeBucket!}
          object={previewObject}
          stat={previewStat}
          onClose={closePreview}
        />
      )}
    </div>
  );
}

// ── Object Table View ────────────────────────────────────────────

function ObjectTableView({
  objects,
  prefixes,
  prefix,
  activeBucket,
  search,
  setSearch,
  navigateToPrefix,
  openPreview,
  handleDelete,
}: {
  objects: StorageObject[];
  prefixes: string[];
  prefix: string;
  activeBucket: string;
  search: string;
  setSearch: (val: string) => void;
  navigateToPrefix: (targetPrefix: string) => void;
  openPreview: (storageObject: StorageObject) => void;
  handleDelete: (storageObject: StorageObject) => void;
}) {
  return (
    <div className={styles['object-list-container']}>
      <div className={styles['object-list-header']}>
        <span className={styles['object-list-title']}>
          {prefix ? displayName(prefix, "") : "Root"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={styles['total-size']}>
            {(prefixes.length + objects.length).toLocaleString()} items
          </span>
          <SearchInputComponent
            value={search}
            onChange={(value: string) => setSearch(value)}
            placeholder="Filter objects…"
            compact
          />
        </div>
      </div>

      {/* ── Column Headers ── */}
      <div className={styles['column-header']}>
        <span>Name</span>
        <span>Size</span>
        <span>Modified</span>
        <span style={{ textAlign: "right" }}>Actions</span>
      </div>

      {/* ── Folders ── */}
      {prefixes.map((pfx: string) => (
        <div
          key={pfx}
          className={`${styles['object-row']} ${styles['folder-row']}`}
          onClick={() => navigateToPrefix(pfx)}
        >
          <div className={styles['object-name']}>
            <Folder size={16} className={styles['object-icon']} />
            <span className={styles['object-name-text']}>
              {folderLabel(pfx, prefix)}
            </span>
          </div>
          <span className={styles['object-size']}>—</span>
          <span className={styles['object-date']}>—</span>
          <div className={styles['object-actions']} />
        </div>
      ))}

      {/* ── Objects ── */}
      {objects.map((object: StorageObject, index: number) => {
        const FileIcon = getFileIcon(object.name);
        const canPreview = isPreviewable(object.name);
        const hasThumb = isImage(object.name);
        return (
          <div
            key={object.name}
            className={styles['object-row']}
            style={{ animationDelay: `${index * 20}ms` }}
          >
            <div className={styles['object-name']}>
              {hasThumb ? (
                <img
                  className={styles['table-thumb']}
                  src={ApiService.buildStorageDownloadUrl(
                    activeBucket,
                    object.name,
                    { inline: true },
                  )}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <FileIcon size={16} className={styles['object-icon']} />
              )}
              <span className={styles['object-name-text']}>
                {displayName(object.name, prefix)}
              </span>
            </div>
            <span className={styles['object-size']}>
              {formatBytes(object.size)}
            </span>
            <span className={styles['object-date']}>
              {object.lastModified
                ? new Date(object.lastModified).toLocaleString()
                : "—"}
            </span>
            <div className={styles['object-actions']}>
              {canPreview && (
                <IconButtonComponent
                  icon={<Eye size={15} />}
                  tooltip="Preview"
                  onClick={() => openPreview(object)}
                />
              )}
              <IconButtonComponent
                icon={<Download size={15} />}
                tooltip="Download"
                onClick={(event) => {
                  event.stopPropagation();
                  triggerDownload(
                    ApiService.buildStorageDownloadUrl(activeBucket, object.name),
                  );
                }}
              />
              <IconButtonComponent
                icon={<Trash2 size={15} />}
                tooltip="Delete"
                variant="destructive"
                onClick={() => handleDelete(object)}
              />
            </div>
          </div>
        );
      })}

      {/* ── Empty State ── */}
      {prefixes.length === 0 && objects.length === 0 && (
        <div className={styles['empty-state']}>
          <Folder size={36} />
          <span>{search ? "No matches found" : "This folder is empty"}</span>
        </div>
      )}
    </div>
  );
}

// ── Bucket Table View ────────────────────────────────────────────

function BucketTableView({
  buckets,
  skeletonCount,
  openBucket,
}: {
  buckets: StorageBucket[];
  skeletonCount: number;
  openBucket: (b: string) => void;
}) {
  return (
    <div className={styles['object-list-container']}>
      {/* ── Column Headers ── */}
      <div className={styles['bucket-column-header']}>
        <span>Bucket</span>
        <span>Objects</span>
        <span>Size</span>
        <span>Created</span>
      </div>

      {/* ── Bucket Rows ── */}
      {buckets.map((bucket, index) => (
        <div
          key={bucket.name}
          className={`${styles['object-row']} ${styles['folder-row']}`}
          style={{ animationDelay: `${index * 30}ms` }}
          onClick={() => openBucket(bucket.name)}
        >
          <div className={styles['object-name']}>
            <div className={styles['bucket-row-icon']}>
              <HardDrive size={15} strokeWidth={1.8} />
            </div>
            <span className={styles['object-name-text']}>{bucket.name}</span>
          </div>
          <span className={styles['object-size']}>
            {bucket.objectCount.toLocaleString()}
          </span>
          <span className={styles['object-size']}>
            {formatBytes(bucket.totalSize)}
          </span>
          <span className={styles['object-date']}>
            {bucket.creationDate
              ? new Date(bucket.creationDate).toLocaleDateString()
              : "—"}
          </span>
        </div>
      ))}

      {/* ── Skeleton Rows ── */}
      {Array.from({ length: skeletonCount }, (_, i) => (
        <div
          key={`skeleton-row-${i}`}
          className={`${styles['object-row']} ${styles['bucket-skeleton-row']}`}
          style={{ animationDelay: `${(buckets.length + i) * 30}ms` }}
        >
          <div className={styles['object-name']}>
            <div className={`${styles['bucket-row-icon']} ${styles['skeleton-icon']}`}>
              <HardDrive size={15} strokeWidth={1.8} />
            </div>
            <div className={styles['skeleton-line']} style={{ width: "45%" }} />
          </div>
          <div className={styles['object-size']}>
            <div className={styles['skeleton-line']} style={{ width: 40 }} />
          </div>
          <div className={styles['object-size']}>
            <div className={styles['skeleton-line']} style={{ width: 56 }} />
          </div>
          <div className={styles['object-date']}>
            <div className={styles['skeleton-line']} style={{ width: 72 }} />
          </div>
        </div>
      ))}

      {/* ── Empty State ── */}
      {buckets.length === 0 && skeletonCount === 0 && (
        <div className={styles['empty-state']}>
          <HardDrive size={36} />
          <span>No buckets found</span>
        </div>
      )}
    </div>
  );
}

// ── Object Grid View ─────────────────────────────────────────────

function ObjectGridView({
  objects,
  prefixes,
  prefix,
  activeBucket,
  search,
  setSearch,
  navigateToPrefix,
  openPreview,
  handleDelete,
}: {
  objects: StorageObject[];
  prefixes: string[];
  prefix: string;
  activeBucket: string;
  search: string;
  setSearch: (val: string) => void;
  navigateToPrefix: (targetPrefix: string) => void;
  openPreview: (storageObject: StorageObject) => void;
  handleDelete: (storageObject: StorageObject) => void;
}) {
  return (
    <>
      {/* ── Header Bar ── */}
      <div className={styles['grid-header']}>
        <span className={styles['object-list-title']}>
          {prefix ? displayName(prefix, "") : "Root"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={styles['total-size']}>
            {(prefixes.length + objects.length).toLocaleString()} items
          </span>
          <SearchInputComponent
            value={search}
            onChange={(value: string) => setSearch(value)}
            placeholder="Filter objects…"
            compact
          />
        </div>
      </div>

      <div className={styles['object-grid']}>
        {/* ── Folders ── */}
        {prefixes.map((pfx) => (
          <div
            key={pfx}
            className={`${styles['grid-card']} ${styles['grid-card-folder']}`}
            onClick={() => navigateToPrefix(pfx)}
          >
            <div className={styles['grid-card-thumb']}>
              <Folder size={36} />
            </div>
            <div className={styles['grid-card-info']}>
              <span className={styles['grid-card-name']}>
                {folderLabel(pfx, prefix)}
              </span>
            </div>
          </div>
        ))}

        {/* ── Objects ── */}
        {objects.map((object, index) => {
          const FileIcon = getFileIcon(object.name);
          const hasThumb = isImage(object.name);
          const canPreview = isPreviewable(object.name);
          return (
            <div
              key={object.name}
              className={styles['grid-card']}
              style={{ animationDelay: `${index * 30}ms` }}
              onClick={() => (canPreview ? openPreview(object) : undefined)}
            >
              <div className={styles['grid-card-thumb']}>
                {hasThumb ? (
                  <img
                    className={styles['grid-thumb-img']}
                    src={ApiService.buildStorageDownloadUrl(
                      activeBucket!,
                      object.name,
                      { inline: true },
                    )}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <FileIcon size={36} />
                )}
              </div>
              <div className={styles['grid-card-info']}>
                <span
                  className={styles['grid-card-name']}
                  title={displayName(object.name, prefix)}
                >
                  {displayName(object.name, prefix)}
                </span>
                <span className={styles['grid-card-meta']}>
                  {formatBytes(object.size)}
                </span>
              </div>
              <div className={styles['grid-card-actions']}>
                <IconButtonComponent
                  icon={<Download size={14} />}
                  tooltip="Download"
                  className={styles['grid-action-button']}
                  onClick={(event) => {
                    event.stopPropagation();
                    triggerDownload(
                      ApiService.buildStorageDownloadUrl(activeBucket, object.name),
                    );
                  }}
                />
                <IconButtonComponent
                  icon={<Trash2 size={14} />}
                  tooltip="Delete"
                  variant="destructive"
                  className={`${styles['grid-action-button']} ${styles['grid-action-button-danger']}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDelete(object);
                  }}
                />
              </div>
            </div>
          );
        })}

        {/* ── Empty State ── */}
        {prefixes.length === 0 && objects.length === 0 && (
          <div className={styles['empty-state']} style={{ gridColumn: "1 / -1" }}>
            <Folder size={36} />
            <span>{search ? "No matches found" : "This folder is empty"}</span>
          </div>
        )}
      </div>
    </>
  );
}

// ── Global Search Results ─────────────────────────────────────────

function GlobalSearchResultsView({
  results,
  isLoading,
  query,
  totalScanned,
  truncated,
  onResultClick,
}: {
  results: StorageSearchResult[];
  isLoading: boolean;
  query: string;
  totalScanned: number;
  truncated: boolean;
  onResultClick: (result: StorageSearchResult) => void;
}) {
  if (isLoading) {
    return (
      <div className={styles['global-search-results-container']}>
        <LoadingIndicatorComponent
          size="small"
          label={`Searching across all stores…`}
          className="is-loading-centered-state"
        />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className={styles['global-search-results-container']}>
        <div className={styles['global-search-empty-state']}>
          <SearchX size={36} />
          <span>No files matching &ldquo;{query}&rdquo;</span>
          <span className={styles['global-search-empty-subtext']}>
            Searched {totalScanned.toLocaleString()} objects across all stores
          </span>
        </div>
      </div>
    );
  }

  const bucketGroups = results.reduce<Record<string, StorageSearchResult[]>>(
    (groups, result) => {
      if (!groups[result.bucket]) groups[result.bucket] = [];
      groups[result.bucket].push(result);
      return groups;
    },
    {},
  );

  return (
    <div className={styles['global-search-results-container']}>
      <div className={styles['global-search-results-header']}>
        <span className={styles['global-search-results-title']}>
          <Search size={14} />
          {results.length.toLocaleString()} results
          {truncated && "+"} for &ldquo;{query}&rdquo;
        </span>
        <span className={styles['global-search-results-meta']}>
          {totalScanned.toLocaleString()} objects scanned
          {truncated && " · results truncated"}
        </span>
      </div>

      {Object.entries(bucketGroups).map(([bucketName, bucketResults]) => (
        <div key={bucketName} className={styles['global-search-bucket-group']}>
          <div className={styles['global-search-bucket-label']}>
            <HardDrive size={13} strokeWidth={2} />
            <span>{bucketName}</span>
            <span className={styles['global-search-bucket-count']}>
              {bucketResults.length}
            </span>
          </div>

          {bucketResults.map((result, index) => {
            const FileIcon = getFileIcon(result.name);
            const fileName = result.name.split("/").pop() || result.name;
            const filePath = result.name.includes("/")
              ? result.name.slice(0, result.name.lastIndexOf("/") + 1)
              : "";

            return (
              <div
                key={result.name}
                className={styles['global-search-result-row']}
                style={{ animationDelay: `${index * 20}ms` }}
                onClick={() => onResultClick(result)}
              >
                <div className={styles['global-search-result-name']}>
                  <FileIcon size={15} className={styles['global-search-file-icon']} />
                  <span className={styles['global-search-file-name']}>
                    {fileName}
                  </span>
                  {filePath && (
                    <span className={styles['global-search-file-path']}>
                      {filePath}
                    </span>
                  )}
                </div>
                <span className={styles['object-size']}>
                  {formatBytes(result.size)}
                </span>
                <span className={styles['object-date']}>
                  {result.lastModified
                    ? new Date(result.lastModified).toLocaleDateString()
                    : "—"}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Preview Modal ────────────────────────────────────────────────

function PreviewOverlay({
  bucketName,
  object,
  stat,
  onClose,
}: {
  bucketName: string;
  object: StorageObject;
  stat: StorageObject | null;
  onClose: () => void;
}) {
  const mediaType = getMediaType(object.name);
  const downloadUrl = ApiService.buildStorageDownloadUrl(
    bucketName,
    object.name,
    { inline: true },
  );
  const filename = object.name.split("/").pop();

  return (
    <ModalComponent
      title={filename || object.name}
      onClose={onClose}
      size="xl"
      className="storage-component"
      footer={
        <ButtonComponent
          variant="secondary"
          icon={Download}
          href={ApiService.buildStorageDownloadUrl(bucketName, object.name)}
        >
          Download
        </ButtonComponent>
      }
    >
      <div className={styles['preview-body']}>
        {mediaType === "image" && (
          <img
            className={styles['preview-image']}
            src={downloadUrl}
            alt={filename}
          />
        )}
        {mediaType === "audio" && (
          <audio className={styles['preview-audio']} controls src={downloadUrl} />
        )}
        {mediaType === "video" && (
          <video
            className={styles['preview-video']}
            controls
            playsInline
            preload="metadata"
            src={downloadUrl}
          />
        )}
        {!mediaType && (
          <div className={styles['preview-fallback']}>
            <File size={48} />
            <span>No preview available for this file type</span>
          </div>
        )}

        {/* ── Metadata Grid ── */}
        <div className={styles['preview-meta']}>
          <span className={styles['preview-meta-label']}>Key</span>
          <span className={styles['preview-meta-value']}>{object.name}</span>
          <span className={styles['preview-meta-label']}>Size</span>
          <span className={styles['preview-meta-value']}>
            {formatBytes(stat?.size ?? object.size)}
          </span>
          {stat?.contentType && (
            <>
              <span className={styles['preview-meta-label']}>Type</span>
              <span className={styles['preview-meta-value']}>
                {stat.contentType}
              </span>
            </>
          )}
          {stat?.etag && (
            <>
              <span className={styles['preview-meta-label']}>ETag</span>
              <span className={styles['preview-meta-value']}>{stat.etag}</span>
            </>
          )}
          {(stat?.lastModified || object.lastModified) && (
            <>
              <span className={styles['preview-meta-label']}>Modified</span>
              <span className={styles['preview-meta-value']}>
                {new Date(
                  stat?.lastModified ||
                    object.lastModified ||
                    new Date().toISOString(),
                ).toLocaleString()}
              </span>
            </>
          )}
        </div>
      </div>
    </ModalComponent>
  );
}
