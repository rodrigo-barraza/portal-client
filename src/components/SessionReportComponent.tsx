"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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
  Languages,
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
import { formatCompact } from "@rodrigo-barraza/utilities-library";
import ApiService from "../services/ApiService";
import SessionExplorerComponent from "./SessionExplorerComponent";
import HeatmapPanelComponent from "./HeatmapPanelComponent";
import HourlyHeatmapComponent from "./analytics/HourlyHeatmapComponent";
import {
  SPARKLINE_COLORS,
  StatCard,
  DonutPanel,
  BarListPanel,
  TrendsPanel,
  RealtimeBanner,
} from "./AnalyticsPrimitives";
import useAsyncData, {
  unwrapData,
  type AsyncDataResult,
} from "./analytics/useAsyncData";
import {
  countryFlag,
  countryName,
  formatCount,
  formatDecimal,
  formatDurationMs,
  formatExact,
  formatRatioPercent,
  formatScrollDepth,
  joinMeta,
  percentChange,
  readableErrorMessage,
} from "./analytics/analyticsFormat";
import {
  formatBucket,
  newVsReturningSegments,
  sessionHourlyCells,
  toDonutSegments,
} from "./analytics/analyticsSeries";
import {
  INITIAL_EXPLORER_STATE,
  type ExplorerState,
} from "./analytics/explorerModel";
import useTableSort from "./analytics/useTableSort";
import styles from "./WebAnalytics.module.css";
import type {
  SessionCampaignRow,
  SessionFilters,
  SessionPageRow,
  SessionReport,
  SessionReportSummary,
} from "../types/portal";

const LIVE_REFRESH_MS = 15_000;
/** Pages listed in the live banner. */
const LIVE_PAGE_LIMIT = 5;

const TREND_METRICS = [
  { key: "pageviews", label: "Pageviews", color: SPARKLINE_COLORS.pageviews },
  { key: "visitors", label: "Visitors", color: SPARKLINE_COLORS.users },
  { key: "sessions", label: "Sessions", color: SPARKLINE_COLORS.sessions },
];

