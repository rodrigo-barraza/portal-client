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
  DatePickerComponent,
} from "@rodrigo-barraza/components-library";
import PropertyListingComponent from "./PropertyListingComponent";
import {
  Activity,
  Users,
  Eye,
  Clock,
  MousePointerClick,
  Globe,
  Monitor,
  Link2,
  ArrowLeft,
  BarChart3,
  TrendingUp,
  MapPin,
  ArrowUpRight,
  ArrowDownRight,
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
import styles from "./GoogleAnalyticsComponent.module.css";
import type {
  DonutSegment,
  SparklineMetric,
  GATimeSeriesPoint,
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
  GADeviceCategory,
  GABrowser,
  GAOperatingSystem,
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
  pageviews: "#6366f1",
  users: "#10b981",
  sessions: "#f59e0b",
};

// ── Helpers ───────────────────────────────────────────────────

/** GA returns ratios 0–1 — convert to 0–100 for the library's formatPercent */
const formatPercent = (value: number | null | undefined) => {
  if (value == null) return "0%";
  return _formatPercent(value * 100);
};

// ── Stat Card ─────────────────────────────────────────────────

function DeltaBadge({ value }: { value?: number | null }) {
  if (value == null || !isFinite(value)) return null;
  const percentage = (value * 100).toFixed(1);
  const isUp = value >= 0;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`${styles['delta-badge']} ${isUp ? styles['delta-up'] : styles['delta-down']}`}
    >
      <Icon size={12} strokeWidth={2.5} />
      {isUp ? "+" : ""}
      {percentage}%
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  delay = 0,
  delta,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  delay?: number;
  delta?: number | null;
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
        <div className={styles['stat-card-value-row']}>
          <span className={styles['stat-card-value']}>{value}</span>
          <DeltaBadge value={delta} />
        </div>
        <span className={styles['stat-card-label']}>{label}</span>
        {sub && <span className={styles['stat-card-sub']}>{sub}</span>}
      </div>
    </div>
  );
}

// ── Horizontal Bar ────────────────────────────────────────────

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

// ── Donut Chart ───────────────────────────────────────────────

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

  // Pre-compute cumulative offsets to avoid mutating during render
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

// ── Sparkline Chart (using ChartLineComponent) ───────────────

