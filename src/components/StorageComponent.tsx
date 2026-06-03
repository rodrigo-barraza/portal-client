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
  X,
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

  let accumulated = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={styles.donut}
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
      {segments.map((segment, i) => {
        const percentage = total > 0 ? segment.value / total : 0;
        const dashLength = percentage * circumference;
        const dashOffset = -(accumulated / total) * circumference;
        accumulated += segment.value;

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
            className={styles.donutSegment}
            style={{ animationDelay: `${i * 100}ms` }}
          />
        );
      })}
      {/* Center text */}
      <text
        x={center}
        y={center - 4}
        textAnchor="middle"
        className={styles.donutTotal}
      >
        {formatBytes(total)}
      </text>
      <text
        x={center}
        y={center + 12}
        textAnchor="middle"
        className={styles.donutLabel}
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
    <div className={styles.usageBarRow}>
      <div className={styles.usageBarInfo}>
        <span className={styles.usageBarLabel}>{label}</span>
        <span className={styles.usageBarValue}>
          {formatBytes(value)}
          {sublabel && (
            <span className={styles.usageBarSub}> · {sublabel}</span>
          )}
        </span>
      </div>
      <div className={styles.usageBarTrack}>
        <div
          className={styles.usageBarFill}
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
  const [previousStateiewObject, setPreviewObject] = useState<StorageObject | null>(
    null,
  );
  const [previousStateiewStat, setPreviewStat] = useState<StorageObject | null>(null);

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
    return () => streamRef.current?.close();
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
    <div className={styles.storage}>
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
        <div className={styles.overviewSection}>
          {overviewLoading ? (
            <LoadingIndicatorComponent
              size="small"
              label="Querying storage…"
              className="is-loading-centered-state"
            />
          ) : (
            <div className={styles.storageGrid}>
              {/* ── MinIO Buckets ── */}
              {storageSummary && bucketSegments.length > 0 && (
                <div className={styles.storagePanel}>
                  <div className={styles.storagePanelHeader}>
                    <Database
                      size={15}
                      strokeWidth={2.2}
                      className={styles.storagePanelIcon}
                    />
                    <span className={styles.storagePanelTitle}>
                      MinIO Object Storage
                    </span>
                    <span className={styles.storagePanelMeta}>
                      {storageSummary.totalObjects?.toLocaleString()} objects
                    </span>
                  </div>

                  <div className={styles.storagePanelBody}>
                    <DonutChart
                      segments={bucketSegments}
                      size={130}
                      strokeWidth={16}
                    />
                    <div className={styles.storageLegend}>
                      {bucketSegments.map((segment, i) => (
                        <div key={i} className={styles.legendItem}>
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
                <div className={styles.storagePanel}>
                  <div className={styles.storagePanelHeader}>
                    <Layers
                      size={15}
                      strokeWidth={2.2}
                      className={styles.storagePanelIcon}
                    />
                    <span className={styles.storagePanelTitle}>
                      Docker Disk Usage
                    </span>
                    <span className={styles.storagePanelMeta}>
                      v{systemInfo.serverVersion}
                    </span>
                  </div>

                  <div className={styles.storagePanelBody}>
                    <DonutChart
                      segments={diskSegments}
                      size={130}
                      strokeWidth={16}
                    />
                    <div className={styles.storageLegend}>
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
                    <div className={styles.imageList}>
                      <div className={styles.imageListHeader}>
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
                            <div key={i} className={styles.imageRow}>
                              <Box
                                size={12}
                                strokeWidth={1.8}
                                className={styles.imageIcon}
                              />
                              <span className={styles.imageName} title={tag}>
                                {displayTag}
                              </span>
                              <span className={styles.imageSize}>
                                {formatBytes(image.size)}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* ── Volumes ── */}
                  {(systemInfo.disk.volumes.items?.length ?? 0) > 0 && (
                    <div className={styles.imageList}>
                      <div className={styles.imageListHeader}>
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
                            <div key={i} className={styles.imageRow}>
                              <Database
                                size={12}
                                strokeWidth={1.8}
                                className={styles.imageIcon}
                              />
                              <span
                                className={styles.imageName}
                                title={vol.name}
                              >
                                {name}
                              </span>
                              <span className={styles.imageSize}>
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
        <div className={styles.breadcrumb}>
          <div className={styles.breadcrumbPath}>
            {breadcrumbSegments.map((seg, index) => {
              const isLast = index === breadcrumbSegments.length - 1;
              return (
                <span
                  key={index}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  {index > 0 && (
                    <ChevronRight size={12} className={styles.breadcrumbSep} />
                  )}
                  <button
                    className={`${styles.breadcrumbItem} ${isLast ? styles.isActiveState : ""}`}
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
          <div className={styles.viewToggle}>
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
        <div className={styles.globalSearchSection}>
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
          <div className={styles.bucketViewBar}>
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
            <div className={styles.emptyState}>
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
            <div className={styles.bucketGrid}>
              {/* ── Populated bucket cards ── */}
              {buckets.map((bucket, index) => (
                <div
                  key={bucket.name}
                  className={styles.bucketCard}
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => openBucket(bucket.name)}
                >
                  <div className={styles.bucketCardInner}>
                    <div className={styles.bucketHeader}>
                      <div className={styles.bucketIconWrap}>
                        <HardDrive size={18} strokeWidth={1.8} />
                      </div>
                      <span className={styles.bucketName}>{bucket.name}</span>
                    </div>
                    <div className={styles.bucketMeta}>
                      <div className={styles.bucketStat}>
                        <span className={styles.bucketStatLabel}>Objects</span>
                        <span className={styles.bucketStatValue}>
                          {bucket.objectCount.toLocaleString()}
                        </span>
                      </div>
                      <div className={styles.bucketStat}>
                        <span className={styles.bucketStatLabel}>Size</span>
                        <span className={styles.bucketStatValue}>
                          {formatBytes(bucket.totalSize)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {bucket.creationDate && (
                    <div className={styles.bucketDate}>
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
                  className={`${styles.bucketCard} ${styles.bucketCardSkeleton}`}
                  style={{ animationDelay: `${(buckets.length + i) * 50}ms` }}
                >
                  <div className={styles.bucketCardInner}>
                    <div className={styles.bucketHeader}>
                      <div
                        className={`${styles.bucketIconWrap} ${styles.skeletonIcon}`}
                      >
                        <HardDrive size={18} strokeWidth={1.8} />
                      </div>
                      <div
                        className={styles.skeletonLine}
                        style={{ width: "60%" }}
                      />
                    </div>
                    <div className={styles.bucketMeta}>
                      <div className={styles.bucketStat}>
                        <span className={styles.bucketStatLabel}>Objects</span>
                        <div
                          className={styles.skeletonLine}
                          style={{ width: 48 }}
                        />
                      </div>
                      <div className={styles.bucketStat}>
                        <span className={styles.bucketStatLabel}>Size</span>
                        <div
                          className={styles.skeletonLine}
                          style={{ width: 64 }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className={styles.bucketDate}>
                    <div
                      className={styles.skeletonLine}
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
      {previousStateiewObject && (
        <PreviewOverlay
          bucketName={activeBucket!}
          object={previousStateiewObject}
          stat={previousStateiewStat}
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
    <div className={styles.objectListContainer}>
      <div className={styles.objectListHeader}>
        <span className={styles.objectListTitle}>
          {prefix ? displayName(prefix, "") : "Root"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={styles.totalSize}>
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
      <div className={styles.columnHeader}>
        <span>Name</span>
        <span>Size</span>
        <span>Modified</span>
        <span style={{ textAlign: "right" }}>Actions</span>
      </div>

      {/* ── Folders ── */}
      {prefixes.map((pfx: string) => (
        <div
          key={pfx}
          className={`${styles.objectRow} ${styles.folderRow}`}
          onClick={() => navigateToPrefix(pfx)}
        >
          <div className={styles.objectName}>
            <Folder size={16} className={styles.objectIcon} />
            <span className={styles.objectNameText}>
              {folderLabel(pfx, prefix)}
            </span>
          </div>
          <span className={styles.objectSize}>—</span>
          <span className={styles.objectDate}>—</span>
          <div className={styles.objectActions} />
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
            className={styles.objectRow}
            style={{ animationDelay: `${index * 20}ms` }}
          >
            <div className={styles.objectName}>
              {hasThumb ? (
                <img
                  className={styles.tableThumb}
                  src={ApiService.buildStorageDownloadUrl(
                    activeBucket,
                    object.name,
                    { inline: true },
                  )}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <FileIcon size={16} className={styles.objectIcon} />
              )}
              <span className={styles.objectNameText}>
                {displayName(object.name, prefix)}
              </span>
            </div>
            <span className={styles.objectSize}>
              {formatBytes(object.size)}
            </span>
            <span className={styles.objectDate}>
              {object.lastModified
                ? new Date(object.lastModified).toLocaleString()
                : "—"}
            </span>
            <div className={styles.objectActions}>
              {canPreview && (
                <IconButtonComponent
                  icon={<Eye size={15} />}
                  tooltip="Preview"
                  onClick={() => openPreview(object)}
                />
              )}
              <a
                className={styles.actionButton}
                title="Download"
                href={ApiService.buildStorageDownloadUrl(
                  activeBucket,
                  object.name,
                )}
                download
                onClick={(e) => e.stopPropagation()}
              >
                <Download size={15} />
              </a>
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
        <div className={styles.emptyState}>
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
    <div className={styles.objectListContainer}>
      {/* ── Column Headers ── */}
      <div className={styles.bucketColumnHeader}>
        <span>Bucket</span>
        <span>Objects</span>
        <span>Size</span>
        <span>Created</span>
      </div>

      {/* ── Bucket Rows ── */}
      {buckets.map((bucket, index) => (
        <div
          key={bucket.name}
          className={`${styles.objectRow} ${styles.folderRow}`}
          style={{ animationDelay: `${index * 30}ms` }}
          onClick={() => openBucket(bucket.name)}
        >
          <div className={styles.objectName}>
            <div className={styles.bucketRowIcon}>
              <HardDrive size={15} strokeWidth={1.8} />
            </div>
            <span className={styles.objectNameText}>{bucket.name}</span>
          </div>
          <span className={styles.objectSize}>
            {bucket.objectCount.toLocaleString()}
          </span>
          <span className={styles.objectSize}>
            {formatBytes(bucket.totalSize)}
          </span>
          <span className={styles.objectDate}>
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
          className={`${styles.objectRow} ${styles.bucketSkeletonRow}`}
          style={{ animationDelay: `${(buckets.length + i) * 30}ms` }}
        >
          <div className={styles.objectName}>
            <div className={`${styles.bucketRowIcon} ${styles.skeletonIcon}`}>
              <HardDrive size={15} strokeWidth={1.8} />
            </div>
            <div className={styles.skeletonLine} style={{ width: "45%" }} />
          </div>
          <div className={styles.objectSize}>
            <div className={styles.skeletonLine} style={{ width: 40 }} />
          </div>
          <div className={styles.objectSize}>
            <div className={styles.skeletonLine} style={{ width: 56 }} />
          </div>
          <div className={styles.objectDate}>
            <div className={styles.skeletonLine} style={{ width: 72 }} />
          </div>
        </div>
      ))}

      {/* ── Empty State ── */}
      {buckets.length === 0 && skeletonCount === 0 && (
        <div className={styles.emptyState}>
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
      <div className={styles.gridHeader}>
        <span className={styles.objectListTitle}>
          {prefix ? displayName(prefix, "") : "Root"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={styles.totalSize}>
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

      <div className={styles.objectGrid}>
        {/* ── Folders ── */}
        {prefixes.map((pfx) => (
          <div
            key={pfx}
            className={`${styles.gridCard} ${styles.gridCardFolder}`}
            onClick={() => navigateToPrefix(pfx)}
          >
            <div className={styles.gridCardThumb}>
              <Folder size={36} />
            </div>
            <div className={styles.gridCardInfo}>
              <span className={styles.gridCardName}>
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
              className={styles.gridCard}
              style={{ animationDelay: `${index * 30}ms` }}
              onClick={() => (canPreview ? openPreview(object) : undefined)}
            >
              <div className={styles.gridCardThumb}>
                {hasThumb ? (
                  <img
                    className={styles.gridThumbImg}
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
              <div className={styles.gridCardInfo}>
                <span
                  className={styles.gridCardName}
                  title={displayName(object.name, prefix)}
                >
                  {displayName(object.name, prefix)}
                </span>
                <span className={styles.gridCardMeta}>
                  {formatBytes(object.size)}
                </span>
              </div>
              <div className={styles.gridCardActions}>
                <a
                  className={styles.actionButton}
                  title="Download"
                  href={ApiService.buildStorageDownloadUrl(
                    activeBucket,
                    object.name,
                  )}
                  download
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={14} />
                </a>
                <button
                  className={`${styles.actionButton} ${styles.danger}`}
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(object);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}

        {/* ── Empty State ── */}
        {prefixes.length === 0 && objects.length === 0 && (
          <div className={styles.emptyState} style={{ gridColumn: "1 / -1" }}>
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
      <div className={styles.globalSearchResultsContainer}>
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
      <div className={styles.globalSearchResultsContainer}>
        <div className={styles.globalSearchEmptyState}>
          <SearchX size={36} />
          <span>No files matching "{query}"</span>
          <span className={styles.globalSearchEmptySubtext}>
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
    <div className={styles.globalSearchResultsContainer}>
      <div className={styles.globalSearchResultsHeader}>
        <span className={styles.globalSearchResultsTitle}>
          <Search size={14} />
          {results.length.toLocaleString()} results
          {truncated && "+"} for "{query}"
        </span>
        <span className={styles.globalSearchResultsMeta}>
          {totalScanned.toLocaleString()} objects scanned
          {truncated && " · results truncated"}
        </span>
      </div>

      {Object.entries(bucketGroups).map(([bucketName, bucketResults]) => (
        <div key={bucketName} className={styles.globalSearchBucketGroup}>
          <div className={styles.globalSearchBucketLabel}>
            <HardDrive size={13} strokeWidth={2} />
            <span>{bucketName}</span>
            <span className={styles.globalSearchBucketCount}>
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
                className={styles.globalSearchResultRow}
                style={{ animationDelay: `${index * 20}ms` }}
                onClick={() => onResultClick(result)}
              >
                <div className={styles.globalSearchResultName}>
                  <FileIcon size={15} className={styles.globalSearchFileIcon} />
                  <span className={styles.globalSearchFileName}>
                    {fileName}
                  </span>
                  {filePath && (
                    <span className={styles.globalSearchFilePath}>
                      {filePath}
                    </span>
                  )}
                </div>
                <span className={styles.objectSize}>
                  {formatBytes(result.size)}
                </span>
                <span className={styles.objectDate}>
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

// ── Preview Overlay ──────────────────────────────────────────────

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

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className={styles.previousStateiewOverlay} onClick={onClose}>
      <div className={styles.previousStateiewPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.previousStateiewHeader}>
          <span className={styles.previousStateiewTitle}>{filename}</span>
          <button className={styles.previousStateiewCloseButton} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.previousStateiewBody}>
          {mediaType === "image" && (
            <img
              className={styles.previousStateiewImage}
              src={downloadUrl}
              alt={filename}
            />
          )}
          {mediaType === "audio" && (
            <audio className={styles.previousStateiewAudio} controls src={downloadUrl} />
          )}
          {mediaType === "video" && (
            <video className={styles.previousStateiewVideo} controls src={downloadUrl} />
          )}
          {!mediaType && (
            <div className={styles.previousStateiewFallback}>
              <File size={48} />
              <span>No previousStateiew available for this file type</span>
            </div>
          )}

          {/* ── Metadata Grid ── */}
          <div className={styles.previousStateiewMeta}>
            <span className={styles.previousStateiewMetaLabel}>Key</span>
            <span className={styles.previousStateiewMetaValue}>{object.name}</span>
            <span className={styles.previousStateiewMetaLabel}>Size</span>
            <span className={styles.previousStateiewMetaValue}>
              {formatBytes(stat?.size ?? object.size)}
            </span>
            {stat?.contentType && (
              <>
                <span className={styles.previousStateiewMetaLabel}>Type</span>
                <span className={styles.previousStateiewMetaValue}>
                  {stat.contentType}
                </span>
              </>
            )}
            {stat?.etag && (
              <>
                <span className={styles.previousStateiewMetaLabel}>ETag</span>
                <span className={styles.previousStateiewMetaValue}>{stat.etag}</span>
              </>
            )}
            {(stat?.lastModified || object.lastModified) && (
              <>
                <span className={styles.previousStateiewMetaLabel}>Modified</span>
                <span className={styles.previousStateiewMetaValue}>
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

        <div className={styles.previousStateiewFooter}>
          <ButtonComponent
            variant="secondary"
            icon={Download}
            href={ApiService.buildStorageDownloadUrl(bucketName, object.name)}
          >
            Download
          </ButtonComponent>
        </div>
      </div>
    </div>
  );
}
