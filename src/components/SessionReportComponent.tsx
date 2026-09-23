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
  Link2,
  MapPin,
  Monitor,
  MousePointerClick,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import ApiService from "../services/ApiService";
import SessionExplorerComponent from "./SessionExplorerComponent";
import HeatmapPanelComponent from "./HeatmapPanelComponent";
import { formatCompact } from "@rodrigo-barraza/utilities-library";
import {
  SPARKLINE_COLORS,
  StatCard,
  DonutPanel,
  BarListPanel,
  TrendsPanel,
  RealtimeBanner,
} from "./AnalyticsPrimitives";
import useAsyncData, { settleReports, unwrapData } from "./analytics/useAsyncData";
import {
  formatDurationMs,
  formatLocation,
  formatWholePercent,
  joinMeta,
  readableErrorMessage,
} from "./analytics/analyticsFormat";
import {
  fillDailySeries,
  sessionsSeriesWindow,
  toDonutSegments,
} from "./analytics/analyticsSeries";
import styles from "./WebAnalytics.module.css";
import type {
  SessionOverview,
  SessionPageRow,
  SessionReferrerRow,
  SessionGeoRow,
  SessionDeviceBreakdown,
  SessionTimeSeriesPoint,
  SessionTopEvent,
  SessionLiveResponse,
} from "../types/portal";

const LIVE_REFRESH_MS = 15_000;
/** Page paths offered in the heatmap's page picker. */
const HEATMAP_PATH_LIMIT = 30;

interface SessionReports {
  overview: SessionOverview;
  pages: SessionPageRow[];
  referrers: SessionReferrerRow[];
  geo: SessionGeoRow[];
  devices: SessionDeviceBreakdown;
  timeSeries: SessionTimeSeriesPoint[];
  events: SessionTopEvent[];
}

function loadSessionReports(projectId: string, period: string) {
  const unwrap = <T,>(request: Promise<unknown>) => request.then((response) => unwrapData<T>(response));
  return settleReports<SessionReports>({
    overview: unwrap(ApiService.getSessionOverview(projectId, period)),
    pages: unwrap(ApiService.getSessionPages(projectId, period)),
    referrers: unwrap(ApiService.getSessionReferrers(projectId, period)),
    geo: unwrap(ApiService.getSessionGeo(projectId, period)),
    devices: unwrap(ApiService.getSessionDevices(projectId, period)),
    timeSeries: unwrap(ApiService.getSessionTimeSeries(projectId, period)),
    events: unwrap(ApiService.getSessionEvents(projectId, period)),
  });
}

const TREND_METRICS = [
  { key: "pageViews", label: "Page Views", color: SPARKLINE_COLORS.pageviews },
  { key: "uniqueVisitors", label: "Visitors", color: SPARKLINE_COLORS.users },
  { key: "sessions", label: "Sessions", color: SPARKLINE_COLORS.sessions },
];

const pageColumns = [
  {
    key: "path",
    label: "Page",
    render: (row: SessionPageRow) => <span className={styles["mono-cell"]}>{row.path}</span>,
  },
  {
    key: "views",
    label: "Views",
    align: "right" as const,
    render: (row: SessionPageRow) => formatCompact(row.views),
  },
  {
    key: "uniqueVisitors",
    label: "Visitors",
    align: "right" as const,
    render: (row: SessionPageRow) => formatCompact(row.uniqueVisitors),
  },
];

/**
 * SessionReportComponent — the first-party (sessions-service) report body
 * for one project: live banner, overview cards, trends, breakdowns, the
 * page heatmap, and the session explorer. Header/period controls live in
 * the parent PropertyDashboardComponent.
 */
