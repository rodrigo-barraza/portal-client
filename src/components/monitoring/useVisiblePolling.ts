"use client";

import { useCallback, useEffect, useRef } from "react";

/** True while the run that received it is still the newest and the host is mounted. */
export type IsCurrent = () => boolean;

/** A polling task: gets its staleness check and an AbortSignal for its requests. */
export type PollTask = (isCurrent: IsCurrent, signal: AbortSignal) => Promise<void>;

/**
 * Run `task` immediately and then every `intervalMs` — but only while the
 * tab is visible, so a background tab stops hammering portal-service.
 *
 * - Hiding the tab stops the timer; showing it again runs the task at once.
 * - A tick that lands while the previous run is still in flight is skipped,
 *   so a slow backend never gets overlapping polls stacked on it.
 * - The returned `refresh()` forces a run right away. A run it supersedes
 *   sees `isCurrent()` turn false and its `signal` abort, so an older
 *   response can never overwrite a newer one; both also happen when the
 *   host unmounts. Tasks pass `signal` to their requests and check
 *   `isCurrent()` after every `await`, before touching state.
 * - Changing `restartKey` (e.g. the thing being polled) restarts the cycle
 *   with an immediate run that supersedes any run still in flight.
 */
export function useVisiblePolling(
  task: PollTask,
  intervalMs: number,
  { enabled = true, restartKey }: { enabled?: boolean; restartKey?: string | number | null } = {},
): () => Promise<void> {
  const taskRef = useRef(task);
  const latestRunRef = useRef(0);
  const inFlightRef = useRef(false);
  const aliveRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

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

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      if (timer === undefined) timer = setInterval(() => void run(false), intervalMs);
    };
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        void run(false);
        start();
      }
    };

    if (document.visibilityState !== "hidden") {
      void run(true);
      start();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, intervalMs, restartKey, run]);

  return useCallback(() => run(true), [run]);
}
