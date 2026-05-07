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
} from "lucide-react";
import {
  ButtonComponent,
  LoadingStateComponent,
  PageHeaderComponent,
} from "@rodrigo-barraza/components-library";
import { formatFileSize } from "@rodrigo-barraza/utilities-library";

import ApiService from "../services/ApiService";
import styles from "./StorageComponent.module.css";

/** Format bytes with human-readable units. */
const formatBytes = (bytes) => formatFileSize(bytes);

// ── File type helpers ────────────────────────────────────────────

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mkv", ".mov", ".avi"]);
const TEXT_EXTS = new Set([".txt", ".md", ".csv", ".log", ".ini", ".yml", ".yaml", ".toml"]);
const CODE_EXTS = new Set([".js", ".ts", ".jsx", ".tsx", ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".css", ".html", ".json", ".xml", ".sh"]);
const ARCHIVE_EXTS = new Set([".zip", ".gz", ".tar", ".rar", ".7z", ".bz2", ".xz"]);

function getFileExt(name) {
  return (name || "").match(/\.[^.]+$/)?.[0]?.toLowerCase() || "";
}

function getFileIcon(name) {
  const ext = getFileExt(name);
  if (IMAGE_EXTS.has(ext)) return FileImage;
  if (AUDIO_EXTS.has(ext)) return FileAudio;
  if (VIDEO_EXTS.has(ext)) return FileVideo;
  if (TEXT_EXTS.has(ext)) return FileText;
  if (CODE_EXTS.has(ext)) return FileCode;
  if (ARCHIVE_EXTS.has(ext)) return FileArchive;
  return File;
}

function isPreviewable(name) {
  const ext = getFileExt(name);
  return IMAGE_EXTS.has(ext) || AUDIO_EXTS.has(ext) || VIDEO_EXTS.has(ext);
}

function getMediaType(name) {
  const ext = getFileExt(name);
  if (IMAGE_EXTS.has(ext)) return "image";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (VIDEO_EXTS.has(ext)) return "video";
  return null;
}

/** Extract the display name from a full key — strip the prefix to show just the leaf. */
function displayName(fullKey, prefix) {
  if (!prefix) return fullKey;
  return fullKey.startsWith(prefix) ? fullKey.slice(prefix.length) : fullKey;
}

/** Format a prefix as a folder label. */
function folderLabel(prefix, currentPrefix) {
  const relative = currentPrefix ? prefix.slice(currentPrefix.length) : prefix;
  return relative.replace(/\/$/, "");
}

// ── Component ────────────────────────────────────────────────────

