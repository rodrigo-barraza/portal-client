"use client";

import { getErrorMessage } from "@rodrigo-barraza/utilities-library";
import ApiService from "../../services/ApiService";
import useAsyncData from "../analytics/useAsyncData";
import type {
  ExternalApiTimeSeries,
  ExternalApiUsageData,
} from "@/types/portal";
/**
 * The usage summary for a period. Switching periods quickly aborts the
 * older period's request, so its answer can never land over the newer
 * one; a refresh that fails keeps the data on screen and reports the
 * error alongside it.
 */
export function useExternalApiSummary(period: string) {
  const summary = useAsyncData<ExternalApiUsageData>(period, (signal) =>
    ApiService.getExternalApiUsageSummary(period, { signal }),
  );
  return {
    data: summary.data,
    error: summary.error ? getErrorMessage(summary.error) : null,
    isLoading: summary.loading,
    isRefreshing: summary.reloading,
    refresh: summary.reload,
  };
}

/** Daily success/error breakdown for one API; null while loading or on failure. */
export function useExternalApiTimeSeries(
  serviceIdentifier: string | null,
  period: string,
) {
  const timeSeries = useAsyncData<ExternalApiTimeSeries>(
    serviceIdentifier ? `${serviceIdentifier}\u0000${period}` : null,
    (signal) =>
      ApiService.getExternalApiUsageTimeSeries(
        serviceIdentifier ?? "",
        period,
        { signal },
      ),
  );
  return {
    data: timeSeries.error ? null : timeSeries.data,
    isLoading: timeSeries.loading,
    failed: timeSeries.error !== null,
  };
}
