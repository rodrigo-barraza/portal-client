"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@rodrigo-barraza/utilities-library";
import ApiService from "@/services/ApiService";
import type { ContainerRow, PortalService, SystemInfo } from "@/types/portal";
import {
  HISTORY_MAX,
  appendHistory,
  historyFromMetrics,
  historyFromRingBuffer,
  mergeSeededHistory,
  type HistoryMap,
} from "../monitoring/containerHistory";
import { useVisiblePolling, type IsCurrent } from "../monitoring/useVisiblePolling";
import { buildContainerRows, normalizeSystemInfo, type DockerContainer } from "./containerRows";

/** portal-service re-checks registry health 3 s after an action. */
const POST_ACTION_RECHECK_MILLISECONDS = 4_000;

async function loadSeedHistory(signal: AbortSignal): Promise<HistoryMap> {
  try {
    const metrics = await ApiService.getContainerMetrics(
      { range: "1h", limit: HISTORY_MAX },
      { signal },
    );
    const seeded = historyFromMetrics(metrics?.containers);
    if (Object.keys(seeded).length > 0) return seeded;
  } catch {
    // Persistent metrics unavailable (no MongoDB) — try the ring buffer.
  }
  try {
    const ringBuffer = await ApiService.getContainerStatsHistory(undefined, { signal });
    return historyFromRingBuffer(ringBuffer?.history);
  } catch {
    return {};
  }
}

/**
 * Data behind the Containers page: Docker stats joined with the project
 * registry, polled on the user's interval while the tab is visible, plus
 * per-container sparkline history (seeded from persisted metrics so trends
 * show immediately) and host RAM from `/stats/system`.
 */
export function useContainerDashboard(pollIntervalSeconds: number) {
  const [rows, setRows] = useState<ContainerRow[]>([]);
  const [history, setHistory] = useState<HistoryMap>({});
  const [systemInfo, setSystemInfo] = useState<SystemInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const aliveRef = useRef(false);
  const hasSystemInfoRef = useRef(false);
  const systemInfoInFlightRef = useRef(false);
  const recheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const systemInfoControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      systemInfoControllerRef.current?.abort();
      if (recheckTimerRef.current) clearTimeout(recheckTimerRef.current);
    };
  }, []);

  // /stats/system walks Docker's disk usage (30 s+ on the NAS): never stack
  // a second request on one in flight, and stop asking once it answered.
  const loadSystemInfo = useCallback(async () => {
    if (hasSystemInfoRef.current || systemInfoInFlightRef.current) return;
    systemInfoInFlightRef.current = true;
    // Its own controller: a superseded poll must not cancel this slow call.
    const controller = new AbortController();
    systemInfoControllerRef.current = controller;
    try {
      const info = normalizeSystemInfo(
        await ApiService.getSystemInfo(undefined, { signal: controller.signal }),
      );
      if (info && aliveRef.current) {
        hasSystemInfoRef.current = true;
        setSystemInfo(info);
      }
    } catch {
      // Supplementary (host RAM) — the next poll retries.
    } finally {
      systemInfoInFlightRef.current = false;
    }
  }, []);

  const poll = useCallback(
    async (isCurrent: IsCurrent, signal: AbortSignal) => {
      void loadSystemInfo();
      try {
        const [containerResponse, servicesResponse] = await Promise.all([
          ApiService.getContainerStats(undefined, { signal }),
          ApiService.getServices(false, { signal }),
        ]);
        if (!isCurrent()) return;
        const nextRows = buildContainerRows(
          (containerResponse?.containers ?? []) as DockerContainer[],
          (servicesResponse?.services ?? []) as PortalService[],
        );
        setRows(nextRows);
        setHistory((previous) =>
          appendHistory(
            previous,
            nextRows.map((row) => ({
              key: row.id,
              cpu: row._stats?.cpu?.percent || 0,
              mem: row._stats?.memory?.used || 0,
            })),
          ),
        );
        setError(null);
      } catch (pollError) {
        if (!isCurrent()) return;
        setError(getErrorMessage(pollError));
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [loadSystemInfo],
  );

  const refresh = useVisiblePolling(poll, Math.max(1, pollIntervalSeconds) * 1000);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      const seeded = await loadSeedHistory(controller.signal);
      if (controller.signal.aborted || Object.keys(seeded).length === 0) return;
      setHistory((live) => mergeSeededHistory(live, seeded));
    })();
    return () => controller.abort();
  }, []);

  /** After start/stop/restart/rollback: fresh stats now, fresh health shortly. */
  const refreshAfterAction = useCallback(async () => {
    await ApiService.invalidateStats().catch(() => undefined);
    await refresh();
    if (recheckTimerRef.current) clearTimeout(recheckTimerRef.current);
    recheckTimerRef.current = setTimeout(() => {
      recheckTimerRef.current = null;
      void refresh();
    }, POST_ACTION_RECHECK_MILLISECONDS);
  }, [refresh]);

  return { rows, history, systemInfo, loading, error, refresh, refreshAfterAction };
}