export default function SessionReportComponent({
  projectId,
  period,
}: {
  projectId: string;
  period: string;
}) {
  const reports = useAsyncData(`${projectId}|${period}`, () =>
    loadSessionReports(projectId, period),
  );
  const live = useAsyncData(
    projectId,
    () => ApiService.getSessionLive(projectId).then(unwrapData<SessionLiveResponse>),
    { refreshIntervalMs: LIVE_REFRESH_MS },
  );

  const values = reports.data?.values;
  const devices = values?.devices;
  const pages = values?.pages;

  const trendSeries = useMemo(
    () =>
      fillDailySeries(
        values?.timeSeries ?? [],
        (date): SessionTimeSeriesPoint => ({ date, sessions: 0, uniqueVisitors: 0, pageViews: 0 }),
        sessionsSeriesWindow(period),
      ),
    [values?.timeSeries, period],
  );

  const deviceTypeSegments = useMemo(
    () =>
      toDonutSegments(
        devices?.deviceTypes,
        (row) => row.type || "Unknown",
        (row) => row.sessions,
      ),
    [devices],
  );
  const browserSegments = useMemo(
    () => toDonutSegments(devices?.browsers, (row) => row.name, (row) => row.sessions, 3),
    [devices],
  );
  const osSegments = useMemo(
    () => toDonutSegments(devices?.operatingSystems, (row) => row.name, (row) => row.sessions, 5),
    [devices],
  );
  const heatmapPaths = useMemo(
    () => (pages ?? []).map((row) => row.path).filter(Boolean).slice(0, HEATMAP_PATH_LIMIT),
    [pages],
  );

  const banner = (
    <RealtimeBanner
      label="Active Sessions Right Now"
      count={live.data ? live.data.activeSessions : null}
      meta={joinMeta(projectId, "sessions-service")}
    />
  );

  if (reports.loading) {
    return (
      <>
        {banner}
        <LoadingIndicatorComponent
          size="small"
          label="Loading session analytics…"
          className="is-loading-centered-state"
        />
      </>
    );
  }

  if (!values || reports.data?.allFailed) {
    const message = readableErrorMessage(reports.error ?? reports.data?.firstError);
    return (
      <>
        {banner}
        <div className={styles["empty-state"]} role="alert">
          <ChartColumn size={40} strokeWidth={1.5} className={styles["empty-icon"]} />
          <span className={styles["empty-title"]}>First-party analytics unavailable</span>
          {message && <span className={styles["empty-detail"]}>{message}</span>}
        </div>
      </>
    );
  }

  const { overview, referrers, events, geo } = values;

  return (
    <>
      {banner}

      {/* ── Overview Cards ────────────────────────────────── */}
      {overview && (
        <div className={styles["summary-grid"]}>
          <StatCard
            icon={Activity}
            label="Total Sessions"
            value={formatCompact(overview.totalSessions)}
            sub={`${formatCompact(overview.engagedSessions)} engaged`}
            color="#6366f1"
            delay={0}
          />
          <StatCard
            icon={Users}
            label="Unique Visitors"
            value={formatCompact(overview.uniqueVisitors)}
            color="#10b981"
            delay={50}
          />
          <StatCard
            icon={Eye}
            label="Page Views"
            value={formatCompact(overview.totalPageViews)}
            color="#8b5cf6"
            delay={100}
          />
          <StatCard
            icon={Clock}
            label="Avg Duration"
            value={formatDurationMs(overview.avgSessionDuration)}
            sub={`${formatDurationMs(overview.totalDuration)} total`}
            color="#3b82f6"
            delay={150}
          />
          <StatCard
            icon={MousePointerClick}
            label="Engagement"
            value={formatWholePercent(overview.engagementRate)}
            sub={`${formatWholePercent(overview.bounceRate)} bounce`}
            color="#f59e0b"
            delay={200}
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
      {pages && pages.length > 0 && (
        <TableComponent
          title="Top Pages"
          columns={pageColumns}
          data={pages}
          getRowKey={(row: SessionPageRow, index: number) => `${row.path}\u0000${index}`}
          emptyText="No page data available"
          mini
        />
      )}

      {/* ── Referrers + Events ────────────────────────────── */}
      <div className={styles["content-grid"]}>
        <BarListPanel
          icon={Link2}
          title="Top Referrers"
          meta={referrers?.length ? `${referrers.length} sources` : undefined}
          bars={(referrers ?? []).map((referrer) => ({
            key: referrer.referrer || "(direct)",
            label: referrer.referrer || "(direct)",
            value: referrer.sessions,
          }))}
        />
        <BarListPanel
          icon={Zap}
          title="Top Events"
          meta={events?.length ? `${events.length} events` : undefined}
          bars={(events ?? []).map((event) => ({
            key: `${event.category}-${event.action}`,
            label: `${event.category} / ${event.action}`,
            value: event.count,
          }))}
          colorOffset={2}
          limit={events?.length || 10}
        />
      </div>

      {/* ── Geography ─────────────────────────────────────── */}
      <BarListPanel
        icon={MapPin}
        title="Top Locations"
        meta={geo?.length ? `${geo.length} locations` : undefined}
        bars={(geo ?? []).map((location) => ({
          key: `${location.countryCode}-${location.city}`,
          label: formatLocation(location, "(unknown)"),
          value: location.sessions,
        }))}
        colorOffset={4}
        suffix=" sessions"
      />

      {/* ── Devices + Browsers ─────────────────────────────── */}
      <div className={styles["content-grid"]}>
        <DonutPanel icon={Monitor} title="Device Types" segments={deviceTypeSegments} />
        <DonutPanel icon={Globe} title="Browsers" segments={browserSegments} />
      </div>

      {/* ── OS ────────────────────────────────────────────── */}
      <DonutPanel icon={Laptop} title="Operating Systems" segments={osSegments} />

      {/* ── Page Heatmap (cursor / click / scroll density) ── */}
      <HeatmapPanelComponent projectId={projectId} period={period} paths={heatmapPaths} />

      {/* ── Session Explorer (IPs + Visitors + Sessions + Timeline) ── */}
      <SessionExplorerComponent
        key={`${projectId}-${period}`}
        projectId={projectId}
        period={period}
      />
    </>
  );
}