/** "desktop" → "Desktop". */
function capitalize(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** Period-over-period change of one summary metric; null without a previous range. */
function summaryDelta(
  report: SessionReport,
  metric: keyof SessionReportSummary,
): number | null {
  return report.previous
    ? percentChange(report.summary[metric], report.previous[metric])
    : null;
}

function pageColumns(onSelectPage: (path: string) => void) {
  return [
    {
      key: "path",
      label: "Page",
      sortValue: (row: SessionPageRow) => row.path,
      render: (row: SessionPageRow) => (
        <button
          type="button"
          className={`${styles["mono-cell"]} ${styles["cell-link"]}`}
          title={`Show sessions that viewed ${row.path}`}
          onClick={(event) => {
            event.stopPropagation();
            onSelectPage(row.path);
          }}
        >
          {row.path}
        </button>
      ),
    },
    {
      key: "views",
      label: "Views",
      align: "right" as const,
      sortValue: (row: SessionPageRow) => row.views,
      render: (row: SessionPageRow) => formatCompact(row.views),
    },
    {
      key: "visitors",
      label: "Visitors",
      align: "right" as const,
      sortValue: (row: SessionPageRow) => row.visitors,
      render: (row: SessionPageRow) => formatCompact(row.visitors),
    },
    {
      key: "avgEngagedMs",
      label: "Avg Engaged",
      description: "Average engaged time per view",
      align: "right" as const,
      sortValue: (row: SessionPageRow) => row.avgEngagedMs,
      render: (row: SessionPageRow) => formatDurationMs(row.avgEngagedMs),
    },
    {
      key: "avgScroll",
      label: "Avg Scroll",
      description: "Average deepest scroll per view",
      align: "right" as const,
      sortValue: (row: SessionPageRow) => row.avgScroll,
      render: (row: SessionPageRow) => formatScrollDepth(row.avgScroll),
    },
    {
      key: "entries",
      label: "Entries",
      description: "Sessions that landed on this page",
      align: "right" as const,
      sortValue: (row: SessionPageRow) => row.entries,
      render: (row: SessionPageRow) => formatCompact(row.entries),
    },
    {
      key: "exits",
      label: "Exits",
      description: "Sessions that left from this page",
      align: "right" as const,
      sortValue: (row: SessionPageRow) => row.exits,
      render: (row: SessionPageRow) => formatCompact(row.exits),
    },
  ];
}

const campaignColumns = [
  {
    key: "campaign",
    label: "Campaign",
    sortValue: (row: SessionCampaignRow) => row.campaign ?? "",
    render: (row: SessionCampaignRow) => (
      <span className={styles["mono-cell"]}>{row.campaign ?? "(not set)"}</span>
    ),
  },
  {
    key: "source",
    label: "Source / Medium",
    sortValue: (row: SessionCampaignRow) => row.source ?? "",
    render: (row: SessionCampaignRow) =>
      `${row.source ?? "(not set)"} / ${row.medium ?? "(not set)"}`,
  },
  {
    key: "sessions",
    label: "Sessions",
    align: "right" as const,
    sortValue: (row: SessionCampaignRow) => row.sessions,
    render: (row: SessionCampaignRow) => formatCompact(row.sessions),
  },
  {
    key: "visitors",
    label: "Visitors",
    align: "right" as const,
    sortValue: (row: SessionCampaignRow) => row.visitors,
    render: (row: SessionCampaignRow) => formatCompact(row.visitors),
  },
];

/**
 * SessionReportComponent — the first-party (sessions-service) report body
 * for one project: live banner, KPIs against the previous range, trends,
 * pages, acquisition, geography, technology, audience, events, the page
 * heatmap and the session explorer. The report itself is loaded by the
 * parent PropertyDashboardComponent (its GA4 comparison reads the same
 * summary); this component polls /live and owns the explorer's state, so
 * a click on a page, channel or country drills into those sessions.
 */
export default function SessionReportComponent({
  projectId,
  period,
  report,
}: {
  projectId: string;
  period: string;
  report: AsyncDataResult<SessionReport>;
}) {
  const live = useAsyncData(
    `live|${projectId}`,
    (signal) =>
      ApiService.getSessionLive(projectId, { signal }).then(unwrapData),
    { refreshIntervalMs: LIVE_REFRESH_MS },
  );

  const [explorer, setExplorer] = useState<ExplorerState>(
    INITIAL_EXPLORER_STATE,
  );
  const explorerRef = useRef<HTMLDivElement | null>(null);

  /** Show the sessions behind a report row: add its filter, jump to the list. */
  const drillDown = useCallback((filters: SessionFilters) => {
    setExplorer((current) => ({
      filters: { ...current.filters, ...filters },
      allTime: false,
      sessionId: null,
    }));
    explorerRef.current?.scrollIntoView({ block: "start" });
  }, []);

  const data = report.data;

  const trendSeries = useMemo(
    () =>
      (data?.series ?? []).map((point) => ({
        date: point.bucket,
        visitors: point.visitors,
        sessions: point.sessions,
        pageviews: point.pageviews,
      })),
    [data?.series],
  );

  const banner = (
    <RealtimeBanner
      label="Active Right Now"
      count={live.data ? live.data.active : null}
      meta={joinMeta(projectId, "last 5 minutes")}
    >
      {live.data && live.data.pages.length > 0 && (
        <ul
          className={styles["realtime-pages"]}
          aria-label="Pages being viewed right now"
        >
          {live.data.pages.slice(0, LIVE_PAGE_LIMIT).map((page) => (
            <li key={page.path} className={styles["realtime-page"]}>
              <span className={styles["realtime-page-path"]} title={page.path}>
                {page.path}
              </span>
              <span className={styles["realtime-page-count"]} aria-hidden>
                {formatExact(page.active)}
              </span>
              <span className={styles["visually-hidden"]}>
                {formatCount(page.active, "active session")}
              </span>
            </li>
          ))}
          {live.data.pages.length > LIVE_PAGE_LIMIT && (
            <li className={styles["realtime-pages-label"]}>
              +{live.data.pages.length - LIVE_PAGE_LIMIT} more
            </li>
          )}
        </ul>
      )}
    </RealtimeBanner>
  );

  const explorerSection = (
    <div ref={explorerRef} className={styles["explorer-anchor"]}>
      <SessionExplorerComponent
        projectId={projectId}
        period={period}
        state={explorer}
        onStateChange={setExplorer}
      />
    </div>
  );

  if (report.loading) {
    return (
      <>
        {banner}
        <LoadingIndicatorComponent
          size="small"
          label="Loading first-party analytics…"
          className="is-loading-centered-state"
        />
      </>
    );
  }

  if (!data) {
    const message = readableErrorMessage(report.error);
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
            First-party analytics unavailable
          </span>
          {message && <span className={styles["empty-detail"]}>{message}</span>}
        </div>
      </>
    );
  }

  const { summary, range } = data;
  const isEmpty = summary.sessions === 0 && summary.pageviews === 0;
  const hourly = range.bucket === "hour";

  return (
    <>
      {banner}

      {/* ── KPIs vs the previous range ─────────────────────── */}
      <div className={styles["summary-grid"]}>
        <StatCard
          icon={Users}
          label="Visitors"
          value={formatCompact(summary.visitors)}
          sub={`${formatCompact(summary.newVisitors)} new`}
          color="#6366f1"
          delay={0}
          delta={summaryDelta(data, "visitors")}
        />
        <StatCard
          icon={Activity}
          label="Sessions"
          value={formatCompact(summary.sessions)}
          sub={`${formatCompact(summary.engagedSessions)} engaged`}
          color="#10b981"
          delay={50}
          delta={summaryDelta(data, "sessions")}
        />
        <StatCard
          icon={Eye}
          label="Pageviews"
          value={formatCompact(summary.pageviews)}
          sub={`${formatDecimal(summary.pagesPerSession)} pages / session`}
          color="#8b5cf6"
          delay={100}
          delta={summaryDelta(data, "pageviews")}
        />
        <StatCard
          icon={Clock}
          label="Avg Engagement"
          value={formatDurationMs(summary.avgEngagedMs)}
          sub={`${formatDurationMs(summary.engagedMs)} total`}
          color="#3b82f6"
          delay={150}
          delta={summaryDelta(data, "avgEngagedMs")}
        />
        <StatCard
          icon={MousePointerClick}
          label="Engagement Rate"
          value={formatRatioPercent(summary.engagementRate)}
          sub={`${formatRatioPercent(summary.bounceRate)} bounce`}
          color="#f59e0b"
          delay={200}
          delta={summaryDelta(data, "engagementRate")}
        />
      </div>

      {isEmpty ? (
        <div className={styles["empty-state"]}>
          <ChartColumn
            size={40}
            strokeWidth={1.5}
            className={styles["empty-icon"]}
          />
          <span className={styles["empty-title"]}>
            No visits in this range yet
          </span>
          <span className={styles["empty-detail"]}>
            First-party tracking records from the moment the tracker loads on a
            page — there is no older history to import. Trends, pages, sources
            and audiences fill in here as visits arrive; widen the range or
            check the live count above.
          </span>
        </div>
      ) : (
        <SessionReportPanels
          projectId={projectId}
          period={period}
          report={data}
          hourly={hourly}
          trendSeries={trendSeries}
          onDrillDown={drillDown}
        />
      )}

      {/* ── Session Explorer ─────────────────────────────── */}
      {explorerSection}
    </>
  );
}

