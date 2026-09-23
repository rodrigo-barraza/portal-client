"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ApiService from "@/services/ApiService";

export interface RollbackStatus {
  available: boolean;
  /** Device id the service's container runs on (from rollback-status). */
  device: string | null;
}

async function fetchRollbackStatus(
  serviceId: string,
  signal?: AbortSignal,
): Promise<RollbackStatus> {
  const response = await ApiService.getRollbackStatus(serviceId, { signal });
  return {
    available: response?.available === true,
    device: typeof response?.device === "string" ? response.device : null,
  };
}

/**
 * Whether each registered service has a `:previous` image to roll back to.
 * Re-queried only when the set of ids changes — polling hands us a fresh
 * array every few seconds, so the effect keys on a sorted signature.
 */
export function useRollbackAvailability(serviceIds: readonly string[]) {
  const [statuses, setStatuses] = useState<Record<string, RollbackStatus>>({});
  const signature = useMemo(() => [...new Set(serviceIds)].sort().join(","), [serviceIds]);

  useEffect(() => {
    if (!signature) return;
    const controller = new AbortController();
    const ids = signature.split(",");
    (async () => {
      const results = await Promise.allSettled(
        ids.map((id) => fetchRollbackStatus(id, controller.signal)),
      );
      if (controller.signal.aborted) return;
      const next: Record<string, RollbackStatus> = {};
      results.forEach((result, index) => {
        if (result.status === "fulfilled") next[ids[index]] = result.value;
      });
      setStatuses(next);
    })();
    return () => controller.abort();
  }, [signature]);

  /** Re-query one service — after a rollback consumes its `:previous` image. */
  const recheck = useCallback(async (serviceId: string) => {
    try {
      const status = await fetchRollbackStatus(serviceId);
      setStatuses((previous) => ({ ...previous, [serviceId]: status }));
    } catch {
      // Keep the last known status; the next id-set change re-queries.
    }
  }, []);

  return { statuses, recheck };
}
