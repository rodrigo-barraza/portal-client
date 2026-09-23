"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ChartColumn,
  CircleCheck,
  Cloud,
  Layers,
  RefreshCw,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import {
  ButtonComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
  SegmentedControlComponent,
} from "@rodrigo-barraza/components-library";
import { formatCompact } from "@rodrigo-barraza/utilities-library";

import { StatCard, BarListPanel, DonutPanel, TrendsPanel } from "./AnalyticsPrimitives";
import { ApiCard, ERROR_COLOR, SUCCESS_COLOR } from "./external-apis/ApiCard";
import { getCategoryMeta } from "./external-apis/categoryMeta";
import {
  buildDateRange,
  combineDailySeries,
  formatPercentValue,
  PERIOD_OPTIONS,
  periodToDays,
  toCategorySegments,
} from "./external-apis/externalApiUsage";
import { useExternalApiSummary, useExternalApiTimeSeries } from "./external-apis/useExternalApiUsage";
import webStyles from "./WebAnalytics.module.css";
import styles from "./ExternalApisComponent.module.css";

const TOTAL_COLOR = "#6366f1";
const TREND_METRICS = [{ key: "requests", label: "Requests", color: TOTAL_COLOR }];

export default function ExternalApisComponent() {
  const [selectedPeriod, setSelectedPeriod] = useState("30d");
  const [expandedServiceIdentifier, setExpandedServiceIdentifier] = useState<string | null>(null);

  const { data, error, isLoading, isRefreshing, refresh } = useExternalApiSummary(selectedPeriod);
  const timeSeries = useExternalApiTimeSeries(expandedServiceIdentifier, selectedPeriod);

  // The date axis for every chart on the page; recomputed per summary so
  // a page left open across midnight rolls over on the next load.
  const dates = useMemo(
    () => buildDateRange(periodToDays(data?.period ?? selectedPeriod), Date.parse(data?.fetchedAt ?? "") || undefined),
    [data, selectedPeriod],
  );

  const handlePeriodChange = useCallback((period: string) => {
    setSelectedPeriod(period);
    setExpandedServiceIdentifier(null);
  }, []);

  const handleCardToggle = useCallback((serviceIdentifier: string) => {
    setExpandedServiceIdentifier((current) => (current === serviceIdentifier ? null : serviceIdentifier));
  }, []);

  const services = useMemo(() => data?.services ?? [], [data]);
  const trendSeries = useMemo(() => combineDailySeries(services, dates), [services, dates]);
  const categorySegments = useMemo(
    () => toCategorySegments(services, (category) => getCategoryMeta(category).color),
    [services],
  );
  const requestBars = useMemo(
    () =>
      services.map((service) => ({
        key: service.serviceIdentifier,
        label: service.displayName,
        value: service.totalRequests,
      })),
    [services],
  );

  const totalRequests = data?.totalRequests ?? 0;
  const totalErrors = data?.totalErrors ?? 0;
  const overallErrorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
  const unreachable = [...(data?.unreachableSources ?? []), ...(data?.unreachableProjectIds ?? [])];

  const header = (
    <PageHeaderComponent
      sticky={false}
      title="External APIs"
      subtitle={
        data
          ? "Third-party API consumption · Google Cloud, LLM providers & tools-service"
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
          onClick={refresh}
          disabled={isRefreshing || isLoading}
        >
          Refresh
        </ButtonComponent>
      </div>
    </PageHeaderComponent>
  );

  if (isLoading) {
    return (
      <div className={`external-apis-component ${webStyles["dashboard"]}`}>
        {header}
        <LoadingIndicatorComponent
          size="small"
          label="Loading external API usage…"
          className="is-loading-centered-state"
        />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={`external-apis-component ${webStyles["dashboard"]}`}>
        {header}
        <div className={webStyles["empty-state"]}>
          <TriangleAlert size={32} strokeWidth={1.5} className={webStyles["empty-icon"]} />
          <span className={webStyles["empty-title"]}>Couldn&apos;t load external API usage</span>
          <span className={webStyles["empty-detail"]}>{error}</span>
          <ButtonComponent
            variant="outlined"
            size="small"
            icon={RefreshCw}
            loading={isRefreshing}
            onClick={refresh}
          >
            Retry
          </ButtonComponent>
        </div>
      </div>
    );
  }

  // Sources that failed are left out of every number below — say so,
  // rather than presenting partial totals as complete.
  const partialNotice = unreachable.length > 0 && (
    <div className={styles["partial-data-notice"]} role="status">
      <TriangleAlert size={14} />
      <span>
        Some usage sources couldn&apos;t be reached, so these totals are incomplete:{" "}
        {unreachable.join(", ")}
      </span>
    </div>
  );

  if (services.length === 0) {
    return (
      <div className={`external-apis-component ${webStyles["dashboard"]}`}>
        {header}
        {partialNotice}
        <div className={webStyles["empty-state"]}>
          <Cloud size={32} strokeWidth={1.5} className={webStyles["empty-icon"]} />
          <span className={webStyles["empty-title"]}>No API usage data</span>
          <span className={webStyles["empty-detail"]}>
            No external API requests were recorded for the selected period.
            Usage data may take a few minutes to appear after API calls are made.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`external-apis-component ${webStyles["dashboard"]}`}>
      {header}
      {partialNotice}
      {error && (
        <div className={styles["partial-data-notice"]} role="status">
          <TriangleAlert size={14} />
          <span>Refresh failed — showing the previous data. {error}</span>
        </div>
      )}

      <div className={webStyles["summary-grid"]}>
        <StatCard
          icon={Cloud}
          label="Total Requests"
          value={formatCompact(totalRequests)}
          sub={`last ${selectedPeriod}`}
          color={TOTAL_COLOR}
          delay={0}
        />
        <StatCard
          icon={CircleCheck}
          label="Successful"
          value={formatCompact(totalRequests - totalErrors)}
          sub={formatPercentValue(1 - overallErrorRate)}
          color={SUCCESS_COLOR}
          delay={50}
        />
        <StatCard
          icon={TriangleAlert}
          label="Errors"
          value={formatCompact(totalErrors)}
          sub={`${formatPercentValue(overallErrorRate)} error rate`}
          color={ERROR_COLOR}
          delay={100}
        />
        <StatCard
          icon={Layers}
          label="Active APIs"
          value={services.length}
          sub={`of ${categorySegments.length} categories`}
          color="#8b5cf6"
          delay={150}
        />
      </div>

      <TrendsPanel
        icon={TrendingUp}
        title="Daily Requests"
        series={trendSeries as unknown as Record<string, unknown>[]}
        metrics={TREND_METRICS}
      />

      <div className={webStyles["content-grid"]}>
        <BarListPanel
          icon={ChartColumn}
          title="Requests by API"
          meta={`${services.length} APIs`}
          bars={requestBars}
          suffix=" requests"
          limit={services.length}
        />
        <DonutPanel
          icon={Layers}
          title="Requests by Category"
          segments={categorySegments}
          centerLabel="Requests"
          suffix=" requests"
        />
      </div>

      <div className={styles["api-cards-grid"]}>
        {services.map((service) => {
          const isExpanded = expandedServiceIdentifier === service.serviceIdentifier;
          return (
            <ApiCard
              key={service.serviceIdentifier}
              apiService={service}
              dates={dates}
              isExpanded={isExpanded}
              timeSeries={isExpanded ? timeSeries.data : null}
              isTimeSeriesLoading={isExpanded && timeSeries.isLoading}
              timeSeriesFailed={isExpanded && timeSeries.failed}
              onToggle={handleCardToggle}
            />
          );
        })}
      </div>
    </div>
  );
}