/** Everything between the KPIs and the explorer, for a range with visits. */
function SessionReportPanels({
  projectId,
  period,
  report,
  hourly,
  trendSeries,
  onDrillDown,
}: {
  projectId: string;
  period: string;
  report: SessionReport;
  hourly: boolean;
  trendSeries: Record<string, unknown>[];
  onDrillDown: (filters: SessionFilters) => void;
}) {
  const heatmapPaths = useMemo(
    () => report.pages.map((row) => row.path).filter(Boolean),
    [report.pages],
  );
  const firstBucket = report.series[0]?.bucket;
  const lastBucket = report.series.at(-1)?.bucket;
  const { summary } = report;

  return (
    <>
      {/* ── Trends ─────────────────────────────────────────── */}
      <TrendsPanel
        icon={TrendingUp}
        title={hourly ? "Hourly Trends" : "Daily Trends"}
        meta={
          firstBucket && lastBucket
            ? joinMeta(
                `${formatBucket(firstBucket)} → ${formatBucket(lastBucket)}`,
                report.range.tz,
              )
            : undefined
        }
        series={trendSeries}
        metrics={TREND_METRICS}
      />

      {/* ── Pages ───────────────────────────────────────────── */}
      {report.pages.length > 0 && (
        <PagesTable pages={report.pages} onDrillDown={onDrillDown} />
      )}

      {/* ── Acquisition ─────────────────────────────────────── */}
      <div className={styles["content-grid"]}>
        <BarListPanel
          icon={Layers}
          title="Channels"
          meta={formatCount(report.channels.length, "channel")}
          bars={report.channels.map((row) => ({
            key: row.channel,
            label: row.channel,
            value: row.sessions,
            note: `${formatRatioPercent(row.engagementRate)} engaged`,
          }))}
          suffix=" sessions"
          onSelect={(bar) => onDrillDown({ channel: bar.key })}
          selectLabel={(bar) => `Show ${bar.label} sessions`}
        />
        <BarListPanel
          icon={Link2}
          title="Referrers"
          meta={
            report.referrers.length
              ? formatCount(report.referrers.length, "site")
              : undefined
          }
          bars={report.referrers.map((row) => ({
            key: row.host,
            label: row.host,
            value: row.sessions,
            note: formatCount(row.visitors, "visitor"),
          }))}
          colorOffset={2}
          suffix=" sessions"
        />
      </div>

      {report.campaigns.length > 0 && (
        <CampaignsTable campaigns={report.campaigns} />
      )}

      {/* ── Geography ───────────────────────────────────────── */}
      <div className={styles["content-grid"]}>
        <BarListPanel
          icon={Globe}
          title="Countries"
          meta={formatCount(report.countries.length, "country", "countries")}
          bars={report.countries.map((row) => ({
            key: row.country,
            label: [
              countryFlag(row.country),
              row.name || countryName(row.country),
            ]
              .filter(Boolean)
              .join(" "),
            value: row.sessions,
            note: formatCount(row.visitors, "visitor"),
          }))}
          colorOffset={4}
          suffix=" sessions"
          onSelect={(bar) => onDrillDown({ country: bar.key })}
          selectLabel={(bar) => `Show sessions from ${bar.label}`}
        />
        <BarListPanel
          icon={MapPin}
          title="Cities"
          meta={
            report.cities.length
              ? formatCount(report.cities.length, "city", "cities")
              : undefined
          }
          bars={report.cities.map((row) => ({
            key: `${row.country}|${row.region}|${row.city}`,
            label: [
              countryFlag(row.country),
              [row.city, row.region, countryName(row.country)]
                .filter(Boolean)
                .join(", "),
            ]
              .filter(Boolean)
              .join(" "),
            value: row.sessions,
          }))}
          colorOffset={5}
          suffix=" sessions"
        />
      </div>

      {/* ── Technology ──────────────────────────────────────── */}
      <div className={styles["content-grid"]}>
        <DonutPanel
          icon={Monitor}
          title="Devices"
          segments={toDonutSegments(
            report.devices,
            (row) => capitalize(row.name),
            (row) => row.sessions,
          )}
        />
        <DonutPanel
          icon={Globe}
          title="Browsers"
          segments={toDonutSegments(
            report.browsers,
            (row) => row.name,
            (row) => row.sessions,
            3,
          )}
        />
      </div>

      <div className={styles["content-grid"]}>
        <DonutPanel
          icon={Laptop}
          title="Operating Systems"
          segments={toDonutSegments(
            report.os,
            (row) => row.name,
            (row) => row.sessions,
            5,
          )}
        />
        {/* ── Audience ──────────────────────────────────────── */}
        <DonutPanel
          icon={RefreshCw}
          title="New vs Returning"
          segments={newVsReturningSegments(
            summary.visitors > 0
              ? [
                  { segment: "new", users: summary.newVisitors },
                  {
                    segment: "returning",
                    users: Math.max(summary.visitors - summary.newVisitors, 0),
                  },
                ]
              : [],
            "Visitors",
          )}
          centerLabel="Visitors"
          suffix=" visitors"
        />
      </div>

      <div className={styles["content-grid"]}>
        <BarListPanel
          icon={Ruler}
          title="Screens"
          bars={report.screens.map((row) => ({
            key: row.name,
            label: row.name,
            value: row.sessions,
          }))}
          colorOffset={1}
          suffix=" sessions"
        />
        <BarListPanel
          icon={Languages}
          title="Languages"
          bars={report.languages.map((row) => ({
            key: row.name,
            label: row.name,
            value: row.sessions,
          }))}
          colorOffset={6}
          suffix=" sessions"
        />
      </div>

      <HourlyHeatmapComponent
        cells={sessionHourlyCells(report.hours)}
        title="Sessions by Hour & Day"
        noun="sessions"
        meta={report.range.tz}
      />

      {/* ── Custom events ───────────────────────────────────── */}
      {report.events.length > 0 && (
        <BarListPanel
          icon={Zap}
          title="Events"
          meta={formatCount(report.events.length, "event")}
          bars={report.events.map((row) => ({
            key: row.name,
            label: row.name,
            value: row.count,
            note: formatCount(row.sessions, "session"),
          }))}
          suffix=" times"
          colorOffset={2}
          limit={report.events.length}
        />
      )}

      {/* ── Page heatmap ────────────────────────────────────── */}
      {heatmapPaths.length > 0 && (
        <HeatmapPanelComponent
          projectId={projectId}
          period={period}
          paths={heatmapPaths}
        />
      )}
    </>
  );
}

