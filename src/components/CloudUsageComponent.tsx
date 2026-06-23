"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronDown,
  Cloud,
  ExternalLink,
  RefreshCw,
  Server,
  BarChart3,
} from "lucide-react";
import {
  BadgeComponent,
  ButtonComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
  SegmentedControlComponent,
} from "@rodrigo-barraza/components-library";

import ApiService from "../services/ApiService";
import styles from "./CloudUsageComponent.module.css";

// ── Types ──────────────────────────────────────────────────────────

interface DailySeries {
  date: string;
  requests: number;
}

interface ApiUsageSummary {
  serviceIdentifier: string;
  displayName: string;
  category: string;
  consumer: string;
  documentationUrl: string;
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  errorRate: number;
  dailySeries: DailySeries[];
}

interface CloudUsageData {
  services: ApiUsageSummary[];
  totalRequests: number;
  totalErrors: number;
  period: string;
  projectId: string;
  fetchedAt: string;
}

interface TimeSeriesPoint {
  date: string;
  requests: number;
  successRequests: number;
  errorRequests: number;
}

interface TimeSeriesData {
  serviceIdentifier: string;
  displayName: string;
  series: TimeSeriesPoint[];
  period: string;
  fetchedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const PERIOD_OPTIONS = [
  { value: "7d", label: "7d" },
  { value: "14d", label: "14d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

// ── Category Icons ─────────────────────────────────────────────────

function getCategoryIcon(category: string) {
  switch (category) {
    case "Maps & Location":
      return "🗺️";
    case "Environmental":
      return "🌿";
    case "Search":
      return "🔍";
    case "Media":
      return "🎬";
    case "Productivity":
      return "📅";
    case "Analytics":
      return "📊";
    default:
      return "☁️";
  }
}

// ── Sparkline SVG ──────────────────────────────────────────────────

function SparklineSvg({ data }: { data: DailySeries[] }) {
  if (!data || data.length < 2) return null;

  const viewBoxWidth = 300;
  const viewBoxHeight = 48;
  const paddingInline = 2;
  const paddingBlock = 4;
  const chartWidth = viewBoxWidth - paddingInline * 2;
  const chartHeight = viewBoxHeight - paddingBlock * 2;

  const maxValue = Math.max(...data.map((point) => point.requests), 1);

  const points = data.map((point, index) => ({
    x: paddingInline + (index / (data.length - 1)) * chartWidth,
    y:
      paddingBlock +
      chartHeight -
      (point.requests / maxValue) * chartHeight,
  }));

  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
    )
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${viewBoxHeight} L ${points[0].x} ${viewBoxHeight} Z`;

  return (
    <div className={styles["sparkline-container"]}>
      <svg
        className={styles["sparkline-svg"]}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="none"
      >
        <path
          className={styles["sparkline-area-path"]}
          d={areaPath}
        />
        <path
          className={styles["sparkline-line-path"]}
          d={linePath}
        />
      </svg>
    </div>
  );
}

// ── Detail Chart SVG ───────────────────────────────────────────────

function DetailChartSvg({ data }: { data: TimeSeriesPoint[] }) {
  if (!data || data.length < 2) return null;

  const viewBoxWidth = 600;
  const viewBoxHeight = 200;
  const marginInline = 45;
  const marginBlockStart = 10;
  const marginBlockEnd = 30;
  const chartWidth = viewBoxWidth - marginInline * 2;
  const chartHeight = viewBoxHeight - marginBlockStart - marginBlockEnd;

  const maxSuccessValue = Math.max(
    ...data.map((point) => point.successRequests),
    1,
  );
  const maxErrorValue = Math.max(
    ...data.map((point) => point.errorRequests),
    1,
  );
  const maxValue = Math.max(maxSuccessValue, maxErrorValue, 1);

  function buildPaths(extractor: (point: TimeSeriesPoint) => number) {
    const points = data.map((point, index) => ({
      x: marginInline + (index / (data.length - 1)) * chartWidth,
      y:
        marginBlockStart +
        chartHeight -
        (extractor(point) / maxValue) * chartHeight,
    }));

    const linePath = points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
      )
      .join(" ");

    const areaPath = `${linePath} L ${points[points.length - 1].x} ${marginBlockStart + chartHeight} L ${points[0].x} ${marginBlockStart + chartHeight} Z`;

    return { linePath, areaPath };
  }

  const successPaths = buildPaths((point) => point.successRequests);
  const errorPaths = buildPaths((point) => point.errorRequests);

  // Grid lines
  const gridLineCount = 4;
  const gridLines = Array.from({ length: gridLineCount + 1 }, (_, index) => {
    const verticalPosition =
      marginBlockStart + (index / gridLineCount) * chartHeight;
    const labelValue = Math.round(
      maxValue - (index / gridLineCount) * maxValue,
    );
    return { y: verticalPosition, label: formatNumber(labelValue) };
  });

  // Date labels (show first, middle, last)
  const dateLabels = [
    {
      x: marginInline,
      label: data[0].date.slice(5),
    },
    {
      x: marginInline + chartWidth / 2,
      label: data[Math.floor(data.length / 2)]?.date.slice(5) || "",
    },
    {
      x: marginInline + chartWidth,
      label: data[data.length - 1].date.slice(5),
    },
  ];

  return (
    <div className={styles["detail-chart-container"]}>
      <svg
        className={styles["detail-chart-svg"]}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="none"
      >
        {gridLines.map((gridLine) => (
          <g key={gridLine.y}>
            <line
              className={styles["detail-chart-grid-line"]}
              x1={marginInline}
              y1={gridLine.y}
              x2={viewBoxWidth - marginInline}
              y2={gridLine.y}
            />
            <text
              className={styles["detail-chart-axis-label"]}
              x={marginInline - 6}
              y={gridLine.y + 3}
              textAnchor="end"
            >
              {gridLine.label}
            </text>
          </g>
        ))}

        <path
          className={styles["detail-chart-success-area"]}
          d={successPaths.areaPath}
        />
        <path
          className={styles["detail-chart-success-line"]}
          d={successPaths.linePath}
        />

        {maxErrorValue > 0 && (
          <>
            <path
              className={styles["detail-chart-error-area"]}
              d={errorPaths.areaPath}
            />
            <path
              className={styles["detail-chart-error-line"]}
              d={errorPaths.linePath}
            />
          </>
        )}

        {dateLabels.map((dateLabel) => (
          <text
            key={dateLabel.x}
            className={styles["detail-chart-axis-label"]}
            x={dateLabel.x}
            y={viewBoxHeight - 6}
            textAnchor="middle"
          >
            {dateLabel.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export default function CloudUsageComponent() {
  const [data, setData] = useState<CloudUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("30d");
  const [expandedServiceIdentifier, setExpandedServiceIdentifier] = useState<
    string | null
  >(null);
  const [timeSeriesData, setTimeSeriesData] =
    useState<TimeSeriesData | null>(null);
  const [isTimeSeriesLoading, setIsTimeSeriesLoading] = useState(false);
  const didInitialFetch = useRef(false);

  const fetchSummary = useCallback(
    async (period: string, isRefreshAction = false) => {
      if (isRefreshAction) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const response = await ApiService.getCloudUsageSummary(period);
        setData(response);
      } catch (error: unknown) {
        const errorDetails =
          error instanceof Error ? error.message : String(error);
        console.error("Failed to fetch cloud usage summary:", errorDetails);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!didInitialFetch.current) {
      didInitialFetch.current = true;
      fetchSummary(selectedPeriod);
    }
  }, [fetchSummary, selectedPeriod]);

  const handlePeriodChange = useCallback(
    (newPeriod: string) => {
      setSelectedPeriod(newPeriod);
      setExpandedServiceIdentifier(null);
      setTimeSeriesData(null);
      fetchSummary(newPeriod);
    },
    [fetchSummary],
  );

  const handleRefresh = useCallback(() => {
    fetchSummary(selectedPeriod, true);
  }, [fetchSummary, selectedPeriod]);

  const handleCardToggle = useCallback(
    async (serviceIdentifier: string) => {
      if (expandedServiceIdentifier === serviceIdentifier) {
        setExpandedServiceIdentifier(null);
        setTimeSeriesData(null);
        return;
      }

      setExpandedServiceIdentifier(serviceIdentifier);
      setIsTimeSeriesLoading(true);

      try {
        const response = await ApiService.getCloudUsageTimeSeries(
          serviceIdentifier,
          selectedPeriod,
        );
        setTimeSeriesData(response);
      } catch (error: unknown) {
        const errorDetails =
          error instanceof Error ? error.message : String(error);
        console.error("Failed to fetch time series:", errorDetails);
        setTimeSeriesData(null);
      } finally {
        setIsTimeSeriesLoading(false);
      }
    },
    [expandedServiceIdentifier, selectedPeriod],
  );

  // ── Loading State ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <>
        <PageHeaderComponent
          title="Cloud Usage"
          subtitle="Google Cloud API consumption metrics"
        />
        <div className={styles["loading-container"]}>
          <LoadingIndicatorComponent />
        </div>
      </>
    );
  }

  // ── Empty State ─────────────────────────────────────────────────

  if (!data || data.services.length === 0) {
    return (
      <>
        <PageHeaderComponent
          title="Cloud Usage"
          subtitle="Google Cloud API consumption metrics"
          actions={
            <ButtonComponent
              variant="outlined"
              compact
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                size={14}
                style={{
                  animation: isRefreshing
                    ? "spin 1s linear infinite"
                    : "none",
                }}
              />
              Refresh
            </ButtonComponent>
          }
        />
        <div className={styles["empty-state-container"]}>
          <Cloud size={48} className={styles["empty-state-icon"]} />
          <div className={styles["empty-state-title"]}>
            No API Usage Data
          </div>
          <div className={styles["empty-state-description"]}>
            No Google Cloud API requests were recorded for the selected
            period. Usage data may take a few minutes to appear after API
            calls are made.
          </div>
        </div>
      </>
    );
  }

  // ── Main Render ─────────────────────────────────────────────────

  return (
    <>
      <PageHeaderComponent
        title="Cloud Usage"
        subtitle={`Google Cloud API consumption · Project: ${data.projectId}`}
        actions={
          <ButtonComponent
            variant="outlined"
            compact
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              size={14}
              style={{
                animation: isRefreshing
                  ? "spin 1s linear infinite"
                  : "none",
              }}
            />
            Refresh
          </ButtonComponent>
        }
      />

      {/* ── Summary + Period Selector ── */}
      <div className={styles["summary-header-container"]}>
        <div className={styles["summary-stat-card"]}>
          <span className={styles["summary-stat-label"]}>Total Requests</span>
          <span className={styles["summary-stat-value-accent"]}>
            {formatNumber(data.totalRequests)}
          </span>
        </div>

        <div className={styles["summary-stat-card"]}>
          <span className={styles["summary-stat-label"]}>Total Errors</span>
          <span className={styles["summary-stat-value-error"]}>
            {formatNumber(data.totalErrors)}
          </span>
        </div>

        <div className={styles["summary-stat-card"]}>
          <span className={styles["summary-stat-label"]}>Active APIs</span>
          <span className={styles["summary-stat-value"]}>
            {data.services.length}
          </span>
        </div>

        <div className={styles["period-selector-container"]}>
          <SegmentedControlComponent
            options={PERIOD_OPTIONS}
            value={selectedPeriod}
            onChange={handlePeriodChange}
            compact
          />
        </div>
      </div>

      {/* ── API Cards ── */}
      <div className={styles["api-cards-grid"]}>
        {data.services.map((apiService) => {
          const isExpanded =
            expandedServiceIdentifier === apiService.serviceIdentifier;
          const successPercent =
            apiService.totalRequests > 0
              ? (apiService.successRequests / apiService.totalRequests) * 100
              : 100;
          const errorPercent = 100 - successPercent;

          return (
            <div
              key={apiService.serviceIdentifier}
              className={`${styles["api-card-container"]} ${isExpanded ? styles["is-expanded-state"] : ""}`}
              onClick={() =>
                handleCardToggle(apiService.serviceIdentifier)
              }
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleCardToggle(apiService.serviceIdentifier);
                }
              }}
            >
              {/* ── Header ── */}
              <div className={styles["api-card-header-row"]}>
                <div className={styles["api-card-icon-wrapper"]}>
                  <span style={{ fontSize: "1.25rem" }}>
                    {getCategoryIcon(apiService.category)}
                  </span>
                </div>

                <div className={styles["api-card-title-group"]}>
                  <span className={styles["api-card-name"]}>
                    {apiService.displayName}
                  </span>
                  <span className={styles["api-card-category-label"]}>
                    {apiService.category}
                  </span>
                </div>

                <ChevronDown
                  size={16}
                  className={`${styles["api-card-expand-indicator"]} ${isExpanded ? styles["is-expanded-state"] : ""}`}
                />
              </div>

              {/* ── Metrics ── */}
              <div className={styles["api-card-metrics-row"]}>
                <div className={styles["metric-block"]}>
                  <span className={styles["metric-label"]}>Requests</span>
                  <span className={styles["metric-value"]}>
                    {formatNumber(apiService.totalRequests)}
                  </span>
                </div>

                <div className={styles["metric-block"]}>
                  <span className={styles["metric-label"]}>Success</span>
                  <span className={styles["metric-value-success"]}>
                    {formatNumber(apiService.successRequests)}
                  </span>
                </div>

                {apiService.errorRequests > 0 && (
                  <div className={styles["metric-block"]}>
                    <span className={styles["metric-label"]}>Errors</span>
                    <span className={styles["metric-value-error"]}>
                      {formatNumber(apiService.errorRequests)}
                    </span>
                  </div>
                )}

                {apiService.errorRate > 0 && (
                  <div className={styles["metric-block"]}>
                    <span className={styles["metric-label"]}>Error Rate</span>
                    <span className={styles["metric-value-error"]}>
                      {formatPercent(apiService.errorRate)}
                    </span>
                  </div>
                )}
              </div>

              {/* ── Success/Error Bar ── */}
              <div className={styles["success-error-bar-container"]}>
                <div
                  className={styles["success-bar-segment"]}
                  style={{ width: `${successPercent}%` }}
                />
                {errorPercent > 0 && (
                  <div
                    className={styles["error-bar-segment"]}
                    style={{ width: `${errorPercent}%` }}
                  />
                )}
              </div>

              {/* ── Sparkline ── */}
              <SparklineSvg data={apiService.dailySeries} />

              {/* ── Footer ── */}
              <div className={styles["api-card-footer-row"]}>
                <BadgeComponent>
                  <Server size={10} />
                  {apiService.consumer}
                </BadgeComponent>

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
              </div>

              {/* ── Expanded Detail ── */}
              {isExpanded && (
                <div className={styles["expanded-detail-panel"]}>
                  {isTimeSeriesLoading ? (
                    <div className={styles["loading-container"]}>
                      <LoadingIndicatorComponent />
                    </div>
                  ) : timeSeriesData &&
                    timeSeriesData.serviceIdentifier ===
                      apiService.serviceIdentifier ? (
                    <DetailChartSvg data={timeSeriesData.series} />
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
