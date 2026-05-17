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
} from "lucide-react";
import {
  ButtonComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
} from "@rodrigo-barraza/components-library";
import { formatBytes } from "@rodrigo-barraza/utilities-library";

import ApiService from "../services/ApiService";
import styles from "./StorageComponent.module.css";

// ── File type helpers ────────────────────────────────────────────

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mkv", ".mov", ".avi"]);
const TEXT_EXTS = new Set([".txt", ".md", ".csv", ".log", ".ini", ".yml", ".yaml", ".toml"]);
const CODE_EXTS = new Set([".js", ".ts", ".jsx", ".tsx", ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".css", ".html", ".json", ".xml", ".sh"]);
const ARCHIVE_EXTS = new Set([".zip", ".gz", ".tar", ".rar", ".7z", ".bz2", ".xz"]);

function getFileExt(name: any) {
  return (name || "").match(/\.[^.]+$/)?.[0]?.toLowerCase() || "";
}

function getFileIcon(name: any) {
  const ext = getFileExt(name);
  if (IMAGE_EXTS.has(ext)) return FileImage;
  if (AUDIO_EXTS.has(ext)) return FileAudio;
  if (VIDEO_EXTS.has(ext)) return FileVideo;
  if (TEXT_EXTS.has(ext)) return FileText;
  if (CODE_EXTS.has(ext)) return FileCode;
  if (ARCHIVE_EXTS.has(ext)) return FileArchive;
  return File;
}

function isImage(name: any) {
  return IMAGE_EXTS.has(getFileExt(name));
}

function isPreviewable(name: any) {
  const ext = getFileExt(name);
  return IMAGE_EXTS.has(ext) || AUDIO_EXTS.has(ext) || VIDEO_EXTS.has(ext);
}

function getMediaType(name: any) {
  const ext = getFileExt(name);
  if (IMAGE_EXTS.has(ext)) return "image";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (VIDEO_EXTS.has(ext)) return "video";
  return null;
}

/** Extract the display name from a full key — strip the prefix to show just the leaf. */
// @ts-ignore
function displayName(fullKey, prefix) {
  if (!prefix) return fullKey;
  return fullKey.startsWith(prefix) ? fullKey.slice(prefix.length) : fullKey;
}

/** Format a prefix as a folder label. */
// @ts-ignore
function folderLabel(prefix, currentPrefix) {
  const relative = currentPrefix ? prefix.slice(currentPrefix.length) : prefix;
  return relative.replace(/\/$/, "");
}

// ── Component ────────────────────────────────────────────────────