/** Top pages, ranked by views until a header re-sorts them; a row drills in. */
function PagesTable({
  pages,
  onDrillDown,
}: {
  pages: SessionPageRow[];
  onDrillDown: (filters: SessionFilters) => void;
}) {
  const columns = useMemo(
    () => pageColumns((path) => onDrillDown({ path })),
    [onDrillDown],
  );
  const table = useTableSort(pages, columns, { key: "views", dir: "desc" });
  return (
    <TableComponent<SessionPageRow>
      title="Pages"
      subtitle="Select a page to list the sessions that viewed it"
      columns={columns}
      data={table.rows}
      sortKey={table.sortKey}
      sortDir={table.sortDir}
      onSort={table.onSort}
      getRowKey={(row: SessionPageRow) => row.path}
      onRowClick={(row: SessionPageRow) => onDrillDown({ path: row.path })}
      emptyText="No pages viewed in this range"
      mini
    />
  );
}

function CampaignsTable({ campaigns }: { campaigns: SessionCampaignRow[] }) {
  const table = useTableSort(campaigns, campaignColumns, {
    key: "sessions",
    dir: "desc",
  });
  return (
    <TableComponent<SessionCampaignRow>
      title="Campaigns"
      columns={campaignColumns}
      data={table.rows}
      sortKey={table.sortKey}
      sortDir={table.sortDir}
      onSort={table.onSort}
      getRowKey={(row: SessionCampaignRow, index: number) =>
        `${row.source}\u0000${row.medium}\u0000${row.campaign}\u0000${index}`
      }
      emptyText="No campaigns"
      mini
    />
  );
}
