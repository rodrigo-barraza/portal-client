"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ApiService from "@/services/ApiService";
import type { ServiceRollbackStatus } from "@/types/portal";

export interface RollbackStatus {
  available: boolean;
  /** Device id the service's container runs on (from rollback-status). */
  device: string | null;
}

function toRollbackStatus(response: ServiceRollbackStatus): RollbackStatus {
  return { available: response.available, device: response.device ?? null };
}

/**
 * Whether each registered service has a `:previous` image to roll back to.
 * One batch request answers every containerized service; it is re-issued
 * only when the set of ids changes — polling hands us a fresh array every
 * few seconds, so the effect keys on a sorted signature.
 */
export function useRollbackAvailability(serviceIds: readonly string[]) {
  const [statuses, setStatuses] = useState<Record<string, RollbackStatus>>({});
  const signature = useMemo(
    () => [...new Set(serviceIds)].sort().join(","),
    [serviceIds],
  );

  useEffect(() => {
    if (!signature) return;
    const controller = new AbortController();
    const ids = signature.split(",");
    ApiService.getRollbackStatuses({ signal: controller.signal })
      .then((byId) => {
        const next: Record<string, RollbackStatus> = {};
        for (const id of ids) {
          if (Object.hasOwn(byId, id)) next[id] = toRollbackStatus(byId[id]);
        }
        setStatuses(next);
      })
      .catch(() => {
        // Aborted, or the service is unreachable: no rollback buttons until
        // the next id-set change re-queries.
      });
    return () => controller.abort();
  }, [signature]);

  /** Re-query one service — after a rollback consumes its `:previous` image. */
  const recheck = useCallback(async (serviceId: string) => {
    try {
      const status = toRollbackStatus(
        await ApiService.getRollbackStatus(serviceId),
      );
      setStatuses((previous) => ({ ...previous, [serviceId]: status }));
    } catch {
      // Keep the last known status; the next id-set change re-queries.
    }
  }, []);

  return { statuses, recheck };
}
