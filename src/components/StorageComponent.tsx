"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Database,
  Folder,
  HardDrive,
  LayoutGrid,
  RefreshCw,
  Table2,
} from "lucide-react";
import {
  ButtonComponent,
  EmptyStateComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
  SearchInputComponent,
  SegmentedControlComponent,
} from "@rodrigo-barraza/components-library";
import { formatBytes, getErrorMessage } from "@rodrigo-barraza/utilities-library";

import ApiService from "../services/ApiService";
import type { StorageObject, StorageSearchResult } from "../types/portal";
import { BucketCardGrid, BucketTableView } from "./storage/BucketViews";
import { GlobalSearchResults } from "./storage/GlobalSearchResults";
import { DeleteObjectDialog, PreviewModal } from "./storage/ObjectDialogs";
import { ObjectGridView, ObjectTableView } from "./storage/ObjectViews";
import { StorageOverview } from "./storage/StorageOverview";
import { buildBreadcrumbs, filterListing, splitObjectKey } from "./storage/storageFiles";
import {
  useBucketStream,
  useGlobalSearch,
  useObjectListing,
  useObjectStat,
  useStorageOverview,
  type ObjectLocation,
} from "./storage/storageHooks";
import { summarizeBuckets } from "./storage/storageOverview";
import styles from "./StorageComponent.module.css";

type BucketViewMode = "cards" | "table";
type ObjectViewMode = "table" | "grid";

const BUCKET_VIEW_SEGMENTS = [
  { value: "cards", icon: <LayoutGrid size={13} strokeWidth={2.2} /> },
  { value: "table", icon: <Table2 size={13} strokeWidth={2.2} /> },
];

const OBJECT_VIEW_SEGMENTS = [
  { value: "table", icon: <Table2 size={13} strokeWidth={2.2} /> },
  { value: "grid", icon: <LayoutGrid size={13} strokeWidth={2.2} /> },
];

const BREADCRUMB_ICONS = [Database, HardDrive];

