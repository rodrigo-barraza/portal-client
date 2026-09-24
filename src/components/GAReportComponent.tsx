"use client";

import { useMemo } from "react";
import {
  LoadingIndicatorComponent,
  TableComponent,
} from "@rodrigo-barraza/components-library";
import {
  Activity,
  ChartColumn,
  Clock,
  Eye,
  Globe,
  Laptop,
  Layers,
  Link2,
  MapPin,
  Monitor,
  MousePointerClick,
  RefreshCw,
  Ruler,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import ApiService from "../services/ApiService";
import {
  formatElapsedTime,
  formatCompact,
} from "@rodrigo-barraza/utilities-library";
import {
  SPARKLINE_COLORS,
  StatCard,
  DonutPanel,
  BarListPanel,
  TrendsPanel,
  RealtimeBanner,
} from "./AnalyticsPrimitives";
import HourlyHeatmapComponent from "./analytics/HourlyHeatmapComponent";
import useAsyncData, { settleReports } from "./analytics/useAsyncData";
import {
  formatLocation,
  formatRatioPercent,
  joinMeta,
  readableErrorMessage,
} from "./analytics/analyticsFormat";
import {
  fillDailySeries,
  gaHourlyCells,
  gaOverviewDelta,
  gaSeriesWindow,
  newVsReturningSegments,
  toDonutSegments,
} from "./analytics/analyticsSeries";
import styles from "./WebAnalytics.module.css";
import type {
  GAProperty,
  GAPageRow,
  GALandingPageRow,
  GAReportsByName,
  GATimeSeriesPoint,
} from "../types/portal";

const REALTIME_REFRESH_MS = 15_000;

interface GAReports {
  overview: GAReportsByName["overview"];
  pages: GAReportsByName["pages"];
  sources: GAReportsByName["sources"];
  geography: GAReportsByName["geography"];
  devices: GAReportsByName["devices"];
  timeSeries: GAReportsByName["timeseries"];
  channels: GAReportsByName["channels"];
  landingPages: GAReportsByName["landing-pages"];
  heatmap: GAReportsByName["heatmap"];
  newVsReturning: GAReportsByName["new-vs-returning"];
  events: GAReportsByName["events"];
}

function loadGAReports(
  propertyId: string,
  period: string,
  signal: AbortSignal,
) {
  const options = { signal };
  return settleReports<GAReports>({
    overview: ApiService.getGAOverview(propertyId, period, options),
    pages: ApiService.getGAPages(propertyId, period, options),
    sources: ApiService.getGASources(propertyId, period, options),
    geography: ApiService.getGAGeography(propertyId, period, options),
    devices: ApiService.getGADevices(propertyId, period, options),
    timeSeries: ApiService.getGATimeSeries(propertyId, period, options),
    channels: ApiService.getGAChannels(propertyId, period, options),
    landingPages: ApiService.getGALandingPages(propertyId, period, options),
    heatmap: ApiService.getGAHeatmap(propertyId, period, options),
    newVsReturning: ApiService.getGANewVsReturning(propertyId, period, options),
    events: ApiService.getGAEvents(propertyId, period, options),
  });
}

const TREND_METRICS = [
  { key: "pageviews", label: "Pageviews", color: SPARKLINE_COLORS.pageviews },
  { key: "users", label: "Users", color: SPARKLINE_COLORS.users },
  { key: "sessions", label: "Sessions", color: SPARKLINE_COLORS.sessions },
];

const pageColumns = [
  {
    key: "pagePath",
    label: "Page",
    render: (row: GAPageRow) => (
      <span className={styles["mono-cell"]} title={row.pageTitle || undefined}>
        {row.pagePath}
      </span>
    ),
  },
  {
    key: "pageviews",
    label: "Views",
    align: "right" as const,
    render: (row: GAPageRow) => formatCompact(row.pageviews),
  },
  {
    key: "users",
    label: "Users",
    align: "right" as const,
    render: (row: GAPageRow) => formatCompact(row.users),
  },
  {
    key: "avgDuration",
    label: "Avg Duration",
    align: "right" as const,
    render: (row: GAPageRow) => formatElapsedTime(row.avgDuration),
  },
  {
    key: "bounceRate",
    label: "Bounce",
    align: "right" as const,
    render: (row: GAPageRow) => formatRatioPercent(row.bounceRate),
  },
];

const landingColumns = [
  {
    key: "landingPage",
    label: "Landing Page",
    render: (row: GALandingPageRow) => (
      <span className={styles["mono-cell"]}>{row.landingPage}</span>
    ),
  },
  {
    key: "sessions",
    label: "Sessions",
    align: "right" as const,
    render: (row: GALandingPageRow) => formatCompact(row.sessions),
  },
  {
    key: "users",
    label: "Users",
    align: "right" as const,
    render: (row: GALandingPageRow) => formatCompact(row.users),
  },
  {
    key: "avgDuration",
    label: "Avg Duration",
    align: "right" as const,
    render: (row: GALandingPageRow) => formatElapsedTime(row.avgDuration),
  },
  {
    key: "bounceRate",
    label: "Bounce",
    align: "right" as const,
    render: (row: GALandingPageRow) => formatRatioPercent(row.bounceRate),
  },
];

/**
 * GAReportComponent — the Google Analytics (GA4) report body for one
 * property: realtime banner, overview cards, trends, tables, heatmap,
 * and breakdown panels. Header/period controls live in the parent
 * PropertyDashboardComponent.
 */
export default function GAReportComponent({
  property,
  period,
}: {
  property: GAProperty;
  period: string;
}) {
  const reports = useAsyncData(`${property.id}|${period}`, (signal) =>
    loadGAReports(property.id, period, signal),
  );
  const realtime = useAsyncData(
    property.id,
    (signal) => ApiService.getGARealtime(property.id, { signal }),
    { refreshIntervalMs: REALTIME_REFRESH_MS },
  );

  const values = reports.data?.values;
  const devices = values?.devices;

  const trendSeries = useMemo(
    () =>
      fillDailySeries(
        values?.timeSeries?.series ?? [],
        (date): GATimeSeriesPoint => ({
          date,
          pageviews: 0,
          users: 0,
          sessions: 0,
        }),
        gaSeriesWindow(period),
      ),
    [values?.timeSeries, period],
  );

  const deviceSegments = useMemo(
    () =>
      toDonutSegments(
        devices?.categories,
        (row) => row.category,
        (row) => row.sessions,
      ),
    [devices],
  );
  const browserSegments = useMemo(
    () =>
      toDonutSegments(
        devices?.browsers,
        (row) => row.browser,
        (row) => row.sessions,
        3,
      ),
    [devices],
  );
  const osSegments = useMemo(
    () =>
      toDonutSegments(
        devices?.operatingSystems,
        (row) => row.os,
        (row) => row.sessions,
        5,
      ),
    [devices],
  );
  const nvrSegments = useMemo(
    () => newVsReturningSegments(values?.newVsReturning?.segments),
    [values?.newVsReturning],
  );

  const banner = (
    <RealtimeBanner
      label="Active Users Right Now"
      count={realtime.data ? realtime.data.activeUsers : null}
      meta={joinMeta(property.label, property.measurementId)}
    />
  );

  if (reports.loading) {
    return (
      <>
        {banner}
        <LoadingIndicatorComponent
          size="small"
          label="Loading analytics…"
          className="is-loading-centered-state"
        />
      </>
    );
  }

  if (!values || reports.data?.allFailed) {
    const message = readableErrorMessage(
      reports.error ?? reports.data?.firstError,
    );
    return (
      <>
        {banner}
        <div className={styles["empty-state"]} role="alert">
          <ChartColumn
            size={40}
            strokeWidth={1.5}
            className={styles["empty-icon"]}
          />
          <span className={styles["empty-title"]}>
            Google Analytics reports unavailable
          </span>
          {message && <span className={styles["empty-detail"]}>{message}</span>}
        </div>
      </>
    );
  }

  const {
    overview,
    pages,
    landingPages,
    heatmap,
    channels,
    sources,
    geography,
    events,
  } = values;

  return (
    <>
      {banner}

      {/* ── Overview Cards ────────────────────────────────── */}
      {overview && (
        <div className={styles["summary-grid"]}>
          <StatCard
            icon={Users}
            label="Total Users"
            value={formatCompact(overview.totalUsers)}
            sub={`${formatCompact(overview.newUsers)} new`}
            color="#6366f1"
            delay={0}
            delta={gaOverviewDelta(overview, "totalUsers")}
          />
          <StatCard
            icon={Eye}
            label="Pageviews"
            value={formatCompact(overview.pageviews)}
            color="#8b5cf6"
            delay={50}
            delta={gaOverviewDelta(overview, "pageviews")}
          />
          <StatCard
            icon={Activity}
            label="Sessions"
            value={formatCompact(overview.sessions)}
            sub={`${formatCompact(overview.engagedSessions)} engaged`}
            color="#10b981"
            delay={100}
            delta={gaOverviewDelta(overview, "sessions")}
          />
          <StatCard
            icon={Clock}
            label="Avg Duration"
            value={formatElapsedTime(overview.avgSessionDuration)}
            color="#3b82f6"
            delay={150}
            delta={gaOverviewDelta(overview, "avgSessionDuration")}
          />
          <StatCard
            icon={MousePointerClick}
            label="Engagement"
            value={formatRatioPercent(overview.engagementRate)}
            sub={`${formatRatioPercent(overview.bounceRate)} bounce`}
            color="#f59e0b"
            delay={200}
            delta={gaOverviewDelta(overview, "engagementRate")}
          />
        </div>
      )}

      {/* ── Daily Trends ──────────────────────────────────── */}
      <TrendsPanel
        icon={TrendingUp}
        title="Daily Trends"
        series={trendSeries as unknown as Record<string, unknown>[]}
        metrics={TREND_METRICS}
      />

      {/* ── Top Pages ────────────────────────────────────── */}
      {(pages?.pages?.length ?? 0) > 0 && (
        <TableComponent
          title="Top Pages"
          columns={pageColumns}
          data={pages!.pages}
          // GA groups by path AND title, so one path can appear twice
          getRowKey={(row: GAPageRow, index: number) =>
            `${row.pagePath}\u0000${row.pageTitle}\u0000${index}`
          }
          emptyText="No page data available"
          mini
        />
      )}

      {/* ── Landing Pages ─────────────────────────────────── */}
      {(landingPages?.pages?.length ?? 0) > 0 && (
        <TableComponent
          title="Landing Pages"
          columns={landingColumns}
          data={landingPages!.pages}
          getRowKey={(row: GALandingPageRow, index: number) =>
            `${row.landingPage}\u0000${index}`
          }
          emptyText="No landing page data"
          mini
        />
      )}

      {/* ── Hourly Traffic Heatmap ────────────────────────── */}
      {heatmap?.cells && (
        <HourlyHeatmapComponent cells={gaHourlyCells(heatmap.cells)} />
      )}

      {/* ── Channels + Sources ─────────────────────────────── */}
      <div className={styles["content-grid"]}>
        <BarListPanel
          icon={Layers}
          title="Channel Grouping"
          meta={
            channels?.channels?.length
              ? `${channels.channels.length} channels`
              : undefined
          }
          bars={(channels?.channels ?? []).map((channel) => ({
            key: channel.channel,
            label: channel.channel,
            value: channel.sessions,
          }))}
        />
        <BarListPanel
          icon={Link2}
          title="Traffic Sources"
          meta={
            sources?.sources?.length
              ? `${sources.sources.length} sources`
              : undefined
          }
          bars={(sources?.sources ?? []).map((source) => ({
            key: `${source.source}-${source.medium}`,
            label: `${source.source} / ${source.medium}`,
            value: source.sessions,
          }))}
        />
      </div>

      {/* ── Geography + Events ─────────────────────────────── */}
      <div className={styles["content-grid"]}>
        <BarListPanel
          icon={MapPin}
          title="Top Locations"
          meta={
            geography?.locations?.length
              ? `${geography.locations.length} locations`
              : undefined
          }
          bars={(geography?.locations ?? []).map((location) => ({
            key: `${location.country}-${location.city}`,
            label: formatLocation(location, "(not set)"),
            value: location.users,
          }))}
          colorOffset={4}
          suffix=" users"
        />
        <BarListPanel
          icon={Zap}
          title="Top Events"
          meta={
            events?.events?.length
              ? `${events.events.length} events`
              : undefined
          }
          bars={(events?.events ?? []).map((event) => ({
            key: event.eventName,
            label: event.eventName,
            value: event.eventCount,
          }))}
          colorOffset={2}
          limit={events?.events?.length || 10}
        />
      </div>

      {/* ── Devices + Browsers ─────────────────────────────── */}
      <div className={styles["content-grid"]}>
        <DonutPanel
          icon={Monitor}
          title="Device Categories"
          segments={deviceSegments}
        />
        <DonutPanel icon={Globe} title="Browsers" segments={browserSegments} />
      </div>

      {/* ── OS + New vs Returning ──────────────────────────── */}
      <div className={styles["content-grid"]}>
        <DonutPanel
          icon={Laptop}
          title="Operating Systems"
          segments={osSegments}
        />
        <DonutPanel
          icon={RefreshCw}
          title="New vs Returning"
          segments={nvrSegments}
          centerLabel="Users"
          suffix=" users"
        />
      </div>

      {/* ── Screen Resolutions ─────────────────────────────── */}
      <BarListPanel
        icon={Ruler}
        title="Screen Resolutions"
        meta={
          devices?.screenResolutions?.length
            ? `${devices.screenResolutions.length} resolutions`
            : undefined
        }
        bars={(devices?.screenResolutions ?? []).map((resolution) => ({
          key: resolution.resolution,
          label: resolution.resolution,
          value: resolution.sessions,
        }))}
        colorOffset={1}
        suffix=" sessions"
        limit={devices?.screenResolutions?.length || 10}
      />
    </>
  );
}
