"use client";

import { useCallback, useEffect, useRef } from "react";

/** True while the run that received it is still the newest and the host is mounted. */
export type IsCurrent = () => boolean;

/** A polling task: gets its staleness check and an AbortSignal for its requests. */
export type PollTask = (isCurrent: IsCurrent, signal: AbortSignal) => Promise<void>;

export interface VisiblePollingOptions {
  /** False stops the cycle and supersedes any run in flight. */
  enabled?: boolean;
  /** Changing it (e.g. the thing being polled) restarts the cycle. */
  restartKey?: string | number | null;
}

function isDocumentHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

/**
 * The one scheduler behind every poll and fetch-on-mount in the portal
 * (`useAsyncData` is built on it). Runs `task` immediately and then every
 * `intervalMs` — but only while the tab is visible, so a background tab
 * stops hammering portal-service. `intervalMs` null (or ≤ 0) runs the task
 * once per `restartKey` and on `refresh()`, with no timer.
 *
 * - The first run of a cycle starts at once, visible or not. After that,
 *   hiding the tab stops the timer; showing it again runs the task at once
 *   if a tick came due while hidden, and otherwise resumes the timer where
 *   it left off (a quick tab flip is not a refetch).
 * - A tick that lands while the previous run is still in flight is skipped,
 *   so a slow backend never gets overlapping polls stacked on it.
 * - The returned `refresh()` forces a run right away and resolves when it
 *   settles. A run it supersedes sees `isCurrent()` turn false and its
 *   `signal` abort, so an older response can never overwrite a newer one;
 *   both also happen when the host unmounts, when `enabled` turns false
 *   and when the cycle restarts. Tasks pass `signal` to their requests and
 *   check `isCurrent()` after every `await`, before touching state.
 * - Changing `restartKey` or `intervalMs` restarts the cycle with an
 *   immediate run.
 */
export function useVisiblePolling(
  task: PollTask,
  intervalMs: number | null,
  { enabled = true, restartKey }: VisiblePollingOptions = {},
): () => Promise<void> {
  const taskRef = useRef(task);
  const latestRunRef = useRef(0);
  const inFlightRef = useRef(false);
  const aliveRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const lastStartRef = useRef(0);

  useEffect(() => {
    taskRef.current = task;
  });

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const run = useCallback(async (force: boolean) => {
    if (inFlightRef.current && !force) return;
    const runId = ++latestRunRef.current;
    inFlightRef.current = true;
    lastStartRef.current = Date.now();
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      await taskRef.current(
        () => aliveRef.current && runId === latestRunRef.current,
        controller.signal,
      );
    } catch {
      // Tasks own their error state; a throw must not wedge the poller.
    } finally {
      if (runId === latestRunRef.current) inFlightRef.current = false;
    }
  }, []);

  /** Supersede the run in flight, if any: stale, aborted, and no longer blocking ticks. */
  const cancel = useCallback(() => {
    latestRunRef.current += 1;
    inFlightRef.current = false;
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void run(true);
    const period = intervalMs ?? 0;
    if (period <= 0) return cancel;

    let timer: ReturnType<typeof setTimeout> | undefined;
    function stop() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    }
    function schedule(delay: number) {
      stop();
      timer = setTimeout(tick, delay);
    }
    function tick() {
      void run(false);
      schedule(period);
    }
    const handleVisibilityChange = () => {
      if (isDocumentHidden()) {
        stop();
        return;
      }
      const dueIn = lastStartRef.current + period - Date.now();
      if (dueIn <= 0) tick();
      else schedule(dueIn);
    };

    if (!isDocumentHidden()) schedule(period);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cancel();
    };
  }, [enabled, intervalMs, restartKey, run, cancel]);

  return useCallback(() => run(true), [run]);
}
