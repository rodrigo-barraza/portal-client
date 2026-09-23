"use client";

import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@rodrigo-barraza/utilities-library";
import ApiService from "../../services/ApiService";
import type { ExternalApiUsageData, TimeSeriesData } from "./externalApiUsage";

/**
 * The usage summary for a period. Switching periods quickly can no longer
 * land an older period's answer over the newer one; a refresh that fails
 * keeps the data on screen and reports the error alongside it.
 */
export function useExternalApiSummary(period: string) {
  const [state, setState] = useState<{
    period: string | null;
    data: ExternalApiUsageData | null;
    error: string | null;
  }>({ period: null, data: null, error: null });
  const [reloadToken, setReloadToken] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    (ApiService.getExternalApiUsageSummary(period) as Promise<ExternalApiUsageData>)
      .then((data) => {
        if (!active) return;
        setState({ period, data, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState((previous) => ({
          period,
          // Keep a same-period answer on screen when only a refresh failed
          data: previous.period === period ? previous.data : null,
          error: getErrorMessage(error),
        }));
      })
      .finally(() => {
        if (active) setIsRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [period, reloadToken]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setReloadToken((token) => token + 1);
  }, []);

  const isCurrent = state.period === period;
  return {
    data: isCurrent ? state.data : null,
    error: isCurrent ? state.error : null,
    isLoading: !isCurrent,
    isRefreshing,
    refresh,
  };
}

/** Daily success/error breakdown for one API; null while loading or on failure. */
export function useExternalApiTimeSeries(serviceIdentifier: string | null, period: string) {
  const [result, setResult] = useState<{ key: string; data: TimeSeriesData | null } | null>(null);
  const key = serviceIdentifier ? `${serviceIdentifier}\u0000${period}` : null;

  useEffect(() => {
    if (!serviceIdentifier) return;
    let active = true;
    const requestKey = `${serviceIdentifier}\u0000${period}`;
    (ApiService.getExternalApiUsageTimeSeries(serviceIdentifier, period) as Promise<TimeSeriesData>)
      .then((data) => active && setResult({ key: requestKey, data }))
      .catch((error: unknown) => {
        console.error("Failed to fetch time series:", getErrorMessage(error));
        if (active) setResult({ key: requestKey, data: null });
      });
    return () => {
      active = false;
    };
  }, [serviceIdentifier, period]);

  const current = key !== null && result?.key === key ? result : null;
  return {
    data: current?.data ?? null,
    isLoading: key !== null && current === null,
    failed: current !== null && current.data === null,
  };
}
