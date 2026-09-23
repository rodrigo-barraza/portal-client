"use client";

import { useState } from "react";
import ApiService from "@/services/ApiService";
import type { DockerContainerStats } from "@/types/portal";
import { containerKey } from "../monitoring/containerHistory";
import { useVisiblePolling } from "../monitoring/useVisiblePolling";
import type { LogStreamTarget } from "./useLogStream";

/**
 * Live Docker stats for the container whose logs are open, on the user's
 * container polling interval, paused in hidden tabs. Each result is tagged
 * with the container it belongs to, so switching containers can never
 * show the previous one's numbers — not even from a late response.
 */
export function useContainerStatistics(
  target: LogStreamTarget | null,
  pollIntervalSeconds: number,
) {
  const key = target ? containerKey(target.device, target.container) : null;
  const [result, setResult] = useState<{
    key: string;
    stats: DockerContainerStats | null;
  } | null>(null);

  useVisiblePolling(
    async (isCurrent, signal) => {
      if (!target || !key) return;
      try {
        const response = await ApiService.getContainerStats(target.device, {
          signal,
        });
        if (!isCurrent()) return;
        const stats =
          response.containers.find(
            (container) => container.name === target.container,
          ) ?? null;
        setResult({ key, stats });
      } catch {
        // Keep the last reading; the stream itself reports connection trouble.
      }
    },
    Math.max(1, pollIntervalSeconds) * 1000,
    { enabled: key !== null, restartKey: key },
  );

  return result && result.key === key ? result.stats : null;
}
