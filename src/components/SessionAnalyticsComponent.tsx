"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import Link from "next/link";
import {
  ChartLineComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
  TableComponent,
} from "@rodrigo-barraza/components-library";
import {
  Activity,
  Users,
  Eye,
  Clock,
  ArrowLeft,
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
import styles from "./GoogleAnalyticsComponent.module.css";
import type {
  SessionOverview,
  SessionPageRow,
  SessionReferrerRow,
  SessionGeoRow,
  SessionDeviceBreakdown,
  SessionTimeSeriesPoint,
  SessionTopEvent,
  SessionLiveResponse,
  DonutSegment,
} from "../types/portal";

// ── Palette ───────────────────────────────────────────────────

const CHART_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#f97316",
];

const SPARKLINE_COLORS = {
  pageViews: "#6366f1",
  uniqueVisitors: "#10b981",
  sessions: "#f59e0b",
};

// ── Helpers ───────────────────────────────────────────────────

function HorizontalBar({
  label,
  value,
  max,
  color,
  suffix = "",
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={styles.barRow}>
      <div className={styles.barInfo}>
        <span className={styles.barLabel}>{label}</span>
        <span className={styles.barValue}>
          {formatNumber(value)}
          {suffix}
        </span>
      </div>
      <div className={styles.barTrack}>
        <div
          className={styles.barFill}
          style={{ width: `${percentage}%`, background: color }}
        />
      </div>
    </div>
  );
}