export default function StorageComponent() {
  const [view, setView] = useState("buckets"); // "buckets" | "objects"
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const didFetch = useRef(false);

  // Object browser state
  const [activeBucket, setActiveBucket] = useState(null);
  const [prefix, setPrefix] = useState("");
  const [objects, setObjects] = useState([]);
  const [prefixes, setPrefixes] = useState([]);
  const [objectsLoading, setObjectsLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Preview state
  const [previewObject, setPreviewObject] = useState(null);
  const [previewStat, setPreviewStat] = useState(null);

  // ── Bucket listing ───────────────────────────────────────────
  const loadBuckets = useCallback(async () => {
    try {
      const res = await ApiService.getStorageBuckets();
      setBuckets(res.buckets || []);
    } catch (err) {
      console.error("Bucket listing failed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadBuckets();
  }, [loadBuckets]);

  // ── Object listing ───────────────────────────────────────────
  const loadObjects = useCallback(async (bucket, pfx = "") => {
    setObjectsLoading(true);
    try {
      const res = await ApiService.getStorageObjects(bucket, { prefix: pfx });
      setObjects(res.objects || []);
      setPrefixes(res.prefixes || []);
    } catch (err) {
      console.error("Object listing failed:", err);
    } finally {
      setObjectsLoading(false);
    }
  }, []);

  // ── Navigation handlers ──────────────────────────────────────

  const openBucket = (bucketName) => {
    setActiveBucket(bucketName);
    setPrefix("");
    setSearch("");
    setView("objects");
    loadObjects(bucketName, "");
  };

  const navigateToPrefix = (newPrefix) => {
    setPrefix(newPrefix);
    setSearch("");
    loadObjects(activeBucket, newPrefix);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (view === "buckets") {
      loadBuckets();
    } else {
      loadObjects(activeBucket, prefix).finally(() => setRefreshing(false));
    }
  };

  // ── Preview ──────────────────────────────────────────────────

  const openPreview = async (obj) => {
    setPreviewObject(obj);
    try {
      const stat = await ApiService.statStorageObject(activeBucket, obj.name);
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

  const handleDelete = async (obj) => {
    if (!confirm(`Delete "${obj.name}"?`)) return;
    try {
      await ApiService.deleteStorageObject(activeBucket, obj.name);
      loadObjects(activeBucket, prefix);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // ── Filter objects by search ─────────────────────────────────

  const filteredObjects = useMemo(() => {
    if (!search) return objects;
    const q = search.toLowerCase();
    return objects.filter((obj) => {
      const name = displayName(obj.name, prefix).toLowerCase();
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
    return objects.reduce((sum, obj) => sum + (obj.size || 0), 0);
  }, [objects]);

  const totalBucketSize = useMemo(() => {
    return buckets.reduce((sum, b) => sum + (b.totalSize || 0), 0);
  }, [buckets]);

  const totalBucketObjects = useMemo(() => {
    return buckets.reduce((sum, b) => sum + (b.objectCount || 0), 0);
  }, [buckets]);

  return (
    <div className={styles.storage}>
      <PageHeaderComponent
        sticky={false}
        title="Storage"
        subtitle={
          loading
            ? "Loading MinIO buckets…"
            : view === "buckets"
              ? `${buckets.length} buckets · ${totalBucketObjects.toLocaleString()} objects · ${formatBytes(totalBucketSize)}`
              : `${activeBucket} — ${objects.length} objects · ${formatBytes(totalSize)}`
        }
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
          {breadcrumbSegments.map((seg, idx) => {
            const isLast = idx === breadcrumbSegments.length - 1;
            return (
              <span key={idx} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {idx > 0 && (
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
                  {idx === 0 && <Database size={13} />}
                  {idx === 1 && <HardDrive size={13} />}
                  {idx > 1 && <Folder size={13} />}
                  {seg.label}
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* ── Bucket Grid View ── */}
      {view === "buckets" && (
        loading ? (
          <LoadingStateComponent message="Discovering buckets…" />
        ) : buckets.length === 0 ? (
          <div className={styles.emptyState}>
            <HardDrive size={48} />
            <span>No buckets found</span>
          </div>
        ) : (
          <div className={styles.bucketGrid}>
            {buckets.map((bucket, idx) => (
              <div
                key={bucket.name}
                className={styles.bucketCard}
                style={{ animationDelay: `${idx * 50}ms` }}
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
          </div>
        )
      )}

      {/* ── Object List View ── */}
      {view === "objects" && (
        objectsLoading ? (
          <LoadingStateComponent message={`Loading ${activeBucket}…`} />
        ) : (
          <div className={styles.objectListContainer}>
            <div className={styles.objectListHeader}>
              <span className={styles.objectListTitle}>
                {prefix ? displayName(prefix, "") : "Root"}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className={styles.totalSize}>
                  {(filteredPrefixes.length + filteredObjects.length).toLocaleString()} items
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
            {filteredPrefixes.map((pfx) => (
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
            {filteredObjects.map((obj, idx) => {
              const FileIcon = getFileIcon(obj.name);
              const canPreview = isPreviewable(obj.name);
              return (
                <div
                  key={obj.name}
                  className={styles.objectRow}
                  style={{ animationDelay: `${idx * 20}ms` }}
                >
                  <div className={styles.objectName}>
                    <FileIcon size={16} className={styles.objectIcon} />
                    <span className={styles.objectNameText}>
                      {displayName(obj.name, prefix)}
                    </span>
                  </div>
                  <span className={styles.objectSize}>
                    {formatBytes(obj.size)}
                  </span>
                  <span className={styles.objectDate}>
                    {obj.lastModified
                      ? new Date(obj.lastModified).toLocaleString()
                      : "—"}
                  </span>
                  <div className={styles.objectActions}>
                    {canPreview && (
                      <button
                        className={styles.actionBtn}
                        title="Preview"
                        onClick={() => openPreview(obj)}
                      >
                        <Eye size={15} />
                      </button>
                    )}
                    <a
                      className={styles.actionBtn}
                      title="Download"
                      href={ApiService.buildStorageDownloadUrl(activeBucket, obj.name)}
                      download
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download size={15} />
                    </a>
                    <button
                      className={`${styles.actionBtn} ${styles.danger}`}
                      title="Delete"
                      onClick={() => handleDelete(obj)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* ── Empty State ── */}
            {filteredPrefixes.length === 0 && filteredObjects.length === 0 && (
              <div className={styles.emptyState}>
                <Folder size={36} />
                <span>{search ? "No matches found" : "This folder is empty"}</span>
              </div>
            )}
          </div>
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

// ── Preview Overlay ──────────────────────────────────────────────

function PreviewOverlay({ bucketName, object, stat, onClose }) {
  const mediaType = getMediaType(object.name);
  const downloadUrl = ApiService.buildStorageDownloadUrl(bucketName, object.name, { inline: true });
  const filename = object.name.split("/").pop();

  // Close on Escape
  useEffect(() => {
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