function SparklineChart({
  series,
  metrics,
}: {
  series: GATimeSeriesPoint[];
  metrics: SparklineMetric[];
}) {
  if (!series || series.length === 0) return null;

  return (
    <div className={styles['sparkline-stack']}>
      {metrics.map((metric) => {
        const values = series.map(
          (point) => (point as unknown as Record<string, number>)[metric.key] || 0,
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
  );
}

// ── Main Component ────────────────────────────────────────────

export default function GoogleAnalyticsComponent({
  propertyId,
}: {
  propertyId?: string;
} = {}) {
  const [properties, setProperties] = useState<GAProperty[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<GAProperty | null>(
    null,
  );
  const [period, setPeriod] = useState("30d");

  const [startDate, endDate] = useMemo(() => {
    if (period && period.includes("_")) {
      const [parsedStartDate, parsedEndDate] = period.split("_");
      return [parsedStartDate, parsedEndDate];
    }
    return ["", ""];
  }, [period]);

  const [realtime, setRealtime] = useState<{ activeUsers: number } | null>(
    null,
  );
  const [overview, setOverview] = useState<GAOverview | null>(null);
  const [pages, setPages] = useState<{ pages: GAPageRow[] } | null>(null);
  const [sources, setSources] = useState<{ sources: GASource[] } | null>(null);
  const [geography, setGeography] = useState<{
    locations: GALocation[];
  } | null>(null);
  const [devices, setDevices] = useState<GADevices | null>(null);
  const [timeSeries, setTimeSeries] = useState<{
    series: GATimeSeriesPoint[];
  } | null>(null);
  const [channels, setChannels] = useState<{ channels: GAChannel[] } | null>(
    null,
  );
  const [landingPages, setLandingPages] = useState<{
    pages: GALandingPageRow[];
  } | null>(null);
  const [heatmap, setHeatmap] = useState<{
    maxUsers: number;
    cells: GAHeatmapCell[];
  } | null>(null);
  const [newVsReturning, setNewVsReturning] = useState<{
    segments: GANewVsReturningSegment[];
  } | null>(null);
  const [events, setEvents] = useState<{ events: GAEvent[] } | null>(null);

  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const didFetch = useRef(false);
  const realtimeTimer = useRef<NodeJS.Timeout | null>(null);

  // ── Load Properties ───────────────────────────────────────

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    (async () => {
      try {
        const propertiesResponse = await ApiService.getGAProperties();
        const props = propertiesResponse.properties || [];
        setProperties(props);
        // Auto-select from URL param, or if exactly one property
        if (propertyId) {
          const match = props.find((propertyItem: GAProperty) => propertyItem.id === propertyId);
          if (match) setSelectedProperty(match);
        } else if (props.length === 1) {
          setSelectedProperty(props[0]);
        }
      } catch (error: unknown) {
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Load Reports ──────────────────────────────────────────

  const loadReports = useCallback(
    async (property: GAProperty | null, selectedPeriod: string) => {
      if (!property) return;
      setReportsLoading(true);

      try {
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
          ApiService.getGAOverview(property.id, selectedPeriod).catch(() => null),
          ApiService.getGAPages(property.id, selectedPeriod).catch(() => null),
          ApiService.getGASources(property.id, selectedPeriod).catch(() => null),
          ApiService.getGAGeography(property.id, selectedPeriod).catch(() => null),
          ApiService.getGADevices(property.id, selectedPeriod).catch(() => null),
          ApiService.getGATimeSeries(property.id, selectedPeriod).catch(() => null),
          ApiService.getGAChannels(property.id, selectedPeriod).catch(() => null),
          ApiService.getGALandingPages(property.id, selectedPeriod).catch(() => null),
          ApiService.getGAHeatmap(property.id, selectedPeriod).catch(() => null),
          ApiService.getGANewVsReturning(property.id, selectedPeriod).catch(() => null),
          ApiService.getGAEvents(property.id, selectedPeriod).catch(() => null),
        ]);

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
      } catch (error) {
        console.error("GA reports fetch failed:", error);
      } finally {
        setReportsLoading(false);
      }
    },
    [],
  );

  // ── Load Realtime ─────────────────────────────────────────

  const loadRealtime = useCallback(async (property: GAProperty | null) => {
    if (!property) return;
    try {
      const realtimeResponse = await ApiService.getGARealtime(property.id);
      setRealtime(realtimeResponse);
    } catch {
      // Silent fail — realtime is best-effort
    }
  }, []);

  // ── Effect: load reports + start realtime polling ─────────

  useEffect(() => {
    if (!selectedProperty) return;

    // Wrap in async IIFE to avoid synchronous setState in effect body
    const fetchAll = async () => {
      await loadReports(selectedProperty, period);
      await loadRealtime(selectedProperty);
    };
    fetchAll();

    // Poll realtime every 15 seconds
    if (realtimeTimer.current) clearInterval(realtimeTimer.current);
    realtimeTimer.current = setInterval(() => {
      loadRealtime(selectedProperty);
    }, 15_000);

    return () => {
      if (realtimeTimer.current) clearInterval(realtimeTimer.current);
    };
  }, [selectedProperty, period, loadReports, loadRealtime]);

  // ── Computed Values ───────────────────────────────────────

  const deviceSegments = useMemo(() => {
    if (!devices?.categories) return [];
    return devices.categories.map((deviceCategory, i) => ({
      value: deviceCategory.sessions,
      color: CHART_COLORS[i % CHART_COLORS.length],
      label: deviceCategory.category,
    }));
  }, [devices]);

  const browserSegments = useMemo(() => {
    if (!devices?.browsers) return [];
    return devices.browsers.map((b, i) => ({
      value: b.sessions,
      color: CHART_COLORS[(i + 3) % CHART_COLORS.length],
      label: b.browser,
    }));
  }, [devices]);

  const maxSourceSessions =
    sources?.sources && sources.sources.length > 0
      ? Math.max(...sources.sources.map((s) => s.sessions))
      : 0;

  const maxGeoUsers =
    geography?.locations && geography.locations.length > 0
      ? Math.max(...geography.locations.map((l) => l.users))
      : 0;

  const osSegments = useMemo(() => {
    if (!devices?.operatingSystems) return [];
    return devices.operatingSystems.map((osItem, i) => ({
      value: osItem.sessions,
      color: CHART_COLORS[(i + 5) % CHART_COLORS.length],
      label: osItem.os,
    }));
  }, [devices]);

  const nvrSegments = useMemo(() => {
    if (!newVsReturning?.segments) return [];
    return newVsReturning.segments.map((s, i) => ({
      value: s.users,
      color: i === 0 ? "#6366f1" : "#10b981",
      label:
        s.segment === "new"
          ? "New"
          : s.segment === "returning"
            ? "Returning"
            : s.segment,
    }));
  }, [newVsReturning]);

  const maxChannelSessions =
    channels?.channels && channels.channels.length > 0
      ? Math.max(...channels.channels.map((channel) => channel.sessions))
      : 0;

  const maxEventCount =
    events?.events && events.events.length > 0
      ? Math.max(...events.events.map((e) => e.eventCount))
      : 0;

  const maxResSessions =
    devices?.screenResolutions && devices.screenResolutions.length > 0
      ? Math.max(...devices.screenResolutions.map((r) => r.sessions))
      : 0;

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

  // ── Table columns for pages ───────────────────────────────

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
      align: "right",
      render: (row: GAPageRow) => formatNumber(row.pageviews),
    },
    {
      key: "users",
      label: "Users",
      align: "right",
      render: (row: GAPageRow) => formatNumber(row.users),
    },
    {
      key: "avgDuration",
      label: "Avg Duration",
      align: "right",
      render: (row: GAPageRow) => formatElapsedTime(row.avgDuration),
    },
    {
      key: "bounceRate",
      label: "Bounce",
      align: "right",
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
      align: "right",
      render: (row: GALandingPageRow) => formatNumber(row.sessions),
    },
    {
      key: "users",
      label: "Users",
      align: "right",
      render: (row: GALandingPageRow) => formatNumber(row.users),
    },
    {
      key: "avgDuration",
      label: "Avg Duration",
      align: "right",
      render: (row: GALandingPageRow) => formatElapsedTime(row.avgDuration),
    },
    {
      key: "bounceRate",
      label: "Bounce",
      align: "right",
      render: (row: GALandingPageRow) => formatPercent(row.bounceRate),
    },
  ];

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles['dashboard']}>
        <PageHeaderComponent
          sticky={false}
          title="Web Analytics"
          subtitle="First-party session analytics and Google Analytics (GA4) reports"
        />
        <LoadingIndicatorComponent
          size="small"
          label="Loading properties…"
          className="is-loading-centered-state"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles['dashboard']}>
        <PageHeaderComponent
          sticky={false}
          title="Web Analytics"
          subtitle="Google Analytics (GA4) reports"
        />
        <div className={styles['empty-state']}>
          <BarChart3 size={40} strokeWidth={1.5} className={styles['empty-icon']} />
          <span className={styles['empty-title']}>Analytics Error</span>
          <span className={styles['empty-detail']}>{`Error: ${error}`}</span>
        </div>
      </div>
    );
  }

  // No GA properties — still show session projects listing
  if (properties.length === 0) {
    return (
      <div className={styles['dashboard']}>
        <PageHeaderComponent
          sticky={false}
          title="Web Analytics"
          subtitle="First-party session analytics and Google Analytics (GA4) reports"
        />
        <PropertyListingComponent properties={[]} />
      </div>
    );
  }

  return (
    <div className={styles['dashboard']}>
      <PageHeaderComponent
        sticky={false}
        title="Web Analytics"
        subtitle="First-party session analytics and Google Analytics (GA4) reports"
      >
        {selectedProperty && (
          <div className={styles['header-controls']}>
            <div className={styles['period-tabs']}>
              {["7d", "30d", "90d"].map((presetPeriod) => (
                <button
                  key={presetPeriod}
                  className={`${styles['period-tab']} ${period === presetPeriod ? styles['active-tab'] : ""}`}
                  onClick={() => setPeriod(presetPeriod)}
                >
                  {presetPeriod}
                </button>
              ))}
            </div>
            <DatePickerComponent
              from={startDate}
              to={endDate}
              onChange={(value: { from: string; to: string }) => {
                if (value && value.from && value.to) {
                  setPeriod(`${value.from}_${value.to}`);
                }
              }}
              placeholder="Custom range"
            />
          </div>
        )}
      </PageHeaderComponent>

      {/* ── Property Listing (no property selected) ────────────── */}
      {!selectedProperty && !propertyId && (
        <PropertyListingComponent properties={properties} />
      )}

      {/* ── Back bar + selected property header ────────────────── */}
      {selectedProperty && properties.length > 1 && (
        <div className={styles['back-bar']}>
          <Link href="/web-analytics" className={styles['back-button']}>
            <ArrowLeft size={12} strokeWidth={2.2} />
            All Properties
          </Link>
          <span className={styles['selected-label']}>{selectedProperty.label}</span>
          <span className={styles['selected-meta']}>
            {selectedProperty.measurementId}
          </span>
        </div>
      )}

      {selectedProperty && (
        <>
          {/* ── Realtime Banner ────────────────────────────────────── */}
          <div className={styles['realtime-banner']}>
            <div className={styles['realtime-pulse']}>
              <div className={styles['realtime-pulse-dot']} />
              <div className={styles['realtime-pulse-ring']} />
            </div>
            <div className={styles['realtime-info']}>
              <span className={styles['realtime-label']}>
                Active Users Right Now
              </span>
              <span className={styles['realtime-count']}>
                {realtime ? formatNumber(realtime.activeUsers) : "—"}
              </span>
            </div>
            {selectedProperty && (
              <span className={styles['realtime-meta']}>
                {selectedProperty.label} · {selectedProperty.measurementId}
              </span>
            )}
          </div>

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

              {/* ── Sparkline Time Series ────────────────────────── */}
              {(timeSeries?.series?.length ?? 0) > 0 && (
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
                    <SparklineChart
                      series={timeSeries!.series}
                      metrics={[
                        { key: "pageviews", color: SPARKLINE_COLORS.pageviews },
                        { key: "users", color: SPARKLINE_COLORS.users },
                        { key: "sessions", color: SPARKLINE_COLORS.sessions },
                      ]}
                    />
                  </div>
                  <div className={styles['chart-legend']}>
                    <div className={styles['chart-legend-item']}>
                      <div
                        className={styles['chart-legend-dot']}
                        style={{ background: SPARKLINE_COLORS.pageviews }}
                      />
                      Pageviews
                    </div>
                    <div className={styles['chart-legend-item']}>
                      <div
                        className={styles['chart-legend-dot']}
                        style={{ background: SPARKLINE_COLORS.users }}
                      />
                      Users
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
                  getRowKey={(row: GALandingPageRow, i: number) =>
                    row.landingPage || i
                  }
                  emptyText="No landing page data"
                  mini
                />
              )}

              {/* ── Hourly Traffic Heatmap ────────────────────────── */}
              {heatmapData && (
                <div className={styles['panel']}>
                  <div className={styles['panel-header']}>
                    <Layers
                      size={15}
                      strokeWidth={2.2}
                      className={styles['panel-icon']}
                    />
                    <span className={styles['panel-title']}>
                      Traffic by Hour &amp; Day
                    </span>
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
                        <div className={styles['heatmap-row-label']}>
                          {day.slice(0, 3)}
                        </div>
                        {Array.from({ length: 24 }, (_, h) => {
                          const value = heatmapData.grid[`${day}:${h}`] || 0;
                          const intensity =
                            heatmapData.maxValue > 0
                              ? value / heatmapData.maxValue
                              : 0;
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

              {/* ── Channel Grouping + Sources ─────────────────────── */}
              <div className={styles['content-grid']}>
                {(channels?.channels?.length ?? 0) > 0 && (
                  <div className={styles['panel']}>
                    <div className={styles['panel-header']}>
                      <Layers
                        size={15}
                        strokeWidth={2.2}
                        className={styles['panel-icon']}
                      />
                      <span className={styles['panel-title']}>
                        Channel Grouping
                      </span>
                      <span className={styles['panel-meta']}>
                        {channels!.channels.length} channels
                      </span>
                    </div>
                    <div className={styles['panel-body']}>
                      <div className={styles['bar-list']}>
                        {channels!.channels.map((channel, i) => (
                          <HorizontalBar
                            key={channel.channel}
                            label={channel.channel}
                            value={channel.sessions}
                            max={maxChannelSessions}
                            color={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {(sources?.sources?.length ?? 0) > 0 && (
                  <div className={styles['panel']}>
                    <div className={styles['panel-header']}>
                      <Link2
                        size={15}
                        strokeWidth={2.2}
                        className={styles['panel-icon']}
                      />
                      <span className={styles['panel-title']}>Traffic Sources</span>
                      <span className={styles['panel-meta']}>
                        {sources!.sources.length} sources
                      </span>
                    </div>
                    <div className={styles['panel-body']}>
                      <div className={styles['bar-list']}>
                        {sources!.sources.slice(0, 10).map((s, i) => (
                          <HorizontalBar
                            key={`${s.source}-${s.medium}`}
                            label={`${s.source} / ${s.medium}`}
                            value={s.sessions}
                            max={maxSourceSessions}
                            color={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Geography + Events ─────────────────────────────── */}
              <div className={styles['content-grid']}>
                {(geography?.locations?.length ?? 0) > 0 && (
                  <div className={styles['panel']}>
                    <div className={styles['panel-header']}>
                      <MapPin
                        size={15}
                        strokeWidth={2.2}
                        className={styles['panel-icon']}
                      />
                      <span className={styles['panel-title']}>Top Locations</span>
                      <span className={styles['panel-meta']}>
                        {geography!.locations.length} locations
                      </span>
                    </div>
                    <div className={styles['panel-body']}>
                      <div className={styles['bar-list']}>
                        {geography!.locations.slice(0, 10).map((l, i) => (
                          <HorizontalBar
                            key={`${l.country}-${l.city}`}
                            label={
                              l.city && l.city !== "(not set)"
                                ? `${l.city}, ${l.country}`
                                : l.country
                            }
                            value={l.users}
                            max={maxGeoUsers}
                            color={CHART_COLORS[(i + 4) % CHART_COLORS.length]}
                            suffix=" users"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {(events?.events?.length ?? 0) > 0 && (
                  <div className={styles['panel']}>
                    <div className={styles['panel-header']}>
                      <Zap
                        size={15}
                        strokeWidth={2.2}
                        className={styles['panel-icon']}
                      />
                      <span className={styles['panel-title']}>Top Events</span>
                      <span className={styles['panel-meta']}>
                        {events!.events.length} events
                      </span>
                    </div>
                    <div className={styles['panel-body']}>
                      <div className={styles['bar-list']}>
                        {events!.events.map((e, i) => (
                          <HorizontalBar
                            key={e.eventName}
                            label={e.eventName}
                            value={e.eventCount}
                            max={maxEventCount}
                            color={CHART_COLORS[(i + 2) % CHART_COLORS.length]}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Devices + Browsers + OS ────────────────────────── */}
              {devices && (
                <div className={styles['content-grid']}>
                  {deviceSegments.length > 0 && (
                    <div className={styles['panel']}>
                      <div className={styles['panel-header']}>
                        <Monitor
                          size={15}
                          strokeWidth={2.2}
                          className={styles['panel-icon']}
                        />
                        <span className={styles['panel-title']}>
                          Device Categories
                        </span>
                      </div>
                      <div className={styles['donut-wrapper']}>
                        <DonutChart
                          segments={deviceSegments}
                          size={130}
                          strokeWidth={16}
                          centerLabel="Sessions"
                        />
                        <div className={styles['donut-legend']}>
                          {devices.categories.map(
                            (deviceCategory: GADeviceCategory, i: number) => (
                              <HorizontalBar
                                key={deviceCategory.category}
                                label={deviceCategory.category}
                                value={deviceCategory.sessions}
                                max={Math.max(
                                  ...devices.categories.map(
                                    (item: GADeviceCategory) => item.sessions,
                                  ),
                                )}
                                color={CHART_COLORS[i % CHART_COLORS.length]}
                                suffix=" sessions"
                              />
                            ),
                          )}
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
                          {devices.browsers
                            .slice(0, 6)
                            .map((b: GABrowser, i: number) => (
                              <HorizontalBar
                                key={b.browser}
                                label={b.browser}
                                value={b.sessions}
                                max={Math.max(
                                  ...devices.browsers.map(
                                    (br: GABrowser) => br.sessions,
                                  ),
                                )}
                                color={
                                  CHART_COLORS[(i + 3) % CHART_COLORS.length]
                                }
                                suffix=" sessions"
                              />
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── OS + New vs Returning + Screen Resolution ──────── */}
              <div className={styles['content-grid']}>
                {osSegments.length > 0 && (
                  <div className={styles['panel']}>
                    <div className={styles['panel-header']}>
                      <Laptop
                        size={15}
                        strokeWidth={2.2}
                        className={styles['panel-icon']}
                      />
                      <span className={styles['panel-title']}>
                        Operating Systems
                      </span>
                    </div>
                    <div className={styles['donut-wrapper']}>
                      <DonutChart
                        segments={osSegments}
                        size={130}
                        strokeWidth={16}
                        centerLabel="Sessions"
                      />
                      <div className={styles['donut-legend']}>
                        {devices?.operatingSystems
                          ?.slice(0, 6)
                          .map((osItem: GAOperatingSystem, i: number) => (
                            <HorizontalBar
                              key={osItem.os}
                              label={osItem.os}
                              value={osItem.sessions}
                              max={Math.max(
                                ...(devices.operatingSystems || []).map(
                                  (operatingSystem: GAOperatingSystem) => operatingSystem.sessions,
                                ),
                              )}
                              color={
                                CHART_COLORS[(i + 5) % CHART_COLORS.length]
                              }
                              suffix=" sessions"
                            />
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {nvrSegments.length > 0 && (
                  <div className={styles['panel']}>
                    <div className={styles['panel-header']}>
                      <RefreshCw
                        size={15}
                        strokeWidth={2.2}
                        className={styles['panel-icon']}
                      />
                      <span className={styles['panel-title']}>
                        New vs Returning
                      </span>
                    </div>
                    <div className={styles['donut-wrapper']}>
                      <DonutChart
                        segments={nvrSegments}
                        size={130}
                        strokeWidth={16}
                        centerLabel="Users"
                      />
                      <div className={styles['donut-legend']}>
                        {newVsReturning?.segments?.map(
                          (s: GANewVsReturningSegment, i: number) => (
                            <HorizontalBar
                              key={s.segment}
                              label={
                                s.segment === "new"
                                  ? "New Users"
                                  : s.segment === "returning"
                                    ? "Returning Users"
                                    : s.segment
                              }
                              value={s.users}
                              max={Math.max(
                                ...(newVsReturning.segments || []).map(
                                  (sg: GANewVsReturningSegment) => sg.users,
                                ),
                              )}
                              color={i === 0 ? "#6366f1" : "#10b981"}
                              suffix=" users"
                            />
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Screen Resolution ──────────────────────────────── */}
              {(devices?.screenResolutions?.length ?? 0) > 0 && (
                <div className={styles['panel']}>
                  <div className={styles['panel-header']}>
                    <Ruler
                      size={15}
                      strokeWidth={2.2}
                      className={styles['panel-icon']}
                    />
                    <span className={styles['panel-title']}>
                      Screen Resolutions
                    </span>
                    <span className={styles['panel-meta']}>
                      {devices!.screenResolutions.length} resolutions
                    </span>
                  </div>
                  <div className={styles['panel-body']}>
                    <div className={styles['bar-list']}>
                      {devices!.screenResolutions.map((r, i) => (
                        <HorizontalBar
                          key={r.resolution}
                          label={r.resolution}
                          value={r.sessions}
                          max={maxResSessions}
                          color={CHART_COLORS[(i + 1) % CHART_COLORS.length]}
                          suffix=" sessions"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