export default function StorageComponent() {
  // null = the bucket list; otherwise the bucket/prefix being browsed
  const [location, setLocation] = useState<ObjectLocation | null>(null);
  const [bucketViewMode, setBucketViewMode] = useState<BucketViewMode>("cards");
  const [objectViewMode, setObjectViewMode] = useState<ObjectViewMode>("table");
  const [filter, setFilter] = useState("");
  const [previewObject, setPreviewObject] = useState<StorageObject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StorageObject | null>(null);
  const [deleteState, setDeleteState] = useState<{ pending: boolean; error: string | null }>({
    pending: false,
    error: null,
  });

  const bucketStream = useBucketStream();
  const overview = useStorageOverview();
  const listing = useObjectListing(location);
  const search = useGlobalSearch();
  const previewStat = useObjectStat(location?.bucket ?? null, previewObject?.name ?? null);

  const bucketTotals = useMemo(() => summarizeBuckets(bucketStream.buckets), [bucketStream.buckets]);
  const listingBytes = useMemo(
    () => listing.objects.reduce((sum, object) => sum + (object.size || 0), 0),
    [listing.objects],
  );
  const visible = useMemo(
    () => filterListing(listing.objects, listing.prefixes, filter, location?.prefix ?? ""),
    [listing.objects, listing.prefixes, filter, location?.prefix],
  );
  const breadcrumbs = useMemo(
    () => buildBreadcrumbs(location?.bucket ?? null, location?.prefix ?? ""),
    [location],
  );

  // ── Navigation ──────────────────────────────────────────────
  const navigate = useCallback((next: ObjectLocation | null) => {
    setLocation(next);
    setFilter("");
  }, []);

  const openBucket = useCallback(
    (bucketName: string) => navigate({ bucket: bucketName, prefix: "" }),
    [navigate],
  );

  const openFolder = useCallback((folderPrefix: string) => {
    setLocation((current) => (current ? { ...current, prefix: folderPrefix } : current));
    setFilter("");
  }, []);

  const clearSearch = search.setQuery;
  const openSearchResult = useCallback(
    (result: StorageSearchResult) => {
      navigate({ bucket: result.bucket, prefix: splitObjectKey(result.name).folderPath });
      clearSearch("");
    },
    [navigate, clearSearch],
  );

  const handleRefresh = () => {
    if (location) {
      listing.reload();
    } else {
      bucketStream.refresh();
      overview.reload();
    }
  };

  // ── Delete ──────────────────────────────────────────────────
  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteState({ pending: false, error: null });
  };

  const confirmDelete = async () => {
    if (!location || !deleteTarget) return;
    setDeleteState({ pending: true, error: null });
    try {
      await ApiService.deleteStorageObject(location.bucket, deleteTarget.name);
      closeDeleteDialog();
      listing.reload();
    } catch (error) {
      setDeleteState({ pending: false, error: getErrorMessage(error) });
    }
  };

  // ── Header ──────────────────────────────────────────────────
  let subtitle: string;
  if (location) {
    subtitle = listing.isLoading
      ? `${location.bucket} — loading…`
      : `${location.bucket} — ${listing.objects.length.toLocaleString()} objects · ${formatBytes(listingBytes)}`;
  } else if (bucketStream.streaming && bucketStream.buckets.length === 0) {
    subtitle = "Discovering MinIO buckets…";
  } else {
    const loaded = bucketStream.streaming
      ? `${bucketStream.buckets.length}/${bucketStream.totalExpected} buckets loaded`
      : `${bucketStream.buckets.length} buckets`;
    subtitle = `${loaded} · ${bucketTotals.objects.toLocaleString()} objects · ${formatBytes(bucketTotals.bytes)}`;
  }

  const isRefreshing = location ? listing.isReloading : bucketStream.refreshing;

  const objectViewProps = location && {
    bucket: location.bucket,
    prefix: location.prefix,
    objects: visible.objects,
    prefixes: visible.prefixes,
    search: filter,
    onSearchChange: setFilter,
    onOpenFolder: openFolder,
    onPreview: setPreviewObject,
    onDelete: setDeleteTarget,
  };

  return (
    <div className={styles["storage"]}>
      <PageHeaderComponent sticky={false} title="Object Store" subtitle={subtitle}>
        <ButtonComponent variant="secondary" icon={RefreshCw} loading={isRefreshing} onClick={handleRefresh}>
          Refresh
        </ButtonComponent>
      </PageHeaderComponent>

      {!location && (
        <>
          <div className={styles["overview-section"]}>
            {overview.loading ? (
              <LoadingIndicatorComponent
                size="small"
                label="Querying storage…"
                className="is-loading-centered-state"
              />
            ) : (
              <StorageOverview summary={overview.summary} dockerHosts={overview.dockerHosts} />
            )}
          </div>

          <div className={styles["global-search-section"]}>
            <SearchInputComponent
              value={search.query}
              onChange={search.setQuery}
              placeholder="Search files across all stores…"
              compact
            />
          </div>

          {search.isActive ? (
            <GlobalSearchResults
              query={search.query.trim()}
              results={search.results}
              isLoading={search.isLoading}
              error={search.error}
              totalScanned={search.totalScanned}
              truncated={search.truncated}
              onResultClick={openSearchResult}
            />
          ) : (
            <>
              <div className={styles["bucket-view-bar"]}>
                <SegmentedControlComponent
                  value={bucketViewMode}
                  onChange={(value: string) => setBucketViewMode(value as BucketViewMode)}
                  segments={BUCKET_VIEW_SEGMENTS}
                  compact
                />
              </div>

              {!bucketStream.streaming && bucketStream.buckets.length === 0 ? (
                bucketStream.error ? (
                  <EmptyStateComponent
                    icon={<AlertTriangle size={40} strokeWidth={1.5} />}
                    title="Couldn't list buckets"
                    subtitle={bucketStream.error}
                  >
                    <ButtonComponent variant="secondary" icon={RefreshCw} onClick={handleRefresh}>
                      Retry
                    </ButtonComponent>
                  </EmptyStateComponent>
                ) : (
                  <div className={styles["empty-state"]}>
                    <HardDrive size={48} />
                    <span>No buckets found</span>
                  </div>
                )
              ) : (
                <>
                  {bucketStream.error && (
                    <p className={styles["inline-error"]} role="alert">
                      <AlertTriangle size={14} /> Bucket stats incomplete — {bucketStream.error}
                    </p>
                  )}
                  {bucketViewMode === "table" ? (
                    <BucketTableView
                      buckets={bucketStream.buckets}
                      skeletonCount={bucketStream.skeletonCount}
                      streaming={bucketStream.streaming}
                      onOpen={openBucket}
                    />
                  ) : (
                    <BucketCardGrid
                      buckets={bucketStream.buckets}
                      skeletonCount={bucketStream.skeletonCount}
                      streaming={bucketStream.streaming}
                      onOpen={openBucket}
                    />
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      {location && objectViewProps && (
        <>
          <div className={styles["breadcrumb"]}>
            <nav className={styles["breadcrumb-path"]} aria-label="Object path">
              {breadcrumbs.map((segment, index) => {
                const isLast = index === breadcrumbs.length - 1;
                const Icon = BREADCRUMB_ICONS[index] ?? Folder;
                return (
                  <span key={segment.prefix ?? "buckets"} className={styles["breadcrumb-segment"]}>
                    {index > 0 && <ChevronRight size={12} className={styles["breadcrumb-sep"]} />}
                    <button
                      type="button"
                      className={`${styles["breadcrumb-item"]}${isLast ? ` ${styles["is-active-state"]}` : ""}`}
                      aria-current={isLast ? "location" : undefined}
                      onClick={() =>
                        segment.prefix === null
                          ? navigate(null)
                          : navigate({ bucket: location.bucket, prefix: segment.prefix })
                      }
                    >
                      <Icon size={13} />
                      {segment.label}
                    </button>
                  </span>
                );
              })}
            </nav>

            <div className={styles["view-toggle"]}>
              <SegmentedControlComponent
                value={objectViewMode}
                onChange={(value: string) => setObjectViewMode(value as ObjectViewMode)}
                segments={OBJECT_VIEW_SEGMENTS}
                compact
              />
            </div>
          </div>

          {listing.isLoading ? (
            <LoadingIndicatorComponent
              size="small"
              label={`Loading ${location.bucket}…`}
              className="is-loading-centered-state"
            />
          ) : listing.error ? (
            <EmptyStateComponent
              icon={<AlertTriangle size={40} strokeWidth={1.5} />}
              title="Couldn't list this folder"
              subtitle={listing.error}
            >
              <ButtonComponent variant="secondary" icon={RefreshCw} onClick={listing.reload}>
                Retry
              </ButtonComponent>
            </EmptyStateComponent>
          ) : objectViewMode === "table" ? (
            <ObjectTableView {...objectViewProps} />
          ) : (
            <ObjectGridView {...objectViewProps} />
          )}

          {previewObject && (
            <PreviewModal
              bucket={location.bucket}
              object={previewObject}
              stat={previewStat}
              onClose={() => setPreviewObject(null)}
            />
          )}

          <DeleteObjectDialog
            bucket={location.bucket}
            object={deleteTarget}
            isDeleting={deleteState.pending}
            error={deleteState.error}
            onConfirm={confirmDelete}
            onClose={closeDeleteDialog}
          />
        </>
      )}
    </div>
  );
}
