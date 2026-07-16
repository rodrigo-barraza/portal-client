"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  LoadingIndicatorComponent,
  TableComponent,
} from "@rodrigo-barraza/components-library";
import {
  Activity,
  Users,
  Eye,
  Clock,
  MousePointerClick,
  Globe,
  Monitor,
  Link2,
  TrendingUp,
  MapPin,
  Layers,
  RefreshCw,
  Zap,
  Laptop,
  Ruler,
} from "lucide-react";
import ApiService from "../services/ApiService";
import {
  formatElapsedTime,
  formatNumber,
  formatPercent as _formatPercent,
} from "@rodrigo-barraza/utilities-library";
import {
  CHART_COLORS,
  SPARKLINE_COLORS,
  StatCard,
  DonutPanel,
  BarListPanel,
  TrendsPanel,
  RealtimeBanner,
} from "./AnalyticsPrimitives";
import styles from "./WebAnalytics.module.css";
import type {
  GAProperty,
  GAOverview,
  GAPageRow,
  GALandingPageRow,
  GASource,
  GALocation,
  GADevices,
  GAChannel,
  GAHeatmapCell,
  GANewVsReturningSegment,
  GAEvent,
  GATimeSeriesPoint,
} from "../types/portal";

/** GA returns ratios 0–1 — convert to 0–100 for the library's formatPercent */
const formatPercent = (value: number | null | undefined) => {
  if (value == null) return "0%";
  return _formatPercent(value * 100);
};

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
  const [realtime, setRealtime] = useState<{ activeUsers: number } | null>(null);
  const [overview, setOverview] = useState<GAOverview | null>(null);
  const [pages, setPages] = useState<{ pages: GAPageRow[] } | null>(null);
  const [sources, setSources] = useState<{ sources: GASource[] } | null>(null);
  const [geography, setGeography] = useState<{ locations: GALocation[] } | null>(null);
  const [devices, setDevices] = useState<GADevices | null>(null);
  const [timeSeries, setTimeSeries] = useState<{ series: GATimeSeriesPoint[] } | null>(null);
  const [channels, setChannels] = useState<{ channels: GAChannel[] } | null>(null);
  const [landingPages, setLandingPages] = useState<{ pages: GALandingPageRow[] } | null>(null);
  const [heatmap, setHeatmap] = useState<{ maxUsers: number; cells: GAHeatmapCell[] } | null>(null);
  const [newVsReturning, setNewVsReturning] = useState<{
    segments: GANewVsReturningSegment[];
  } | null>(null);
  const [events, setEvents] = useState<{ events: GAEvent[] } | null>(null);
  const [reportsLoading, setReportsLoading] = useState(true);

  const realtimeTimer = useRef<NodeJS.Timeout | null>(null);
  const reportsRequestSequence = useRef(0);

  // ── Load Reports ──────────────────────────────────────────

  const loadReports = useCallback(
    async (propertyId: string, selectedPeriod: string) => {
      const requestId = ++reportsRequestSequence.current;
      setReportsLoading(true);

      const [
        overviewRes,
        pagesRes,
        sourcesRes,
        geoRes,
        devicesRes,
        tsRes,
        channelsRes,
        landingRes,
        heatmapRes,
        nvrRes,
        eventsRes,
      ] = await Promise.all([
        ApiService.getGAOverview(propertyId, selectedPeriod).catch(() => null),
        ApiService.getGAPages(propertyId, selectedPeriod).catch(() => null),
        ApiService.getGASources(propertyId, selectedPeriod).catch(() => null),
        ApiService.getGAGeography(propertyId, selectedPeriod).catch(() => null),
        ApiService.getGADevices(propertyId, selectedPeriod).catch(() => null),
        ApiService.getGATimeSeries(propertyId, selectedPeriod).catch(() => null),
        ApiService.getGAChannels(propertyId, selectedPeriod).catch(() => null),
        ApiService.getGALandingPages(propertyId, selectedPeriod).catch(() => null),
        ApiService.getGAHeatmap(propertyId, selectedPeriod).catch(() => null),
        ApiService.getGANewVsReturning(propertyId, selectedPeriod).catch(() => null),
        ApiService.getGAEvents(propertyId, selectedPeriod).catch(() => null),
      ]);

      // Drop stale responses when the user switched periods mid-flight
      if (requestId !== reportsRequestSequence.current) return;

      setOverview(overviewRes);
      setPages(pagesRes);
      setSources(sourcesRes);
      setGeography(geoRes);
      setDevices(devicesRes);
      setTimeSeries(tsRes);
      setChannels(channelsRes);
      setLandingPages(landingRes);
      setHeatmap(heatmapRes);
      setNewVsReturning(nvrRes);
      setEvents(eventsRes);
      setReportsLoading(false);
    },
    [],
  );

  const loadRealtime = useCallback(async (propertyId: string) => {
    try {
      const realtimeResponse = await ApiService.getGARealtime(propertyId);
      setRealtime(realtimeResponse);
    } catch {
      // Silent fail — realtime is best-effort
    }
  }, []);

  // ── Effect: load reports + poll realtime every 15s ────────

  useEffect(() => {
    // Fetch-on-mount/period-change: loaders only set state after awaits
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReports(property.id, period);
    loadRealtime(property.id);

    if (realtimeTimer.current) clearInterval(realtimeTimer.current);
    realtimeTimer.current = setInterval(() => loadRealtime(property.id), 15_000);

    return () => {
      if (realtimeTimer.current) clearInterval(realtimeTimer.current);
    };
  }, [property.id, period, loadReports, loadRealtime]);

  // ── Computed Values ───────────────────────────────────────

  const deviceSegments = useMemo(
    () =>
      (devices?.categories || []).map((deviceCategory, i) => ({
        value: deviceCategory.sessions,
        color: CHART_COLORS[i % CHART_COLORS.length],
        label: deviceCategory.category,
      })),
    [devices],
  );

  const browserSegments = useMemo(
    () =>
      (devices?.browsers || []).map((browser, i) => ({
        value: browser.sessions,
        color: CHART_COLORS[(i + 3) % CHART_COLORS.length],
        label: browser.browser,
      })),
    [devices],
  );

  const osSegments = useMemo(
    () =>
      (devices?.operatingSystems || []).map((osItem, i) => ({
        value: osItem.sessions,
        color: CHART_COLORS[(i + 5) % CHART_COLORS.length],
        label: osItem.os,
      })),
    [devices],
  );

  const nvrSegments = useMemo(
    () =>
      (newVsReturning?.segments || []).map((segment, i) => ({
        value: segment.users,
        color: i === 0 ? "#6366f1" : "#10b981",
        label:
          segment.segment === "new"
            ? "New Users"
            : segment.segment === "returning"
              ? "Returning Users"
              : segment.segment,
      })),
    [newVsReturning],
  );

  // ── Heatmap data processing ───────────────────────────────

  const heatmapData = useMemo(() => {
    if (!heatmap?.cells) return null;
    const dayOrder = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const grid: Record<string, number> = {};
    let maxValue = 0;
    for (const cell of heatmap.cells) {
      const key = `${cell.day}:${cell.hour}`;
      grid[key] = (grid[key] || 0) + cell.users;
      if (grid[key] > maxValue) maxValue = grid[key];
    }
    return { grid, dayOrder, maxValue };
  }, [heatmap]);

  // ── Table columns ─────────────────────────────────────────

  const pageColumns = [
    {
      key: "pagePath",
      label: "Page",
      render: (row: GAPageRow) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
          {row.pagePath}
        </span>
      ),
    },
    {
      key: "pageviews",
      label: "Views",
      align: "right" as const,
      render: (row: GAPageRow) => formatNumber(row.pageviews),
    },
    {
      key: "users",
      label: "Users",
      align: "right" as const,
      render: (row: GAPageRow) => formatNumber(row.users),
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
      render: (row: GAPageRow) => formatPercent(row.bounceRate),
    },
  ];

  const landingColumns = [
    {
      key: "landingPage",
      label: "Landing Page",
      render: (row: GALandingPageRow) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
          {row.landingPage}
        </span>
      ),
    },
    {
      key: "sessions",
      label: "Sessions",
      align: "right" as const,
      render: (row: GALandingPageRow) => formatNumber(row.sessions),
    },
    {
      key: "users",
      label: "Users",
      align: "right" as const,
      render: (row: GALandingPageRow) => formatNumber(row.users),
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
      render: (row: GALandingPageRow) => formatPercent(row.bounceRate),
    },
  ];

  // ── Render ────────────────────────────────────────────────

  return (
    <>
      <RealtimeBanner
        label="Active Users Right Now"
        count={realtime ? realtime.activeUsers : null}
        meta={`${property.label} · ${property.measurementId}`}
      />

      {reportsLoading ? (
        <LoadingIndicatorComponent
          size="small"
          label="Loading analytics…"
          className="is-loading-centered-state"
        />
      ) : (
        <>
          {/* ── Overview Cards ────────────────────────────────── */}
          {overview && (
            <div className={styles['summary-grid']}>
              <StatCard
                icon={Users}
                label="Total Users"
                value={formatNumber(overview.totalUsers)}
                sub={`${formatNumber(overview.newUsers)} new`}
                color="#6366f1"
                delay={0}
                delta={overview.deltas?.totalUsers}
              />
              <StatCard
                icon={Eye}
                label="Pageviews"
                value={formatNumber(overview.pageviews)}
                color="#8b5cf6"
                delay={50}
                delta={overview.deltas?.pageviews}
              />
              <StatCard
                icon={Activity}
                label="Sessions"
                value={formatNumber(overview.sessions)}
                sub={`${formatNumber(overview.engagedSessions)} engaged`}
                color="#10b981"
                delay={100}
                delta={overview.deltas?.sessions}
              />
              <StatCard
                icon={Clock}
                label="Avg Duration"
                value={formatElapsedTime(overview.avgSessionDuration)}
                color="#3b82f6"
                delay={150}
                delta={overview.deltas?.avgSessionDuration}
              />
              <StatCard
                icon={MousePointerClick}
                label="Engagement"
                value={formatPercent(overview.engagementRate)}
                sub={`${formatPercent(overview.bounceRate)} bounce`}
                color="#f59e0b"
                delay={200}
                delta={overview.deltas?.engagementRate}
              />
            </div>
          )}

          {/* ── Daily Trends ──────────────────────────────────── */}
          <TrendsPanel
            icon={TrendingUp}
            title="Daily Trends"
            series={(timeSeries?.series || []) as unknown as Record<string, unknown>[]}
            metrics={[
              { key: "pageviews", label: "Pageviews", color: SPARKLINE_COLORS.pageviews },
              { key: "users", label: "Users", color: SPARKLINE_COLORS.users },
              { key: "sessions", label: "Sessions", color: SPARKLINE_COLORS.sessions },
            ]}
          />

          {/* ── Top Pages ────────────────────────────────────── */}
          {(pages?.pages?.length ?? 0) > 0 && (
            <TableComponent
              title="Top Pages"
              columns={pageColumns}
              data={pages!.pages}
              getRowKey={(row: GAPageRow, i: number) => row.pagePath || i}
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
              getRowKey={(row: GALandingPageRow, i: number) => row.landingPage || i}
              emptyText="No landing page data"
              mini
            />
          )}

          {/* ── Hourly Traffic Heatmap ────────────────────────── */}
          {heatmapData && (
            <div className={styles['panel']}>
              <div className={styles['panel-header']}>
                <Layers size={15} strokeWidth={2.2} className={styles['panel-icon']} />
                <span className={styles['panel-title']}>Traffic by Hour &amp; Day</span>
              </div>
              <div className={styles['heatmap-container']}>
                <div className={styles['heatmap-corner']} />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className={styles['heatmap-col-label']}>
                    {h}
                  </div>
                ))}
                {heatmapData.dayOrder.map((day) => (
                  <React.Fragment key={day}>
                    <div className={styles['heatmap-row-label']}>{day.slice(0, 3)}</div>
                    {Array.from({ length: 24 }, (_, h) => {
                      const value = heatmapData.grid[`${day}:${h}`] || 0;
                      const intensity =
                        heatmapData.maxValue > 0 ? value / heatmapData.maxValue : 0;
                      return (
                        <div
                          key={h}
                          className={styles['heatmap-cell']}
                          style={{
                            background: `rgba(99, 102, 241, ${0.06 + intensity * 0.84})`,
                          }}
                          title={`${day} ${h}:00 — ${value} users`}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* ── Channels + Sources ─────────────────────────────── */}
          <div className={styles['content-grid']}>
            <BarListPanel
              icon={Layers}
              title="Channel Grouping"
              meta={channels?.channels?.length ? `${channels.channels.length} channels` : undefined}
              bars={(channels?.channels || []).map((channel) => ({
                key: channel.channel,
                label: channel.channel,
                value: channel.sessions,
              }))}
            />
            <BarListPanel
              icon={Link2}
              title="Traffic Sources"
              meta={sources?.sources?.length ? `${sources.sources.length} sources` : undefined}
              bars={(sources?.sources || []).map((source) => ({
                key: `${source.source}-${source.medium}`,
                label: `${source.source} / ${source.medium}`,
                value: source.sessions,
              }))}
            />
          </div>

          {/* ── Geography + Events ─────────────────────────────── */}
          <div className={styles['content-grid']}>
            <BarListPanel
              icon={MapPin}
              title="Top Locations"
              meta={
                geography?.locations?.length
                  ? `${geography.locations.length} locations`
                  : undefined
              }
              bars={(geography?.locations || []).map((location) => ({
                key: `${location.country}-${location.city}`,
                label:
                  location.city && location.city !== "(not set)"
                    ? `${location.city}, ${location.country}`
                    : location.country,
                value: location.users,
              }))}
              colorOffset={4}
              suffix=" users"
            />
            <BarListPanel
              icon={Zap}
              title="Top Events"
              meta={events?.events?.length ? `${events.events.length} events` : undefined}
              bars={(events?.events || []).map((event) => ({
                key: event.eventName,
                label: event.eventName,
                value: event.eventCount,
              }))}
              colorOffset={2}
              limit={events?.events?.length || 10}
            />
          </div>

          {/* ── Devices + Browsers ─────────────────────────────── */}
          <div className={styles['content-grid']}>
            <DonutPanel icon={Monitor} title="Device Categories" segments={deviceSegments} />
            <DonutPanel icon={Globe} title="Browsers" segments={browserSegments} />
          </div>

          {/* ── OS + New vs Returning ──────────────────────────── */}
          <div className={styles['content-grid']}>
            <DonutPanel icon={Laptop} title="Operating Systems" segments={osSegments} />
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
            bars={(devices?.screenResolutions || []).map((resolution) => ({
              key: resolution.resolution,
              label: resolution.resolution,
              value: resolution.sessions,
            }))}
            colorOffset={1}
            suffix=" sessions"
            limit={devices?.screenResolutions?.length || 10}
          />
        </>
      )}
    </>
  );
}
