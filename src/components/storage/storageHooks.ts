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

export function useStorageOverview() {
  const [overview, setOverview] = useState<{
    summary: StorageSummary | null;
    dockerHosts: DockerHostInfo[];
    loading: boolean;
  }>({ summary: null, dockerHosts: [], loading: true });
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    // Each source degrades on its own — one failing never hides the other
    const [systemResponse, summary] = await Promise.all([
      ApiService.getSystemInfo().catch(() => null),
      (ApiService.getStorageSummary() as Promise<StorageSummary>).catch(() => null),
    ]);
    if (requestId !== requestIdRef.current) return;
    setOverview({ summary, dockerHosts: normalizeDockerHosts(systemResponse), loading: false });
  }, []);

  useEffect(() => {
    const requestIds = requestIdRef;
    load();
    return () => {
      requestIds.current++;
    };
  }, [load]);

  return { ...overview, reload: load };
}

// ── Object listing ───────────────────────────────────────────────

export interface ObjectLocation {
  bucket: string;
  prefix: string;
}

interface ListingState {
  key: string;
  token: number;
  objects: StorageObject[];
  prefixes: string[];
  error: string | null;
}

const locationKey = (location: ObjectLocation) => `${location.bucket}\u0000${location.prefix}`;

/**
 * Objects and sub-folders at a bucket/prefix. Navigating away drops the
 * in-flight response, so a slow listing can never land under a newer
 * breadcrumb. `reload()` refetches in place (keeping rows on screen).
 */
export function useObjectListing(location: ObjectLocation | null) {
  const [listing, setListing] = useState<ListingState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const bucket = location?.bucket;
  const prefix = location?.prefix ?? "";

  useEffect(() => {
    if (!bucket) return;
    let active = true;
    const key = locationKey({ bucket, prefix });
    ApiService.getStorageObjects(bucket, { prefix })
      .then((response: { objects?: StorageObject[]; prefixes?: string[] }) => {
        if (!active) return;
        setListing({
          key,
          token: reloadToken,
          objects: response.objects || [],
          prefixes: response.prefixes || [],
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setListing({ key, token: reloadToken, objects: [], prefixes: [], error: getErrorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [bucket, prefix, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  const current = location && listing?.key === locationKey(location) ? listing : null;

  return {
    objects: current?.objects ?? [],
    prefixes: current?.prefixes ?? [],
    error: current?.error ?? null,
    isLoading: location !== null && current === null,
    isReloading: current !== null && current.token !== reloadToken,
    reload,
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
  const [stat, setStat] = useState<{ key: string; value: StorageObject | null } | null>(null);
  const key = bucket && objectName ? `${bucket}\u0000${objectName}` : null;

  useEffect(() => {
    if (!bucket || !objectName) return;
    let active = true;
    const statKey = `${bucket}\u0000${objectName}`;
    ApiService.statStorageObject(bucket, objectName)
      .then((value: StorageObject) => active && setStat({ key: statKey, value }))
      .catch(() => active && setStat({ key: statKey, value: null }));
    return () => {
      active = false;
    };
  }, [bucket, objectName]);

  // Never show the previously previewed object's metadata
  return stat && stat.key === key ? stat.value : null;
}
