"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Cloud,
  ExternalLink,
  Layers,
  Leaf,
  MapPin,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  BadgeComponent,
  ButtonComponent,
  ChartLineComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
  SegmentedControlComponent,
} from "@rodrigo-barraza/components-library";
import { formatNumber } from "@rodrigo-barraza/utilities-library";

import ApiService from "../services/ApiService";
import { StatCard, BarListPanel, DonutPanel, TrendsPanel } from "./AnalyticsPrimitives";
import webStyles from "./WebAnalytics.module.css";
import styles from "./ExternalApisComponent.module.css";

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

interface ExternalApiUsageData {
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

// ── Constants ──────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: "7d", label: "7d" },
  { value: "14d", label: "14d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

const SUCCESS_COLOR = "#10b981";
const ERROR_COLOR = "#ef4444";

interface CategoryMeta {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  color: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  "AI / LLM": { icon: Sparkles, color: "#ec4899" },
  "Maps & Location": { icon: MapPin, color: "#6366f1" },
  Environmental: { icon: Leaf, color: "#10b981" },
  Search: { icon: Search, color: "#f59e0b" },
  Media: { icon: Clapperboard, color: "#ef4444" },
  Productivity: { icon: CalendarDays, color: "#3b82f6" },
  Analytics: { icon: BarChart3, color: "#8b5cf6" },
};

const DEFAULT_CATEGORY_META: CategoryMeta = { icon: Cloud, color: "#14b8a6" };

function getCategoryMeta(category: string): CategoryMeta {
  return CATEGORY_META[category] || DEFAULT_CATEGORY_META;
}

// ── Helpers ────────────────────────────────────────────────────────

function formatPercentValue(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function periodToDays(period: string): number {
  const match = period.match(/^(\d+)d$/);
  return match ? parseInt(match[1], 10) : 30;
}

/** One YYYY-MM-DD string per day, oldest → today (UTC). */
function buildDateRange(days: number): string[] {
  const now = Date.now();
  return Array.from({ length: days }, (_, index) =>
    new Date(now - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10),
  );
}

/**
 * Expand a sparse daily series into one value per day of the period so
 * quiet days render as zero instead of being silently skipped.
 */
function fillDailyValues(
  points: { date: string }[],
  extractor: (point: never) => number,
  days: number,
): number[] {
  const valueByDate = new Map(
    points.map((point) => [point.date, extractor(point as never)]),
  );
  return buildDateRange(days).map((date) => valueByDate.get(date) ?? 0);
}

// ── API Card ───────────────────────────────────────────────────────

function ApiCard({
  apiService,
  periodDays,
  isExpanded,
  isTimeSeriesLoading,
  timeSeriesData,
  onToggle,
}: {
  apiService: ApiUsageSummary;
  periodDays: number;
  isExpanded: boolean;
  isTimeSeriesLoading: boolean;
  timeSeriesData: TimeSeriesData | null;
  onToggle: () => void;
}) {
  const { icon: CategoryIcon, color } = getCategoryMeta(apiService.category);

  const successPercent =
    apiService.totalRequests > 0
      ? (apiService.successRequests / apiService.totalRequests) * 100
      : 100;
  const errorPercent = 100 - successPercent;

  const sparklineValues = useMemo(
    () =>
      fillDailyValues(
        apiService.dailySeries,
        (point: DailySeries) => point.requests,
        periodDays,
      ),
    [apiService.dailySeries, periodDays],
  );

  const detailSeries = useMemo(() => {
    if (!timeSeriesData || timeSeriesData.serviceIdentifier !== apiService.serviceIdentifier)
      return null;
    return {
      success: fillDailyValues(
        timeSeriesData.series,
        (point: TimeSeriesPoint) => point.successRequests,
        periodDays,
      ),
      errors: fillDailyValues(
        timeSeriesData.series,
        (point: TimeSeriesPoint) => point.errorRequests,
        periodDays,
      ),
    };
  }, [timeSeriesData, apiService.serviceIdentifier, periodDays]);

  const hasDetailErrors = detailSeries
    ? detailSeries.errors.some((value) => value > 0)
    : false;

  return (
    <div
      className={`${styles["api-card"]} ${isExpanded ? styles["is-expanded-state"] : ""}`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
    >
      {/* ── Header ── */}
      <div className={styles["api-card-header-row"]}>
        <div
          className={styles["api-card-icon-tile"]}
          style={{ color, background: `${color}15` }}
        >
          <CategoryIcon size={18} strokeWidth={2} />
        </div>

        <div className={styles["api-card-title-group"]}>
          <span className={styles["api-card-name"]}>{apiService.displayName}</span>
          <span className={styles["api-card-service-identifier"]}>
            {apiService.serviceIdentifier}
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
              {formatPercentValue(apiService.errorRate)}
            </span>
          </div>
        )}
      </div>

      {/* ── Success/Error Split ── */}
      <div className={styles["success-error-bar-track"]}>
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
      <div className={styles["sparkline-wrapper"]}>
        <ChartLineComponent
          data={sparklineValues}
          color={color}
          maxValue={Math.max(...sparklineValues, 1)}
          height={48}
          historyMax={sparklineValues.length}
          formatValue={(value: number) => formatNumber(Math.round(value))}
        />
      </div>

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
            <LoadingIndicatorComponent
              size="small"
              label="Loading daily breakdown…"
              className="is-loading-centered-state"
            />
          ) : detailSeries ? (
            <>
              <div className={styles["detail-chart-stack"]}>
                <ChartLineComponent
                  data={detailSeries.success}
                  color={SUCCESS_COLOR}
                  maxValue={Math.max(...detailSeries.success, 1)}
                  height={120}
                  historyMax={detailSeries.success.length}
                  showGrid
                  formatValue={(value: number) => formatNumber(Math.round(value))}
                />
                {hasDetailErrors && (
                  <ChartLineComponent
                    data={detailSeries.errors}
                    color={ERROR_COLOR}
                    maxValue={Math.max(...detailSeries.errors, 1)}
                    height={120}
                    historyMax={detailSeries.errors.length}
                    showGrid
                    formatValue={(value: number) => formatNumber(Math.round(value))}
                  />
                )}
              </div>
              <div className={webStyles["chart-legend"]}>
                <div className={webStyles["chart-legend-item"]}>
                  <div
                    className={webStyles["chart-legend-dot"]}
                    style={{ background: SUCCESS_COLOR }}
                  />
                  Success
                </div>
                {hasDetailErrors && (
                  <div className={webStyles["chart-legend-item"]}>
                    <div
                      className={webStyles["chart-legend-dot"]}
                      style={{ background: ERROR_COLOR }}
                    />
                    Errors
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export default function ExternalApisComponent() {
  const [data, setData] = useState<ExternalApiUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("30d");
  const [expandedServiceIdentifier, setExpandedServiceIdentifier] = useState<
    string | null
  >(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData | null>(null);
  const [isTimeSeriesLoading, setIsTimeSeriesLoading] = useState(false);
  const didInitialFetch = useRef(false);

  const periodDays = periodToDays(selectedPeriod);

  const fetchSummary = useCallback(
    async (period: string, isRefreshAction = false) => {
      if (isRefreshAction) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const response = await ApiService.getExternalApiUsageSummary(period);
        setData(response);
        setLoadError(null);
      } catch (error: unknown) {
        const errorDetails = error instanceof Error ? error.message : String(error);
        console.error("Failed to fetch cloud usage summary:", errorDetails);
        setLoadError(errorDetails);
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
        const response = await ApiService.getExternalApiUsageTimeSeries(
          serviceIdentifier,
          selectedPeriod,
        );
        setTimeSeriesData(response);
      } catch (error: unknown) {
        const errorDetails = error instanceof Error ? error.message : String(error);
        console.error("Failed to fetch time series:", errorDetails);
        setTimeSeriesData(null);
      } finally {
        setIsTimeSeriesLoading(false);
      }
    },
    [expandedServiceIdentifier, selectedPeriod],
  );

  // ── Derived Data ────────────────────────────────────────────────

  // Total daily requests across every tracked API — one point per day.
  const combinedTrendSeries = useMemo(() => {
    if (!data) return [];
    const totalsByDate = new Map<string, number>();
    for (const apiService of data.services) {
      for (const point of apiService.dailySeries) {
        totalsByDate.set(
          point.date,
          (totalsByDate.get(point.date) || 0) + point.requests,
        );
      }
    }
    return buildDateRange(periodDays).map((date) => ({
      date,
      requests: totalsByDate.get(date) ?? 0,
    }));
  }, [data, periodDays]);

  const categorySegments = useMemo(() => {
    if (!data) return [];
    const totalsByCategory = new Map<string, number>();
    for (const apiService of data.services) {
      totalsByCategory.set(
        apiService.category,
        (totalsByCategory.get(apiService.category) || 0) + apiService.totalRequests,
      );
    }
    return Array.from(totalsByCategory.entries())
      .sort((first, second) => second[1] - first[1])
      .map(([category, value]) => ({
        label: category,
        value,
        color: getCategoryMeta(category).color,
      }));
  }, [data]);

  const requestBars = useMemo(
    () =>
      (data?.services || []).map((apiService) => ({
        key: apiService.serviceIdentifier,
        label: apiService.displayName,
        value: apiService.totalRequests,
      })),
    [data],
  );

  const totalSuccessRequests = data ? data.totalRequests - data.totalErrors : 0;
  const overallErrorRate =
    data && data.totalRequests > 0 ? data.totalErrors / data.totalRequests : 0;

  // ── Header ──────────────────────────────────────────────────────

  const header = (
    <PageHeaderComponent
      sticky={false}
      title="External APIs"
      subtitle={
        data
          ? `Third-party API consumption · Google Cloud (${data.projectId})`
          : "Third-party API consumption metrics"
      }
    >
      <div className={webStyles["header-controls"]}>
        <SegmentedControlComponent
          segments={PERIOD_OPTIONS}
          value={selectedPeriod}
          onChange={handlePeriodChange}
          compact
        />
        <ButtonComponent
          variant="outlined"
          size="small"
          icon={RefreshCw}
          loading={isRefreshing}
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          Refresh
        </ButtonComponent>
      </div>
    </PageHeaderComponent>
  );

  // ── Loading State ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={`external-apis-component ${webStyles["dashboard"]}`}>
        {header}
        <LoadingIndicatorComponent
          size="small"
          label="Loading cloud usage…"
          className="is-loading-centered-state"
        />
      </div>
    );
  }

  // ── Error State ─────────────────────────────────────────────────

  if (loadError && !data) {
    return (
      <div className={`external-apis-component ${webStyles["dashboard"]}`}>
        {header}
        <div className={webStyles["empty-state"]}>
          <AlertTriangle size={32} strokeWidth={1.5} className={webStyles["empty-icon"]} />
          <span className={webStyles["empty-title"]}>Couldn&apos;t load cloud usage</span>
          <span className={webStyles["empty-detail"]}>{loadError}</span>
          <ButtonComponent
            variant="outlined"
            size="small"
            icon={RefreshCw}
            onClick={() => fetchSummary(selectedPeriod)}
          >
            Retry
          </ButtonComponent>
        </div>
      </div>
    );
  }

  // ── Empty State ─────────────────────────────────────────────────

  if (!data || data.services.length === 0) {
    return (
      <div className={`external-apis-component ${webStyles["dashboard"]}`}>
        {header}
        <div className={webStyles["empty-state"]}>
          <Cloud size={32} strokeWidth={1.5} className={webStyles["empty-icon"]} />
          <span className={webStyles["empty-title"]}>No API usage data</span>
          <span className={webStyles["empty-detail"]}>
            No Google Cloud API requests were recorded for the selected period.
            Usage data may take a few minutes to appear after API calls are made.
          </span>
        </div>
      </div>
    );
  }

  // ── Main Render ─────────────────────────────────────────────────

  return (
    <div className={`external-apis-component ${webStyles["dashboard"]}`}>
      {header}

      {/* ── Overview Cards ── */}
      <div className={webStyles["summary-grid"]}>
        <StatCard
          icon={Cloud}
          label="Total Requests"
          value={formatNumber(data.totalRequests)}
          sub={`last ${selectedPeriod}`}
          color="#6366f1"
          delay={0}
        />
        <StatCard
          icon={CheckCircle2}
          label="Successful"
          value={formatNumber(totalSuccessRequests)}
          sub={formatPercentValue(1 - overallErrorRate)}
          color={SUCCESS_COLOR}
          delay={50}
        />
        <StatCard
          icon={AlertTriangle}
          label="Errors"
          value={formatNumber(data.totalErrors)}
          sub={`${formatPercentValue(overallErrorRate)} error rate`}
          color={ERROR_COLOR}
          delay={100}
        />
        <StatCard
          icon={Layers}
          label="Active APIs"
          value={data.services.length}
          sub={`of ${categorySegments.length} categories`}
          color="#8b5cf6"
          delay={150}
        />
      </div>

      {/* ── Daily Trend ── */}
      <TrendsPanel
        icon={TrendingUp}
        title="Daily Requests"
        series={combinedTrendSeries as unknown as Record<string, unknown>[]}
        metrics={[{ key: "requests", label: "Requests", color: "#6366f1" }]}
      />

      {/* ── Breakdown Panels ── */}
      <div className={webStyles["content-grid"]}>
        <BarListPanel
          icon={BarChart3}
          title="Requests by API"
          meta={`${data.services.length} APIs`}
          bars={requestBars}
          suffix=" requests"
          limit={data.services.length}
        />
        <DonutPanel
          icon={Layers}
          title="Requests by Category"
          segments={categorySegments}
          centerLabel="Requests"
          suffix=" requests"
        />
      </div>

      {/* ── API Cards ── */}
      <div className={styles["api-cards-grid"]}>
        {data.services.map((apiService) => (
          <ApiCard
            key={apiService.serviceIdentifier}
            apiService={apiService}
            periodDays={periodDays}
            isExpanded={expandedServiceIdentifier === apiService.serviceIdentifier}
            isTimeSeriesLoading={isTimeSeriesLoading}
            timeSeriesData={timeSeriesData}
            onToggle={() => handleCardToggle(apiService.serviceIdentifier)}
          />
        ))}
      </div>
    </div>
  );
}