export default function StorageComponent() {
  const [view, setView] = useState("buckets"); // "buckets" | "objects"
  const [bucketViewMode, setBucketViewMode] = useState("cards"); // "cards" | "table"
  const [objectViewMode, setObjectViewMode] = useState("table"); // "table" | "grid"
  const [buckets, setBuckets] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const didFetch = useRef(false);
  const streamRef = useRef(null);

  // Progressive loading state
  const [streaming, setStreaming] = useState(true);
  const [totalExpected, setTotalExpected] = useState(0);
  const [skeletonCount, setSkeletonCount] = useState(0);

  // Object browser state
  const [activeBucket, setActiveBucket] = useState<any>(null);
  const [prefix, setPrefix] = useState("");
  const [objects, setObjects] = useState<any[]>([]);
  const [prefixes, setPrefixes] = useState<any[]>([]);
  const [objectsLoading, setObjectsLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Preview state
  const [previewObject, setPreviewObject] = useState<any>(null);
  const [previewStat, setPreviewStat] = useState<any>(null);

  // ── Progressive bucket streaming ────────────────────────────
  const streamBuckets = useCallback(() => {
    setStreaming(true);
    setBuckets([]);
    setTotalExpected(0);
    setSkeletonCount(0);

    // @ts-ignore
    streamRef.current?.close();
    // @ts-ignore
    streamRef.current = ApiService.streamStorageBuckets((event) => {
      switch (event.type) {
        case "init":
          setTotalExpected(event.totalBuckets);
          setSkeletonCount(event.totalBuckets);
          break;
        case "bucket":
          setBuckets((prev) => [...prev, event.bucket]);
          setSkeletonCount((prev) => Math.max(0, prev - 1));
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
    });
  }, []);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    streamBuckets();
    // @ts-ignore
    return () => streamRef.current?.close();
  }, [streamBuckets]);

  // ── Object listing ───────────────────────────────────────────
  // @ts-ignore
  const loadObjects = useCallback(async (bucket, pfx = "") => {
    setObjectsLoading(true);
    try {
      const res = await ApiService.getStorageObjects(bucket, { prefix: pfx });
      setObjects(res.objects || []);
      setPrefixes(res.prefixes || []);
    } catch (error) {
      console.error("Object listing failed:", error);
    } finally {
      setObjectsLoading(false);
    }
  }, []);

  // ── Navigation handlers ──────────────────────────────────────

  // @ts-ignore
  const openBucket = (bucketName) => {
    setActiveBucket(bucketName);
    setPrefix("");
    setSearch("");
    setView("objects");
    loadObjects(bucketName, "");
  };

  // @ts-ignore
  const navigateToPrefix = (newPrefix) => {
    setPrefix(newPrefix);
    setSearch("");
    loadObjects(activeBucket, newPrefix);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (view === "buckets") {
      streamBuckets();
    } else {
      loadObjects(activeBucket, prefix).finally(() => setRefreshing(false));
    }
  };

  // ── Preview ──────────────────────────────────────────────────

  // @ts-ignore
  const openPreview = async (object) => {
    setPreviewObject(object);
    try {
      const stat = await ApiService.statStorageObject(activeBucket, object.name);
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

  // @ts-ignore
  const handleDelete = async (object) => {
    if (!confirm(`Delete "${object.name}"?`)) return;
    try {
      await ApiService.deleteStorageObject(activeBucket, object.name);
      loadObjects(activeBucket, prefix);
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  // ── Filter objects by search ─────────────────────────────────

  const filteredObjects = useMemo(() => {
    if (!search) return objects;
    const q = search.toLowerCase();
    return objects.filter((object) => {
      const name = displayName(object.name, prefix).toLowerCase();
      return name.includes(q);
    });
  }, [objects, search, prefix]);

  const filteredPrefixes = useMemo(() => {
    if (!search) return prefixes;
    const q = search.toLowerCase();
    return prefixes.filter((p) => folderLabel(p, prefix).toLowerCase().includes(q));
  }, [prefixes, search, prefix]);

  // ── Breadcrumb path segments ─────────────────────────────────

  const breadcrumbSegments = useMemo(() => {
    const segments = [{ label: "Buckets", prefix: null }];
    if (activeBucket) {
      // @ts-ignore
      segments.push({ label: activeBucket, prefix: "" });
      if (prefix) {
        const parts = prefix.replace(/\/$/, "").split("/");
        let accumulated = "";
        for (const part of parts) {
          accumulated += part + "/";
          // @ts-ignore
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
  }, [view, streaming, buckets.length, totalExpected, totalBucketObjects, totalBucketSize, activeBucket, objects.length, totalSize]);

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

      {/* ── Breadcrumb Navigation ── */}
      {view === "objects" && (
        <div className={styles.breadcrumb}>
          <div className={styles.breadcrumbPath}>
            {breadcrumbSegments.map((seg, index) => {
              const isLast = index === breadcrumbSegments.length - 1;
              return (
                <span key={index} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {index > 0 && (
                    <ChevronRight size={12} className={styles.breadcrumbSep} />
                  )}
                  <button
                    className={`${styles.breadcrumbItem} ${isLast ? styles.active : ""}`}
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
            <div className={styles.segmentedControl}>
              <button
                className={`${styles.segmentBtn} ${objectViewMode === "table" ? styles.segmentActive : ""}`}
                onClick={() => setObjectViewMode("table")}
                title="Table view"
              >
                <Table2 size={13} strokeWidth={2.2} />
              </button>
              <button
                className={`${styles.segmentBtn} ${objectViewMode === "grid" ? styles.segmentActive : ""}`}
                onClick={() => setObjectViewMode("grid")}
                title="Grid view"
              >
                <LayoutGrid size={13} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bucket Views (Progressive) ── */}
      {view === "buckets" && (
        <>
          {/* ── Bucket View Mode Toggle ── */}
          <div className={styles.bucketViewBar}>
            <div className={styles.segmentedControl}>
              <button
                className={`${styles.segmentBtn} ${bucketViewMode === "cards" ? styles.segmentActive : ""}`}
                onClick={() => setBucketViewMode("cards")}
                title="Card view"
              >
                <LayoutGrid size={13} strokeWidth={2.2} />
              </button>
              <button
                className={`${styles.segmentBtn} ${bucketViewMode === "table" ? styles.segmentActive : ""}`}
                onClick={() => setBucketViewMode("table")}
                title="Table view"
              >
                <Table2 size={13} strokeWidth={2.2} />
              </button>
            </div>
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
              {buckets.map((bucket: any, index: any) => (
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
                      Created {new Date(bucket.creationDate).toLocaleDateString()}
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
                      <div className={`${styles.bucketIconWrap} ${styles.skeletonIcon}`}>
                        <HardDrive size={18} strokeWidth={1.8} />
                      </div>
                      <div className={styles.skeletonLine} style={{ width: "60%" }} />
                    </div>
                    <div className={styles.bucketMeta}>
                      <div className={styles.bucketStat}>
                        <span className={styles.bucketStatLabel}>Objects</span>
                        <div className={styles.skeletonLine} style={{ width: 48 }} />
                      </div>
                      <div className={styles.bucketStat}>
                        <span className={styles.bucketStatLabel}>Size</span>
                        <div className={styles.skeletonLine} style={{ width: 64 }} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.bucketDate}>
                    <div className={styles.skeletonLine} style={{ width: "40%" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Object Views ── */}
      {view === "objects" && (
        objectsLoading ? (
          <LoadingIndicatorComponent size="small" label={`Loading ${activeBucket}…`} className="loading-center" />
        ) : objectViewMode === "table" ? (
          /* ── Table View ── */
          <ObjectTableView
            objects={filteredObjects}
            prefixes={filteredPrefixes}
            prefix={prefix}
            activeBucket={activeBucket}
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
            activeBucket={activeBucket}
            search={search}
            setSearch={setSearch}
            navigateToPrefix={navigateToPrefix}
            openPreview={openPreview}
            handleDelete={handleDelete}
          />
        )
      )}

      {/* ── Preview Overlay ── */}
      {previewObject && (
        <PreviewOverlay
          bucketName={activeBucket}
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
  objects, prefixes, prefix, activeBucket,
  search, setSearch, navigateToPrefix, openPreview, handleDelete,
}: { [key: string]: any }) {
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
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Filter objects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
{/* @ts-ignore */}
{prefixes.map((pfx: any) => (
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
{/* @ts-ignore */}
{objects.map((object: any, index: any) => {
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
                  src={ApiService.buildStorageDownloadUrl(activeBucket, object.name, { inline: true })}
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
                <button
                  className={styles.actionBtn}
                  title="Preview"
                  onClick={() => openPreview(object)}
                >
                  <Eye size={15} />
                </button>
              )}
              <a
                className={styles.actionBtn}
                title="Download"
                href={ApiService.buildStorageDownloadUrl(activeBucket, object.name)}
                download
                onClick={(e) => e.stopPropagation()}
              >
                <Download size={15} />
              </a>
              <button
                className={`${styles.actionBtn} ${styles.danger}`}
                title="Delete"
                onClick={() => handleDelete(object)}
              >
                <Trash2 size={15} />
              </button>
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

function BucketTableView({ buckets, skeletonCount, openBucket }: { [key: string]: any }) {
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
{/* @ts-ignore */}
{buckets.map((bucket: any, index: any) => (
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
  objects, prefixes, prefix, activeBucket,
  search, setSearch, navigateToPrefix, openPreview, handleDelete,
}: { [key: string]: any }) {
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
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Filter objects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className={styles.objectGrid}>
        {/* ── Folders ── */}
{/* @ts-ignore */}
{prefixes.map((pfx: any) => (
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
{/* @ts-ignore */}
{objects.map((object: any, index: any) => {
          const FileIcon = getFileIcon(object.name);
          const hasThumb = isImage(object.name);
          const canPreview = isPreviewable(object.name);
          return (
            <div
              key={object.name}
              className={styles.gridCard}
              style={{ animationDelay: `${index * 30}ms` }}
              onClick={() => canPreview ? openPreview(object) : undefined}
            >
              <div className={styles.gridCardThumb}>
                {hasThumb ? (
                  <img
                    className={styles.gridThumbImg}
                    src={ApiService.buildStorageDownloadUrl(activeBucket, object.name, { inline: true })}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <FileIcon size={36} />
                )}
              </div>
              <div className={styles.gridCardInfo}>
                <span className={styles.gridCardName} title={displayName(object.name, prefix)}>
                  {displayName(object.name, prefix)}
                </span>
                <span className={styles.gridCardMeta}>
                  {formatBytes(object.size)}
                </span>
              </div>
              <div className={styles.gridCardActions}>
                <a
                  className={styles.actionBtn}
                  title="Download"
                  href={ApiService.buildStorageDownloadUrl(activeBucket, object.name)}
                  download
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={14} />
                </a>
                <button
                  className={`${styles.actionBtn} ${styles.danger}`}
                  title="Delete"
                  onClick={(e) => { e.stopPropagation(); handleDelete(object); }}
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

// ── Preview Overlay ──────────────────────────────────────────────

function PreviewOverlay({ bucketName, object, stat, onClose }: { [key: string]: any }) {
  const mediaType = getMediaType(object.name);
  const downloadUrl = ApiService.buildStorageDownloadUrl(bucketName, object.name, { inline: true });
  const filename = object.name.split("/").pop();

  // Close on Escape
  useEffect(() => {
    // @ts-ignore
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className={styles.previewOverlay} onClick={onClose}>
      <div className={styles.previewPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.previewHeader}>
          <span className={styles.previewTitle}>{filename}</span>
          <button className={styles.previewCloseBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.previewBody}>
          {mediaType === "image" && (
            <img
              className={styles.previewImage}
              src={downloadUrl}
              alt={filename}
            />
          )}
          {mediaType === "audio" && (
            <audio
              className={styles.previewAudio}
              controls
              src={downloadUrl}
            />
          )}
          {mediaType === "video" && (
            <video
              className={styles.previewVideo}
              controls
              src={downloadUrl}
            />
          )}
          {!mediaType && (
            <div className={styles.previewFallback}>
              <File size={48} />
              <span>No preview available for this file type</span>
            </div>
          )}

          {/* ── Metadata Grid ── */}
          <div className={styles.previewMeta}>
            <span className={styles.previewMetaLabel}>Key</span>
            <span className={styles.previewMetaValue}>{object.name}</span>
            <span className={styles.previewMetaLabel}>Size</span>
            <span className={styles.previewMetaValue}>
              {formatBytes(stat?.size ?? object.size)}
            </span>
            {stat?.contentType && (
              <>
                <span className={styles.previewMetaLabel}>Type</span>
                <span className={styles.previewMetaValue}>{stat.contentType}</span>
              </>
            )}
            {stat?.etag && (
              <>
                <span className={styles.previewMetaLabel}>ETag</span>
                <span className={styles.previewMetaValue}>{stat.etag}</span>
              </>
            )}
            {(stat?.lastModified || object.lastModified) && (
              <>
                <span className={styles.previewMetaLabel}>Modified</span>
                <span className={styles.previewMetaValue}>
                  {new Date(stat?.lastModified || object.lastModified).toLocaleString()}
                </span>
              </>
            )}
          </div>
        </div>

        <div className={styles.previewFooter}>
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
