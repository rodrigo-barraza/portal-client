"use client";

import { useCallback, useRef, useState } from "react";
import { useVisiblePolling } from "../monitoring/useVisiblePolling";

/**
 * useAsyncData — keyed data loading on the shared `useVisiblePolling`
 * scheduler.
 *
 * `key` names the request (e.g. `${propertyId}|${period}`); `load` fetches
 * it and passes the `signal` it is given on to ApiService. Whenever the key
 * changes the hook reports `loading` in that same render — no flash of the
 * previous key's data. A newer run (key change, `reload()`) supersedes the
 * one in flight: its request is aborted and its answer discarded, so a slow
 * reply for an old property/period/page can never overwrite a newer one.
 * Unmounting aborts too. `null` disables loading.
 *
 * `refreshIntervalMs` re-runs `load` for the current key on an interval
 * (background refresh: `loading` stays false, data is replaced in place).
 * It inherits the scheduler's rules: no tick while the previous load is
 * still in flight, no timer while the tab is hidden, and one catch-up load
 * on return only if a tick came due meanwhile.
 *
 * A failed refresh or reload keeps the last good data for the key and
 * reports the error beside it (a blip in a 15s poll shouldn't blank the
 * number on screen); a failed first load for a key has no data.
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
  /** True from a `reload()` until that reload settles (not for background ticks). */
  reloading: boolean;
  /** Re-run `load` for the current key now; resolves when it settles. */
  reload: () => Promise<void>;
}

interface Settled<T> {
  key: string;
  data: T | null;
  error: Error | null;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export default function useAsyncData<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
  { keepPreviousData = false, refreshIntervalMs }: AsyncDataOptions = {},
): AsyncDataResult<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [reloading, setReloading] = useState(false);
  const reloadIdRef = useRef(0);

  // The scheduler always runs its latest task, so callers can pass inline
  // lambdas: the key — not the closure's identity — decides when to fetch.
  const refresh = useVisiblePolling(
    async (isCurrent, signal) => {
      if (key === null) return;
      try {
        const data = await load(signal);
        if (isCurrent()) setSettled({ key, data, error: null });
      } catch (error) {
        if (!isCurrent()) return;
        setSettled((previous) =>
          previous?.key === key
            ? { ...previous, error: toError(error) }
            : { key, data: null, error: toError(error) },
        );
      }
    },
    refreshIntervalMs ?? null,
    { enabled: key !== null, restartKey: key },
  );

  const reload = useCallback(async () => {
    const reloadId = ++reloadIdRef.current;
    setReloading(true);
    try {
      await refresh();
    } finally {
      if (reloadId === reloadIdRef.current) setReloading(false);
    }
  }, [refresh]);

  const isCurrent = key !== null && settled?.key === key;
  const showPrevious = keepPreviousData && settled !== null;

  return {
    data: isCurrent || showPrevious ? (settled?.data ?? null) : null,
    error: isCurrent ? (settled?.error ?? null) : null,
    loading: key !== null && !isCurrent,
    reloading,
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
