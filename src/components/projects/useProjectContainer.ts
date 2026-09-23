"use client";

import { useEffect, useState } from "react";
import ApiService from "@/services/ApiService";
import type { ContainerHistory } from "@/types/portal";
import type { DockerContainer } from "../containers/containerRows";
import {
  HISTORY_MAX,
  appendHistory,
  containerKey,
  historyFromMetrics,
  mergeSeededHistory,
  type HistoryMap,
} from "../monitoring/containerHistory";
import { useVisiblePolling } from "../monitoring/useVisiblePolling";

/** Of the containers with this name (one per host at most), prefer a running one. */
export function pickProjectContainer(
  containers: DockerContainer[],
  dockerProject: string,
): DockerContainer | null {
  const named = containers.filter((container) => container.name === dockerProject);
  return named.find((container) => container.state === "running") ?? named[0] ?? null;
}

/**
 * Live Docker stats + sparkline history for a project's container, for the
 * Projects drawer. Polls only while the drawer's Container tab is mounted
 * and the page is visible; the Projects page itself stays stats-free.
 */
export function useProjectContainer(dockerProject: string | null, pollIntervalSeconds: number) {
  const [loaded, setLoaded] = useState(false);
  const [stats, setStats] = useState<DockerContainer | null>(null);
  const [history, setHistory] = useState<HistoryMap>({});

  useVisiblePolling(
    async (isCurrent) => {
      if (!dockerProject) return;
      try {
        const response = await ApiService.getContainerStats();
        if (!isCurrent()) return;
        const container = pickProjectContainer(
          (response?.containers ?? []) as DockerContainer[],
          dockerProject,
        );
        setStats(container);
        if (container) {
          setHistory((previous) =>
            appendHistory(previous, [
              {
                key: containerKey(container.device, container.name),
                cpu: container.cpu?.percent || 0,
                mem: container.memory?.used || 0,
              },
            ]),
          );
        }
      } catch {
        // Keep the last reading; the tab shows it until the next poll.
      } finally {
        if (isCurrent()) setLoaded(true);
      }
    },
    Math.max(1, pollIntervalSeconds) * 1000,
    { enabled: dockerProject !== null, restartKey: dockerProject },
  );

  useEffect(() => {
    if (!dockerProject) return;
    let cancelled = false;
    ApiService.getContainerMetrics({ container: dockerProject, range: "1h", limit: HISTORY_MAX })
      .then((metrics) => {
        if (cancelled) return;
        const seeded = historyFromMetrics(metrics?.containers);
        setHistory((live) => mergeSeededHistory(live, seeded));
      })
      .catch(() => {
        // No persisted metrics — the sparkline builds from live polls.
      });
    return () => {
      cancelled = true;
    };
  }, [dockerProject]);

  const containerHistory: ContainerHistory | undefined = stats
    ? history[containerKey(stats.device, stats.name)]
    : undefined;

  return { loaded, stats, history: containerHistory };
}
