"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useAsyncData — race-safe data loading keyed by a request identity.
 *
 * `key` names the request (e.g. `${propertyId}|${period}`); `load` fetches
 * it. Whenever the key changes the hook reports `loading` in that same
 * render — no flash of the previous key's data — and a response that
 * arrives for a key that is no longer current is discarded, so a slow
 * reply for an old property/period/page can never overwrite a newer one.
 * `null` disables loading.
 *
 * Replaces the per-component `didFetch` refs (which skipped legitimate
 * refetches) and hand-rolled request counters. ApiService has no
 * AbortSignal support, so a superseded request still completes; its
 * result is just ignored.
 *
 * `refreshIntervalMs` re-runs `load` for the current key on an interval
 * (background refresh: `loading` stays false, data is replaced in place).
 * Ticks are skipped while the tab is hidden and one fires as soon as it
 * becomes visible again.
 */

export interface AsyncDataOptions {
  /** Keep returning the previous key's data while the new key loads. */
  keepPreviousData?: boolean;
  /** Background refresh interval for the current key, in ms. */
  refreshIntervalMs?: number;
}

export interface AsyncDataResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  /** Re-run `load` for the current key. */
  reload: () => void;
}

interface Settled<T> {
  key: string;
  data: T | null;
  error: Error | null;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function isDocumentHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

export default function useAsyncData<T>(
  key: string | null,
  load: () => Promise<T>,
  { keepPreviousData = false, refreshIntervalMs }: AsyncDataOptions = {},
): AsyncDataResult<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Latest loader, read only inside effects. The key — not the closure's
  // identity — decides when to fetch, so callers can pass inline lambdas.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;

    // A failed background refresh keeps the last good data for this key
    // (a blip in a 15s poll shouldn't blank the number on screen).
    const run = (isRefresh: boolean) => {
      loadRef.current().then(
        (data) => {
          if (!cancelled) setSettled({ key, data, error: null });
        },
        (error: unknown) => {
          if (cancelled) return;
          setSettled((previous) =>
            isRefresh && previous?.key === key
              ? { ...previous, error: toError(error) }
              : { key, data: null, error: toError(error) },
          );
        },
      );
    };

    run(false);

    let interval: ReturnType<typeof setInterval> | undefined;
    const onVisibilityChange = () => {
      if (!isDocumentHidden()) run(true);
    };
    if (refreshIntervalMs && refreshIntervalMs > 0) {
      interval = setInterval(() => {
        if (!isDocumentHidden()) run(true);
      }, refreshIntervalMs);
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (refreshIntervalMs && refreshIntervalMs > 0) {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [key, reloadToken, refreshIntervalMs]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const isCurrent = key !== null && settled?.key === key;
  const showPrevious = keepPreviousData && settled !== null;

  return {
    data: isCurrent || showPrevious ? (settled?.data ?? null) : null,
    error: isCurrent ? (settled?.error ?? null) : null,
    loading: key !== null && !isCurrent,
    reload,
  };
}

// ── Report fan-out ────────────────────────────────────────────

export interface SettledReports<T extends object> {
  /** Each report's value, or null where that request failed. */
  values: { [K in keyof T]: T[K] | null };
  /** The first failure, if any request failed. */
  firstError: Error | null;
  /** True when every request failed — the report has nothing to show. */
  allFailed: boolean;
}

/**
 * Run a dictionary of report requests in parallel. One failing report
 * must not blank the others, but "every report failed" (bad credentials,
 * service down) must surface as an error instead of an empty dashboard.
 */
export async function settleReports<T extends object>(requests: {
  [K in keyof T]: Promise<T[K]>;
}): Promise<SettledReports<T>> {
  const keys = Object.keys(requests) as (keyof T)[];
  const results = await Promise.allSettled(keys.map((reportKey) => requests[reportKey]));

  const values = {} as { [K in keyof T]: T[K] | null };
  let firstError: Error | null = null;
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      values[keys[index]] = result.value;
    } else {
      values[keys[index]] = null;
      firstError ??= toError(result.reason);
    }
  });

  return {
    values,
    firstError,
    allFailed: keys.length > 0 && results.every((result) => result.status === "rejected"),
  };
}

/** sessions-service wraps payloads as `{ success, data }`; GA routes do not. */
export function unwrapData<T>(response: unknown): T {
  if (response && typeof response === "object" && "data" in response) {
    return (response as { data: T }).data;
  }
  return response as T;
}