function DonutChart({
  segments,
  size = 120,
  strokeWidth = 14,
  centerLabel = "Total",
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  const cumulativeValues: number[] = [];
  let running = 0;
  for (const segment of segments) {
    cumulativeValues.push(running);
    running += segment.value;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={styles.donut}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--background-elevated)"
        strokeWidth={strokeWidth}
      />
      {segments.map((segment, i) => {
        const percentage = total > 0 ? segment.value / total : 0;
        const dashLength = percentage * circumference;
        const dashOffset =
          total > 0 ? -(cumulativeValues[i] / total) * circumference : 0;

        return (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            className={styles.donutSegment}
            style={{ animationDelay: `${i * 100}ms` }}
          />
        );
      })}
      <text
        x={center}
        y={center - 4}
        textAnchor="middle"
        className={styles.donutCenter}
      >
        {formatNumber(total)}
      </text>
      <text
        x={center}
        y={center + 12}
        textAnchor="middle"
        className={styles.donutCenterLabel}
      >
        {centerLabel}
      </text>
    </svg>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  delay = 0,
}: {
  icon: React.ComponentType<React.ComponentProps<typeof Activity>>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  delay?: number;
}) {
  return (
    <div className={styles.statCard} style={{ animationDelay: `${delay}ms` }}>
      <div
        className={styles.statCardIcon}
        style={{ color, background: `${color}15` }}
      >
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className={styles.statCardContent}>
        <span className={styles.statCardValue}>{value}</span>
        <span className={styles.statCardLabel}>{label}</span>
        {sub && <span className={styles.statCardSub}>{sub}</span>}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function SessionAnalyticsComponent({
  projectId,
}: {
  projectId: string;
}) {
  const [period, setPeriod] = useState("30d");
  const [overview, setOverview] = useState<SessionOverview | null>(null);
  const [pages, setPages] = useState<SessionPageRow[] | null>(null);
  const [referrers, setReferrers] = useState<SessionReferrerRow[] | null>(null);
  const [geo, setGeo] = useState<SessionGeoRow[] | null>(null);
  const [devices, setDevices] = useState<SessionDeviceBreakdown | null>(null);
  const [timeSeries, setTimeSeries] = useState<SessionTimeSeriesPoint[] | null>(
    null,
  );
  const [events, setEvents] = useState<SessionTopEvent[] | null>(null);
  const [live, setLive] = useState<SessionLiveResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const didFetch = useRef(false);
  const liveTimer = useRef<NodeJS.Timeout | null>(null);

  // ── Load Reports ──────────────────────────────────────────

  const loadReports = useCallback(
    async (selectedPeriod: string) => {
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

        setOverview(overviewRes?.data ?? overviewRes);
        setPages(overviewRes?.data ? pagesRes?.data : pagesRes);
        setReferrers(overviewRes?.data ? referrersRes?.data : referrersRes);
        setGeo(overviewRes?.data ? geoRes?.data : geoRes);
        setDevices(overviewRes?.data ? devicesRes?.data : devicesRes);
        setTimeSeries(overviewRes?.data ? tsRes?.data : tsRes);
        setEvents(overviewRes?.data ? eventsRes?.data : eventsRes);
      } catch (error) {
        console.error("Session reports fetch failed:", error);
      } finally {
        setLoading(false);
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
    loadReports(period);
    loadLive();

    if (liveTimer.current) clearInterval(liveTimer.current);
    liveTimer.current = setInterval(() => loadLive(), 15_000);

    return () => {
      if (liveTimer.current) clearInterval(liveTimer.current);
    };
  }, [period, loadReports, loadLive]);

  // ── Computed ──────────────────────────────────────────────

  const maxPageViews =
    pages && pages.length > 0 ? Math.max(...pages.map((property) => property.views)) : 0;

  const maxReferrerSessions =
    referrers && referrers.length > 0
      ? Math.max(...referrers.map((r) => r.sessions))
      : 0;

  const maxGeoSessions =
    geo && geo.length > 0 ? Math.max(...geo.map((g) => g.sessions)) : 0;

  const maxEventCount =
    events && events.length > 0 ? Math.max(...events.map((e) => e.count)) : 0;

  const browserSegments = useMemo((): DonutSegment[] => {
    if (!devices?.browsers) return [];
    return devices.browsers.map((b, i) => ({
      value: b.sessions,
      color: CHART_COLORS[(i + 3) % CHART_COLORS.length],
      label: b.name,
    }));
  }, [devices]);

  const osSegments = useMemo((): DonutSegment[] => {
    if (!devices?.operatingSystems) return [];
    return devices.operatingSystems.map((osItem, i) => ({
      value: osItem.sessions,
      color: CHART_COLORS[(i + 5) % CHART_COLORS.length],
      label: osItem.name,
    }));
  }, [devices]);

  const deviceTypeSegments = useMemo((): DonutSegment[] => {
    if (!devices?.deviceTypes) return [];
    return devices.deviceTypes.map((deviceType, i) => ({
      value: deviceType.sessions,
      color: CHART_COLORS[i % CHART_COLORS.length],
      label: deviceType.type,
    }));
  }, [devices]);

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
      align: "right",
      render: (row: SessionPageRow) => formatNumber(row.views),
    },
    {
      key: "uniqueVisitors",
      label: "Visitors",
      align: "right",
      render: (row: SessionPageRow) => formatNumber(row.uniqueVisitors),
    },
  ];

  // ── Render ────────────────────────────────────────────────

  return (
    <div className={styles.dashboard}>
      <PageHeaderComponent
        sticky={false}
        title="Session Analytics"
        subtitle={`First-party tracking for ${projectId}`}
      >
        <div className={styles.headerControls}>
          <div className={styles.periodTabs}>
            {["7d", "30d", "90d"].map((presetPeriod) => (
              <button
                key={presetPeriod}
                className={`${styles.periodTab} ${period === presetPeriod ? styles.activeTab : ""}`}
                onClick={() => setPeriod(presetPeriod)}
              >
                {presetPeriod}
              </button>
            ))}
          </div>
        </div>
      </PageHeaderComponent>

      {/* ── Back bar ──────────────────────────────────────────── */}
      <div className={styles.backBar}>
        <Link href="/web-analytics" className={styles.backButton}>
          <ArrowLeft size={12} strokeWidth={2.2} />
          All Properties
        </Link>
        <span className={styles.selectedLabel}>{projectId}</span>
        <span className={styles.selectedMeta}>First-Party Analytics</span>
      </div>

      {/* ── Realtime Banner ───────────────────────────────────── */}
      <div className={styles.realtimeBanner}>
        <div className={styles.realtimePulse}>
          <div className={styles.realtimePulseDot} />
          <div className={styles.realtimePulseRing} />
        </div>
        <div className={styles.realtimeInfo}>
          <span className={styles.realtimeLabel}>
            Active Sessions Right Now
          </span>
          <span className={styles.realtimeCount}>
            {live ? formatNumber(live.activeSessions) : "—"}
          </span>
        </div>
        <span className={styles.realtimeMeta}>
          {projectId} · sessions-service
        </span>
      </div>

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
            <div className={styles.summaryGrid}>
              <StatCard
                icon={Activity}
                label="Total Sessions"
                value={formatNumber(overview.totalSessions)}
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
            </div>
          )}

          {/* ── Sparkline Time Series ────────────────────────── */}
          {timeSeries && timeSeries.length > 0 && (
            <div className={styles.chartPanel}>
              <div className={styles.chartHeader}>
                <TrendingUp
                  size={15}
                  strokeWidth={2.2}
                  className={styles.chartHeaderIcon}
                />
                <span className={styles.chartTitle}>Daily Trends</span>
              </div>
              <div className={styles.chartBody}>
                <div className={styles.sparklineStack}>
                  {(
                    [
                      { key: "pageViews", color: SPARKLINE_COLORS.pageViews },
                      {
                        key: "uniqueVisitors",
                        color: SPARKLINE_COLORS.uniqueVisitors,
                      },
                      { key: "sessions", color: SPARKLINE_COLORS.sessions },
                    ] as const
                  ).map((metric) => {
                    const values = timeSeries.map(
                      (point) =>
                        (point as unknown as Record<string, number>)[metric.key] ||
                        0,
                    );
                    const max = Math.max(...values, 1);
                    return (
                      <ChartLineComponent
                        key={metric.key}
                        data={values}
                        color={metric.color}
                        maxValue={max}
                        height={140}
                        historyMax={values.length}
                        showGrid
                        formatValue={(value: number) => formatNumber(Math.round(value))}
                      />
                    );
                  })}
                </div>
              </div>
              <div className={styles.chartLegend}>
                <div className={styles.chartLegendItem}>
                  <div
                    className={styles.chartLegendDot}
                    style={{ background: SPARKLINE_COLORS.pageViews }}
                  />
                  Page Views
                </div>
                <div className={styles.chartLegendItem}>
                  <div
                    className={styles.chartLegendDot}
                    style={{ background: SPARKLINE_COLORS.uniqueVisitors }}
                  />
                  Visitors
                </div>
                <div className={styles.chartLegendItem}>
                  <div
                    className={styles.chartLegendDot}
                    style={{ background: SPARKLINE_COLORS.sessions }}
                  />
                  Sessions
                </div>
              </div>
            </div>
          )}

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
          <div className={styles.contentGrid}>
            {referrers && referrers.length > 0 && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <Link2
                    size={15}
                    strokeWidth={2.2}
                    className={styles.panelIcon}
                  />
                  <span className={styles.panelTitle}>Top Referrers</span>
                  <span className={styles.panelMeta}>
                    {referrers.length} sources
                  </span>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.barList}>
                    {referrers.slice(0, 10).map((r, i) => (
                      <HorizontalBar
                        key={r.referrer}
                        label={r.referrer || "(direct)"}
                        value={r.sessions}
                        max={maxReferrerSessions}
                        color={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {events && events.length > 0 && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <Zap
                    size={15}
                    strokeWidth={2.2}
                    className={styles.panelIcon}
                  />
                  <span className={styles.panelTitle}>Top Events</span>
                  <span className={styles.panelMeta}>
                    {events.length} events
                  </span>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.barList}>
                    {events.map((e, i) => (
                      <HorizontalBar
                        key={`${e.category}-${e.action}`}
                        label={`${e.category} / ${e.action}`}
                        value={e.count}
                        max={maxEventCount}
                        color={CHART_COLORS[(i + 2) % CHART_COLORS.length]}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Geography ─────────────────────────────────────── */}
          {geo && geo.length > 0 && (
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <MapPin
                  size={15}
                  strokeWidth={2.2}
                  className={styles.panelIcon}
                />
                <span className={styles.panelTitle}>Top Locations</span>
                <span className={styles.panelMeta}>{geo.length} locations</span>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.barList}>
                  {geo.slice(0, 10).map((g, i) => (
                    <HorizontalBar
                      key={`${g.country}-${g.city}`}
                      label={
                        g.city && g.city !== "(not set)"
                          ? `${g.city}, ${g.country}`
                          : g.country || "(unknown)"
                      }
                      value={g.sessions}
                      max={maxGeoSessions}
                      color={CHART_COLORS[(i + 4) % CHART_COLORS.length]}
                      suffix=" sessions"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Devices + Browsers + OS ────────────────────────── */}
          {devices && (
            <div className={styles.contentGrid}>
              {deviceTypeSegments.length > 0 && (
                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <Monitor
                      size={15}
                      strokeWidth={2.2}
                      className={styles.panelIcon}
                    />
                    <span className={styles.panelTitle}>Device Types</span>
                  </div>
                  <div className={styles.donutWrapper}>
                    <DonutChart
                      segments={deviceTypeSegments}
                      size={130}
                      strokeWidth={16}
                      centerLabel="Sessions"
                    />
                    <div className={styles.donutLegend}>
                      {devices.deviceTypes.map((deviceType, i) => (
                        <HorizontalBar
                          key={deviceType.type}
                          label={deviceType.type || "Unknown"}
                          value={deviceType.sessions}
                          max={Math.max(
                            ...devices.deviceTypes.map((dt) => dt.sessions),
                          )}
                          color={CHART_COLORS[i % CHART_COLORS.length]}
                          suffix=" sessions"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {browserSegments.length > 0 && (
                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <Globe
                      size={15}
                      strokeWidth={2.2}
                      className={styles.panelIcon}
                    />
                    <span className={styles.panelTitle}>Browsers</span>
                  </div>
                  <div className={styles.donutWrapper}>
                    <DonutChart
                      segments={browserSegments}
                      size={130}
                      strokeWidth={16}
                      centerLabel="Sessions"
                    />
                    <div className={styles.donutLegend}>
                      {devices.browsers.slice(0, 6).map((b, i) => (
                        <HorizontalBar
                          key={b.name}
                          label={b.name}
                          value={b.sessions}
                          max={Math.max(
                            ...devices.browsers.map((br) => br.sessions),
                          )}
                          color={CHART_COLORS[(i + 3) % CHART_COLORS.length]}
                          suffix=" sessions"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── OS ────────────────────────────────────────────── */}
          {osSegments.length > 0 && devices && (
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <Laptop
                  size={15}
                  strokeWidth={2.2}
                  className={styles.panelIcon}
                />
                <span className={styles.panelTitle}>Operating Systems</span>
              </div>
              <div className={styles.donutWrapper}>
                <DonutChart
                  segments={osSegments}
                  size={130}
                  strokeWidth={16}
                  centerLabel="Sessions"
                />
                <div className={styles.donutLegend}>
                  {devices.operatingSystems.slice(0, 6).map((osItem, i) => (
                    <HorizontalBar
                      key={osItem.name}
                      label={osItem.name}
                      value={osItem.sessions}
                      max={Math.max(
                        ...devices.operatingSystems.map((option) => option.sessions),
                      )}
                      color={CHART_COLORS[(i + 5) % CHART_COLORS.length]}
                      suffix=" sessions"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Session Explorer (Visitors + Sessions + Timeline) ── */}
          <SessionExplorerComponent projectId={projectId} period={period} />
        </>
      )}
    </div>
  );
}
