"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@rodrigo-barraza/utilities-library";
import ApiService from "../../services/ApiService";
import type {
  BucketStreamEvent,
  StorageBucket,
  StorageObject,
  StorageSearchResponse,
  StorageSearchResult,
  StorageSummary,
} from "../../types/portal";
import useAsyncData from "../analytics/useAsyncData";
import { normalizeDockerHosts, type DockerHostInfo } from "./storageOverview";

// ── Bucket stream ────────────────────────────────────────────────

interface BucketStreamState {
  buckets: StorageBucket[];
  totalExpected: number;
  /** Placeholder cards for an older service that doesn't list names up front. */
  skeletonCount: number;
  streaming: boolean;
  refreshing: boolean;
  error: string | null;
}

const STREAM_START: BucketStreamState = {
  buckets: [],
  totalExpected: 0,
  skeletonCount: 0,
  streaming: true,
  refreshing: false,
  error: null,
};

function reduceStreamEvent(state: BucketStreamState, event: BucketStreamEvent): BucketStreamState {
  switch (event.type) {
    case "init":
      // Names + dates arrive up front — every card renders now and its
      // stats fill in as `bucket` events land. An older service sends
      // only the count, so placeholders stand in until each bucket lands.
      return event.buckets?.length
        ? { ...state, totalExpected: event.totalBuckets || 0, buckets: event.buckets, skeletonCount: 0 }
        : { ...state, totalExpected: event.totalBuckets || 0, skeletonCount: event.totalBuckets || 0 };
    case "bucket": {
      const incoming = event.bucket;
      if (!incoming) return state;
      const index = state.buckets.findIndex((bucket) => bucket.name === incoming.name);
      const buckets =
        index === -1
          ? [...state.buckets, incoming]
          : state.buckets.map((bucket, position) => (position === index ? incoming : bucket));
      return { ...state, buckets, skeletonCount: Math.max(0, state.skeletonCount - 1) };
    }
    case "done":
      return { ...state, streaming: false, refreshing: false, skeletonCount: 0 };
    case "error":
      return {
        ...state,
        streaming: false,
        refreshing: false,
        skeletonCount: 0,
        error: event.message || "Bucket stream failed",
      };
  }
}

/** Progressive bucket listing over SSE; the stream closes on unmount and on refresh. */
export function useBucketStream() {
  const [state, setState] = useState<BucketStreamState>(STREAM_START);
  const streamRef = useRef<{ close: () => void } | null>(null);

  const open = useCallback(() => {
    streamRef.current?.close();
    const handle = ApiService.streamStorageBuckets((event: BucketStreamEvent) => {
      // A superseded stream's queued events must not touch the new listing
      if (streamRef.current !== handle) return;
      setState((previous) => reduceStreamEvent(previous, event));
    });
    streamRef.current = handle;
  }, []);

  useEffect(() => {
    open();
    return () => {
      streamRef.current?.close();
      streamRef.current = null;
    };
  }, [open]);

  const refresh = useCallback(() => {
    setState({ ...STREAM_START, refreshing: true });
    open();
  }, [open]);

  return { ...state, refresh };
}

// ── Overview (MinIO summary + Docker disk usage) ─────────────────

const NO_DOCKER_HOSTS: DockerHostInfo[] = [];

export function useStorageOverview() {
  const overview = useAsyncData<{ summary: StorageSummary | null; dockerHosts: DockerHostInfo[] }>(
    "storage-overview",
    async (signal) => {
      // Each source degrades on its own — one failing never hides the other
      const [systemResponse, summary] = await Promise.all([
        ApiService.getSystemInfo(undefined, { signal }).catch(() => null),
        ApiService.getStorageSummary({ signal }).catch(() => null),
      ]);
      return { summary, dockerHosts: normalizeDockerHosts(systemResponse) };
    },
  );

  return {
    summary: overview.data?.summary ?? null,
    dockerHosts: overview.data?.dockerHosts ?? NO_DOCKER_HOSTS,
    loading: overview.loading,
    reload: overview.reload,
  };
}

// ── Object listing ───────────────────────────────────────────────

export interface ObjectLocation {
  bucket: string;
  prefix: string;
}

const locationKey = (location: ObjectLocation) => `${location.bucket}\u0000${location.prefix}`;
const NO_OBJECTS: StorageObject[] = [];
const NO_PREFIXES: string[] = [];

/**
 * Objects and sub-folders at a bucket/prefix. Navigating away aborts the
 * in-flight listing, so a slow one can never land under a newer
 * breadcrumb. `reload()` refetches in place (keeping rows on screen); a
 * failed listing shows no rows, only its error.
 */
export function useObjectListing(location: ObjectLocation | null) {
  const listing = useAsyncData<{ objects: StorageObject[]; prefixes: string[] }>(
    location ? locationKey(location) : null,
    (signal) =>
      ApiService.getStorageObjects(location?.bucket ?? "", { prefix: location?.prefix ?? "" }, { signal }),
  );
  const failed = listing.error !== null;

  return {
    objects: failed ? NO_OBJECTS : (listing.data?.objects ?? NO_OBJECTS),
    prefixes: failed ? NO_PREFIXES : (listing.data?.prefixes ?? NO_PREFIXES),
    error: listing.error ? getErrorMessage(listing.error) : null,
    isLoading: listing.loading,
    isReloading: listing.reloading,
    reload: listing.reload,
  };
}

// ── Global search ────────────────────────────────────────────────

export const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 400;

interface SearchOutcome extends StorageSearchResponse {
  query: string;
  error: string | null;
}

/** Debounced search across every bucket; only the latest query's answer is shown. */
export function useGlobalSearch() {
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const trimmed = query.trim();
  const isActive = trimmed.length >= MIN_SEARCH_LENGTH;

  useEffect(() => {
    if (trimmed.length < MIN_SEARCH_LENGTH) return;
    let active = true;
    const timer = setTimeout(() => {
      (ApiService.searchStorageObjects(trimmed) as Promise<StorageSearchResponse>)
        .then((response) => {
          if (!active) return;
          setOutcome({
            query: trimmed,
            results: response.results || [],
            totalScanned: response.totalScanned || 0,
            truncated: response.truncated || false,
            error: null,
          });
        })
        .catch((error: unknown) => {
          if (!active) return;
          setOutcome({
            query: trimmed,
            results: [],
            totalScanned: 0,
            truncated: false,
            error: getErrorMessage(error),
          });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [trimmed]);

  const current = isActive && outcome?.query === trimmed ? outcome : null;

  return {
    query,
    setQuery,
    isActive,
    isLoading: isActive && current === null,
    results: current?.results ?? ([] as StorageSearchResult[]),
    totalScanned: current?.totalScanned ?? 0,
    truncated: current?.truncated ?? false,
    error: current?.error ?? null,
  };
}

// ── Object stat (preview metadata) ───────────────────────────────

/** Full metadata for one object; null until it arrives (or if it fails). */
export function useObjectStat(bucket: string | null, objectName: string | null) {
  const stat = useAsyncData(bucket && objectName ? `${bucket}\u0000${objectName}` : null, (signal) =>
    ApiService.statStorageObject(bucket ?? "", objectName ?? "", { signal }),
  );
  // Keyed, so the previously previewed object's metadata never shows
  return stat.error ? null : stat.data;
}
