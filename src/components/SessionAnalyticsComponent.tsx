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
    <div className={styles['bar-row']}>
      <div className={styles['bar-info']}>
        <span className={styles['bar-label']}>{label}</span>
        <span className={styles['bar-value']}>
          {formatNumber(value)}
          {suffix}
        </span>
      </div>
      <div className={styles['bar-track']}>
        <div
          className={styles['bar-fill']}
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
      className={styles['donut']}
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
            className={styles['donut-segment']}
            style={{ animationDelay: `${i * 100}ms` }}
          />
        );
      })}
      <text
        x={center}
        y={center - 4}
        textAnchor="middle"
        className={styles['donut-center']}
      >
        {formatNumber(total)}
      </text>
      <text
        x={center}
        y={center + 12}
        textAnchor="middle"
        className={styles['donut-center-label']}
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
    <div className={styles['stat-card']} style={{ animationDelay: `${delay}ms` }}>
      <div
        className={styles['stat-card-icon']}
        style={{ color, background: `${color}15` }}
      >
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className={styles['stat-card-content']}>
        <span className={styles['stat-card-value']}>{value}</span>
        <span className={styles['stat-card-label']}>{label}</span>
        {sub && <span className={styles['stat-card-sub']}>{sub}</span>}
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

  const liveTimer = useRef<NodeJS.Timeout | null>(null);

  // ── Load Reports ──────────────────────────────────────────

  const reportsRequestSequence = useRef(0);

  const loadReports = useCallback(
    async (selectedPeriod: string) => {
      const requestId = ++reportsRequestSequence.current;
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
    <div className={`session-analytics-component ${styles['dashboard']}`}>
      <PageHeaderComponent
        sticky={false}
        title="Session Analytics"
        subtitle={`First-party tracking for ${projectId}`}
      >
        <div className={styles['header-controls']}>
          <div className={styles['period-tabs']}>
            {["7d", "30d", "90d"].map((presetPeriod) => (
              <button
                key={presetPeriod}
                className={`${styles['period-tab']} ${period === presetPeriod ? styles['active-tab'] : ""}`}
                onClick={() => {
                  setLoading(true);
                  setPeriod(presetPeriod);
                }}
              >
                {presetPeriod}
              </button>
            ))}
          </div>
        </div>
      </PageHeaderComponent>

      {/* ── Back bar ──────────────────────────────────────────── */}
      <div className={styles['back-bar']}>
        <Link href="/web-analytics" className={styles['back-button']}>
          <ArrowLeft size={12} strokeWidth={2.2} />
          All Properties
        </Link>
        <span className={styles['selected-label']}>{projectId}</span>
        <span className={styles['selected-meta']}>First-Party Analytics</span>
      </div>

      {/* ── Realtime Banner ───────────────────────────────────── */}
      <div className={styles['realtime-banner']}>
        <div className={styles['realtime-pulse']}>
          <div className={styles['realtime-pulse-dot']} />
          <div className={styles['realtime-pulse-ring']} />
        </div>
        <div className={styles['realtime-info']}>
          <span className={styles['realtime-label']}>
            Active Sessions Right Now
          </span>
          <span className={styles['realtime-count']}>
            {live ? formatNumber(live.activeSessions) : "—"}
          </span>
        </div>
        <span className={styles['realtime-meta']}>
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
            <div className={styles['summary-grid']}>
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
            <div className={styles['chart-panel']}>
              <div className={styles['chart-header']}>
                <TrendingUp
                  size={15}
                  strokeWidth={2.2}
                  className={styles['chart-header-icon']}
                />
                <span className={styles['chart-title']}>Daily Trends</span>
              </div>
              <div className={styles['chart-body']}>
                <div className={styles['sparkline-stack']}>
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
              <div className={styles['chart-legend']}>
                <div className={styles['chart-legend-item']}>
                  <div
                    className={styles['chart-legend-dot']}
                    style={{ background: SPARKLINE_COLORS.pageViews }}
                  />
                  Page Views
                </div>
                <div className={styles['chart-legend-item']}>
                  <div
                    className={styles['chart-legend-dot']}
                    style={{ background: SPARKLINE_COLORS.uniqueVisitors }}
                  />
                  Visitors
                </div>
                <div className={styles['chart-legend-item']}>
                  <div
                    className={styles['chart-legend-dot']}
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
          <div className={styles['content-grid']}>
            {referrers && referrers.length > 0 && (
              <div className={styles['panel']}>
                <div className={styles['panel-header']}>
                  <Link2
                    size={15}
                    strokeWidth={2.2}
                    className={styles['panel-icon']}
                  />
                  <span className={styles['panel-title']}>Top Referrers</span>
                  <span className={styles['panel-meta']}>
                    {referrers.length} sources
                  </span>
                </div>
                <div className={styles['panel-body']}>
                  <div className={styles['bar-list']}>
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
              <div className={styles['panel']}>
                <div className={styles['panel-header']}>
                  <Zap
                    size={15}
                    strokeWidth={2.2}
                    className={styles['panel-icon']}
                  />
                  <span className={styles['panel-title']}>Top Events</span>
                  <span className={styles['panel-meta']}>
                    {events.length} events
                  </span>
                </div>
                <div className={styles['panel-body']}>
                  <div className={styles['bar-list']}>
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
            <div className={styles['panel']}>
              <div className={styles['panel-header']}>
                <MapPin
                  size={15}
                  strokeWidth={2.2}
                  className={styles['panel-icon']}
                />
                <span className={styles['panel-title']}>Top Locations</span>
                <span className={styles['panel-meta']}>{geo.length} locations</span>
              </div>
              <div className={styles['panel-body']}>
                <div className={styles['bar-list']}>
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
            <div className={styles['content-grid']}>
              {deviceTypeSegments.length > 0 && (
                <div className={styles['panel']}>
                  <div className={styles['panel-header']}>
                    <Monitor
                      size={15}
                      strokeWidth={2.2}
                      className={styles['panel-icon']}
                    />
                    <span className={styles['panel-title']}>Device Types</span>
                  </div>
                  <div className={styles['donut-wrapper']}>
                    <DonutChart
                      segments={deviceTypeSegments}
                      size={130}
                      strokeWidth={16}
                      centerLabel="Sessions"
                    />
                    <div className={styles['donut-legend']}>
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
                <div className={styles['panel']}>
                  <div className={styles['panel-header']}>
                    <Globe
                      size={15}
                      strokeWidth={2.2}
                      className={styles['panel-icon']}
                    />
                    <span className={styles['panel-title']}>Browsers</span>
                  </div>
                  <div className={styles['donut-wrapper']}>
                    <DonutChart
                      segments={browserSegments}
                      size={130}
                      strokeWidth={16}
                      centerLabel="Sessions"
                    />
                    <div className={styles['donut-legend']}>
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
            <div className={styles['panel']}>
              <div className={styles['panel-header']}>
                <Laptop
                  size={15}
                  strokeWidth={2.2}
                  className={styles['panel-icon']}
                />
                <span className={styles['panel-title']}>Operating Systems</span>
              </div>
              <div className={styles['donut-wrapper']}>
                <DonutChart
                  segments={osSegments}
                  size={130}
                  strokeWidth={16}
                  centerLabel="Sessions"
                />
                <div className={styles['donut-legend']}>
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
          <SessionExplorerComponent
            key={`${projectId}-${period}`}
            projectId={projectId}
            period={period}
          />
        </>
      )}
    </div>
  );
}
