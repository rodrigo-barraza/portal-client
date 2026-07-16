"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  TrendingUp,
  MapPin,
  Globe,
  Monitor,
  Link2,
  Zap,
  Laptop,
} from "lucide-react";
import ApiService from "../services/ApiService";
import SessionExplorerComponent from "./SessionExplorerComponent";
import {
  formatElapsedTime,
  formatNumber,
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
  SessionOverview,
  SessionPageRow,
  SessionReferrerRow,
  SessionGeoRow,
  SessionDeviceBreakdown,
  SessionTimeSeriesPoint,
  SessionTopEvent,
  SessionLiveResponse,
} from "../types/portal";

/**
 * SessionReportComponent — the first-party (sessions-service) report body
 * for one project: live banner, overview cards, trends, breakdowns, and
 * the session explorer. Header/period controls live in the parent
 * PropertyDashboardComponent.
 */
export default function SessionReportComponent({
  projectId,
  period,
}: {
  projectId: string;
  period: string;
}) {
  const [overview, setOverview] = useState<SessionOverview | null>(null);
  const [pages, setPages] = useState<SessionPageRow[] | null>(null);
  const [referrers, setReferrers] = useState<SessionReferrerRow[] | null>(null);
  const [geo, setGeo] = useState<SessionGeoRow[] | null>(null);
  const [devices, setDevices] = useState<SessionDeviceBreakdown | null>(null);
  const [timeSeries, setTimeSeries] = useState<SessionTimeSeriesPoint[] | null>(null);
  const [events, setEvents] = useState<SessionTopEvent[] | null>(null);
  const [live, setLive] = useState<SessionLiveResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const liveTimer = useRef<NodeJS.Timeout | null>(null);
  const reportsRequestSequence = useRef(0);

  // ── Load Reports ──────────────────────────────────────────

  const loadReports = useCallback(
    async (selectedPeriod: string) => {
      const requestId = ++reportsRequestSequence.current;
      setLoading(true);
      try {
        const [
          overviewRes,
          pagesRes,
          referrersRes,
          geoRes,
          devicesRes,
          tsRes,
          eventsRes,
        ] = await Promise.all([
          ApiService.getSessionOverview(projectId, selectedPeriod).catch(() => null),
          ApiService.getSessionPages(projectId, selectedPeriod).catch(() => null),
          ApiService.getSessionReferrers(projectId, selectedPeriod).catch(() => null),
          ApiService.getSessionGeo(projectId, selectedPeriod).catch(() => null),
          ApiService.getSessionDevices(projectId, selectedPeriod).catch(() => null),
          ApiService.getSessionTimeSeries(projectId, selectedPeriod).catch(() => null),
          ApiService.getSessionEvents(projectId, selectedPeriod).catch(() => null),
        ]);

        // Drop stale responses when the user switched periods mid-flight
        if (requestId !== reportsRequestSequence.current) return;

        setOverview(overviewRes?.data ?? overviewRes);
        setPages(pagesRes?.data ?? pagesRes);
        setReferrers(referrersRes?.data ?? referrersRes);
        setGeo(geoRes?.data ?? geoRes);
        setDevices(devicesRes?.data ?? devicesRes);
        setTimeSeries(tsRes?.data ?? tsRes);
        setEvents(eventsRes?.data ?? eventsRes);
      } catch (error) {
        console.error("Session reports fetch failed:", error);
      } finally {
        if (requestId === reportsRequestSequence.current) setLoading(false);
      }
    },
    [projectId],
  );

  const loadLive = useCallback(async () => {
    try {
      const liveSessionResponse = await ApiService.getSessionLive(projectId);
      setLive(liveSessionResponse?.data ?? liveSessionResponse);
    } catch {
      // Silent fail — live is best-effort
    }
  }, [projectId]);

  // ── Effects ───────────────────────────────────────────────

  useEffect(() => {
    // Fetch-on-mount/period-change: loaders only set state after awaits
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReports(period);
    loadLive();

    if (liveTimer.current) clearInterval(liveTimer.current);
    liveTimer.current = setInterval(() => loadLive(), 15_000);

    return () => {
      if (liveTimer.current) clearInterval(liveTimer.current);
    };
  }, [period, loadReports, loadLive]);

  // ── Computed ──────────────────────────────────────────────

  const deviceTypeSegments = useMemo(
    () =>
      (devices?.deviceTypes || []).map((deviceType, i) => ({
        value: deviceType.sessions,
        color: CHART_COLORS[i % CHART_COLORS.length],
        label: deviceType.type || "Unknown",
      })),
    [devices],
  );

  const browserSegments = useMemo(
    () =>
      (devices?.browsers || []).map((browser, i) => ({
        value: browser.sessions,
        color: CHART_COLORS[(i + 3) % CHART_COLORS.length],
        label: browser.name,
      })),
    [devices],
  );

  const osSegments = useMemo(
    () =>
      (devices?.operatingSystems || []).map((osItem, i) => ({
        value: osItem.sessions,
        color: CHART_COLORS[(i + 5) % CHART_COLORS.length],
        label: osItem.name,
      })),
    [devices],
  );

  // ── Page columns ──────────────────────────────────────────

  const pageColumns = [
    {
      key: "path",
      label: "Page",
      render: (row: SessionPageRow) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
          {row.path}
        </span>
      ),
    },
    {
      key: "views",
      label: "Views",
      align: "right" as const,
      render: (row: SessionPageRow) => formatNumber(row.views),
    },
    {
      key: "uniqueVisitors",
      label: "Visitors",
      align: "right" as const,
      render: (row: SessionPageRow) => formatNumber(row.uniqueVisitors),
    },
  ];

  // ── Render ────────────────────────────────────────────────

  return (
    <>
      <RealtimeBanner
        label="Active Sessions Right Now"
        count={live ? live.activeSessions : null}
        meta={`${projectId} · sessions-service`}
      />

      {loading ? (
        <LoadingIndicatorComponent
          size="small"
          label="Loading session analytics…"
          className="is-loading-centered-state"
        />
      ) : (
        <>
          {/* ── Overview Cards ────────────────────────────────── */}
          {overview && (
            <div className={styles['summary-grid']}>
              <StatCard
                icon={Activity}
                label="Total Sessions"
                value={formatNumber(overview.totalSessions)}
                sub={`${formatNumber(overview.engagedSessions)} engaged`}
                color="#6366f1"
                delay={0}
              />
              <StatCard
                icon={Users}
                label="Unique Visitors"
                value={formatNumber(overview.uniqueVisitors)}
                color="#10b981"
                delay={50}
              />
              <StatCard
                icon={Eye}
                label="Page Views"
                value={formatNumber(overview.totalPageViews)}
                color="#8b5cf6"
                delay={100}
              />
              <StatCard
                icon={Clock}
                label="Avg Duration"
                value={formatElapsedTime(overview.avgSessionDuration / 1000)}
                sub={`${formatElapsedTime(overview.totalDuration / 1000)} total`}
                color="#3b82f6"
                delay={150}
              />
              <StatCard
                icon={MousePointerClick}
                label="Engagement"
                value={`${overview.engagementRate}%`}
                sub={`${overview.bounceRate}% bounce`}
                color="#f59e0b"
                delay={200}
              />
            </div>
          )}

          {/* ── Daily Trends ──────────────────────────────────── */}
          <TrendsPanel
            icon={TrendingUp}
            title="Daily Trends"
            series={(timeSeries || []) as unknown as Record<string, unknown>[]}
            metrics={[
              { key: "pageViews", label: "Page Views", color: SPARKLINE_COLORS.pageviews },
              { key: "uniqueVisitors", label: "Visitors", color: SPARKLINE_COLORS.users },
              { key: "sessions", label: "Sessions", color: SPARKLINE_COLORS.sessions },
            ]}
          />

          {/* ── Top Pages ────────────────────────────────────── */}
          {pages && pages.length > 0 && (
            <TableComponent
              title="Top Pages"
              columns={pageColumns}
              data={pages}
              getRowKey={(row: SessionPageRow, i: number) => row.path || i}
              emptyText="No page data available"
              mini
            />
          )}

          {/* ── Referrers + Events ────────────────────────────── */}
          <div className={styles['content-grid']}>
            <BarListPanel
              icon={Link2}
              title="Top Referrers"
              meta={referrers?.length ? `${referrers.length} sources` : undefined}
              bars={(referrers || []).map((referrer) => ({
                key: referrer.referrer || "(direct)",
                label: referrer.referrer || "(direct)",
                value: referrer.sessions,
              }))}
            />
            <BarListPanel
              icon={Zap}
              title="Top Events"
              meta={events?.length ? `${events.length} events` : undefined}
              bars={(events || []).map((event) => ({
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
            bars={(geo || []).map((location) => ({
              key: `${location.country}-${location.city}`,
              label:
                location.city && location.city !== "(not set)"
                  ? `${location.city}, ${location.country}`
                  : location.country || "(unknown)",
              value: location.sessions,
            }))}
            colorOffset={4}
            suffix=" sessions"
          />

          {/* ── Devices + Browsers ─────────────────────────────── */}
          <div className={styles['content-grid']}>
            <DonutPanel icon={Monitor} title="Device Types" segments={deviceTypeSegments} />
            <DonutPanel icon={Globe} title="Browsers" segments={browserSegments} />
          </div>

          {/* ── OS ────────────────────────────────────────────── */}
          <DonutPanel icon={Laptop} title="Operating Systems" segments={osSegments} />

          {/* ── Session Explorer (Visitors + Sessions + Timeline) ── */}
          <SessionExplorerComponent
            key={`${projectId}-${period}`}
            projectId={projectId}
            period={period}
          />
        </>
      )}
    </>
  );
}
