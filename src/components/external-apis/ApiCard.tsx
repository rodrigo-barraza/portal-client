"use client";

import { memo, useMemo, useRef } from "react";
import { ChevronDown, ExternalLink, Server } from "lucide-react";
import {
  BadgeComponent,
  ChartLineComponent,
  LoadingIndicatorComponent,
} from "@rodrigo-barraza/components-library";
import { formatCompact, isUrl } from "@rodrigo-barraza/utilities-library";
import { getCategoryMeta } from "./categoryMeta";
import { fillDailyValues, formatCostValue, formatPercentValue, successPercent } from "./externalApiUsage";
import webStyles from "../WebAnalytics.module.css";
import type { ExternalApiTimeSeries, ExternalApiUsage } from "@/types/portal";
import styles from "../ExternalApisComponent.module.css";

export const SUCCESS_COLOR = "#10b981";
export const ERROR_COLOR = "#ef4444";

const formatRequests = (value: number) => formatCompact(Math.round(value));

function DetailPanel({
  dates,
  timeSeries,
  isLoading,
  failed,
}: {
  dates: string[];
  timeSeries: ExternalApiTimeSeries | null;
  isLoading: boolean;
  failed: boolean;
}) {
  const series = useMemo(
    () =>
      timeSeries && {
        success: fillDailyValues(timeSeries.series, (point) => point.successRequests, dates),
        errors: fillDailyValues(timeSeries.series, (point) => point.errorRequests, dates),
      },
    [timeSeries, dates],
  );

  if (isLoading) {
    return (
      <LoadingIndicatorComponent
        size="small"
        label="Loading daily breakdown…"
        className="is-loading-centered-state"
      />
    );
  }
  if (failed || !series) {
    return <p className={styles["detail-error"]}>Couldn&apos;t load the daily breakdown.</p>;
  }

  const hasErrors = series.errors.some((value) => value > 0);
  return (
    <>
      <div className={styles["detail-chart-stack"]}>
        <ChartLineComponent
          data={series.success}
          color={SUCCESS_COLOR}
          maxValue={Math.max(...series.success, 1)}
          height={120}
          historyMax={series.success.length}
          showGrid
          formatValue={formatRequests}
        />
        {hasErrors && (
          <ChartLineComponent
            data={series.errors}
            color={ERROR_COLOR}
            maxValue={Math.max(...series.errors, 1)}
            height={120}
            historyMax={series.errors.length}
            showGrid
            formatValue={formatRequests}
          />
        )}
      </div>
      <div className={webStyles["chart-legend"]}>
        <div className={webStyles["chart-legend-item"]}>
          <div className={webStyles["chart-legend-dot"]} style={{ background: SUCCESS_COLOR }} />
          Success
        </div>
        {hasErrors && (
          <div className={webStyles["chart-legend-item"]}>
            <div className={webStyles["chart-legend-dot"]} style={{ background: ERROR_COLOR }} />
            Errors
          </div>
        )}
      </div>
    </>
  );
}

/**
 * One API's usage card. The whole card toggles the daily breakdown on
 * click; the header is the real button (keyboard, screen readers) and its
 * click bubbles to the card, so the Docs link stays a separate control.
 * Clicks inside the open breakdown (chart hovers, selections) never toggle.
 */
export const ApiCard = memo(function ApiCard({
  apiService,
  dates,
  isExpanded,
  timeSeries,
  isTimeSeriesLoading,
  timeSeriesFailed,
  onToggle,
}: {
  apiService: ExternalApiUsage;
  dates: string[];
  isExpanded: boolean;
  timeSeries: ExternalApiTimeSeries | null;
  isTimeSeriesLoading: boolean;
  timeSeriesFailed: boolean;
  onToggle: (serviceIdentifier: string) => void;
}) {
  const { icon: CategoryIcon, color } = getCategoryMeta(apiService.category);
  const success = successPercent(apiService);
  const sparkline = useMemo(
    () => fillDailyValues(apiService.dailySeries, (point) => point.requests, dates),
    [apiService.dailySeries, dates],
  );
  const hasCost = (apiService.estimatedCost ?? 0) > 0;
  const detailPanelRef = useRef<HTMLDivElement>(null);

  return (
    // The card-wide click only widens the pointer target of the header
    // button, which keyboard and screen-reader users reach, so the card
    // itself carries no role of its own.
    <div
      role="presentation"
      className={`${styles["api-card"]}${isExpanded ? ` ${styles["is-expanded-state"]}` : ""}`}
      onClick={(event) => {
        if (detailPanelRef.current?.contains(event.target as Node)) return;
        onToggle(apiService.serviceIdentifier);
      }}
    >
      <button
        type="button"
        className={styles["api-card-header-row"]}
        aria-expanded={isExpanded}
      >
        <span className={styles["api-card-icon-tile"]} style={{ color, background: `${color}15` }}>
          <CategoryIcon size={18} strokeWidth={2} />
        </span>
        <span className={styles["api-card-title-group"]}>
          <span className={styles["api-card-name"]}>{apiService.displayName}</span>
          <span className={styles["api-card-service-identifier"]}>{apiService.serviceIdentifier}</span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`${styles["api-card-expand-indicator"]}${isExpanded ? ` ${styles["is-expanded-state"]}` : ""}`}
        />
      </button>

      <div className={styles["api-card-metrics-row"]}>
        <div className={styles["metric-block"]}>
          <span className={styles["metric-label"]}>Requests</span>
          <span className={styles["metric-value"]}>{formatCompact(apiService.totalRequests)}</span>
        </div>
        <div className={styles["metric-block"]}>
          <span className={styles["metric-label"]}>Success</span>
          <span className={styles["metric-value-success"]}>{formatCompact(apiService.successRequests)}</span>
        </div>
        {apiService.errorRequests > 0 && (
          <div className={styles["metric-block"]}>
            <span className={styles["metric-label"]}>Errors</span>
            <span className={styles["metric-value-error"]}>{formatCompact(apiService.errorRequests)}</span>
          </div>
        )}
        {apiService.errorRate > 0 && (
          <div className={styles["metric-block"]}>
            <span className={styles["metric-label"]}>Error Rate</span>
            <span className={styles["metric-value-error"]}>{formatPercentValue(apiService.errorRate)}</span>
          </div>
        )}
        {hasCost && (
          <div className={styles["metric-block"]}>
            <span className={styles["metric-label"]}>Est. Cost</span>
            <span className={styles["metric-value"]}>{formatCostValue(apiService.estimatedCost ?? 0)}</span>
          </div>
        )}
      </div>

      <div
        className={styles["success-error-bar-track"]}
        role="img"
        aria-label={`${success.toFixed(1)}% successful`}
      >
        <div className={styles["success-bar-segment"]} style={{ width: `${success}%` }} />
        {success < 100 && <div className={styles["error-bar-segment"]} style={{ width: `${100 - success}%` }} />}
      </div>

      <div className={styles["sparkline-wrapper"]}>
        <ChartLineComponent
          data={sparkline}
          color={color}
          maxValue={Math.max(...sparkline, 1)}
          height={48}
          historyMax={sparkline.length}
          formatValue={formatRequests}
        />
      </div>

      <div className={styles["api-card-footer-row"]}>
        <BadgeComponent>
          <Server size={10} />
          {apiService.consumer}
        </BadgeComponent>
        {isUrl(apiService.documentationUrl) && (
          <a
            href={apiService.documentationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles["documentation-link-button"]}
            onClick={(event) => event.stopPropagation()}
          >
            <ExternalLink size={11} />
            Docs
          </a>
        )}
      </div>

      {isExpanded && (
        <div ref={detailPanelRef} className={styles["expanded-detail-panel"]}>
          <DetailPanel
            dates={dates}
            timeSeries={timeSeries}
            isLoading={isTimeSeriesLoading}
            failed={timeSeriesFailed}
          />
        </div>
      )}
    </div>
  );
});
