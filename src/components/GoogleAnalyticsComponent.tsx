"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  LoadingIndicatorComponent,
  PageHeaderComponent,
  TableComponent,
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
import { formatElapsedTime, formatNumber, formatPercent as _formatPercent } from "@rodrigo-barraza/utilities-library";
import styles from "./GoogleAnalyticsComponent.module.css";

// ── Palette ───────────────────────────────────────────────────

const CHART_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#14b8a6", "#f97316",
];

const SPARKLINE_COLORS = {
  pageviews: "#6366f1",
  users: "#10b981",
  sessions: "#f59e0b",
};

// ── Helpers ───────────────────────────────────────────────────



/** GA returns ratios 0–1 — convert to 0–100 for the library's formatPercent */
// @ts-ignore
const formatPercent = (value: any) => {
  if (value == null) return "0%";
  return _formatPercent(value * 100);
};

// ── Stat Card ─────────────────────────────────────────────────

function DeltaBadge({ value }: { [key: string]: any }) {
  if (value == null || !isFinite(value)) return null;
  const pct = (value * 100).toFixed(1);
  const isUp = value >= 0;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`${styles.deltaBadge} ${isUp ? styles.deltaUp : styles.deltaDown}`}>
      <Icon size={12} strokeWidth={2.5} />
      {isUp ? "+" : ""}{pct}%
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, delay = 0, delta }: { [key: string]: any }) {
  return (
    <div className={styles.statCard} style={{ animationDelay: `${delay}ms` }}>
      <div className={styles.statCardIcon} style={{ color, background: `${color}15` }}>
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className={styles.statCardContent}>
        <div className={styles.statCardValueRow}>
          <span className={styles.statCardValue}>{value}</span>
          <DeltaBadge value={delta} />
        </div>
        <span className={styles.statCardLabel}>{label}</span>
        {sub && <span className={styles.statCardSub}>{sub}</span>}
      </div>
    </div>
  );
}

// ── Horizontal Bar ────────────────────────────────────────────

function HorizontalBar({ label, value, max, color, suffix = "" }: { [key: string]: any }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={styles.barRow}>
      <div className={styles.barInfo}>
        <span className={styles.barLabel}>{label}</span>
        <span className={styles.barValue}>{formatNumber(value)}{suffix}</span>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Donut Chart ───────────────────────────────────────────────

function DonutChart({ segments, size = 120, strokeWidth = 14, centerLabel = "Total" }: { [key: string]: any }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const total = segments.reduce((sum: any, s: any) => sum + s.value, 0);

  // Pre-compute cumulative offsets to avoid mutating during render
  // @ts-ignore
  const cumulativeValues = [];
  let running = 0;
  for (const seg of segments) {
    cumulativeValues.push(running);
    running += seg.value;
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.donut}>
      <circle
        cx={center} cy={center} r={radius}
        fill="none" stroke="var(--bg-tertiary)" strokeWidth={strokeWidth}
      />
      {segments.map((seg: any, i: any) => {
        const pct = total > 0 ? seg.value / total : 0;
        const dashLength = pct * circumference;
        // @ts-ignore
        const dashOffset = total > 0 ? -(cumulativeValues[i] / total) * circumference : 0;

        return (
          <circle
            key={i}
            cx={center} cy={center} r={radius}
            fill="none" stroke={seg.color}
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
      <text x={center} y={center - 4} textAnchor="middle" className={styles.donutCenter}>
        {formatNumber(total)}
      </text>
      <text x={center} y={center + 12} textAnchor="middle" className={styles.donutCenterLabel}>
        {centerLabel}
      </text>
    </svg>
  );
}

// ── Sparkline Chart ───────────────────────────────────────────

function SparklineChart({ series, metrics }: { [key: string]: any }) {
  if (!series || series.length === 0) return null;

  const width = 800;
  const height = 160;
  const padding = { top: 8, right: 8, bottom: 8, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  return (
    <div className={styles.sparklineContainer}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.sparklineSvg} preserveAspectRatio="none">
{/* @ts-ignore */}
{metrics.map((metric: any) => {
          // @ts-ignore
          const values = series.map((d: any) => d[metric.key] || 0);
          const max = Math.max(...values, 1);
          const points = values.map((v: any, i: any) => {
            const x = padding.left + (i / Math.max(values.length - 1, 1)) * innerW;
            const y = padding.top + innerH - (v / max) * innerH;
            return `${x},${y}`;
          });

          const pathD = `M ${points.join(" L ")}`;
          const areaD = `${pathD} L ${padding.left + innerW},${padding.top + innerH} L ${padding.left},${padding.top + innerH} Z`;

          return (
            <g key={metric.key}>
              <path d={areaD} fill={metric.color} className={styles.sparklineArea} />
              <path d={pathD} stroke={metric.color} className={styles.sparklinePath} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function GoogleAnalyticsComponent() {
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [period, setPeriod] = useState("30d");

  const [realtime, setRealtime] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [pages, setPages] = useState<any>(null);
  const [sources, setSources] = useState<any>(null);
  const [geography, setGeography] = useState<any>(null);
  const [devices, setDevices] = useState<any>(null);
  const [timeSeries, setTimeSeries] = useState<any>(null);
  const [channels, setChannels] = useState<any>(null);
  const [landingPages, setLandingPages] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<any>(null);
  const [newVsReturning, setNewVsReturning] = useState<any>(null);
  const [events, setEvents] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const didFetch = useRef(false);
  const realtimeTimer = useRef(null);

  // ── Load Properties ───────────────────────────────────────

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    (async () => {
      try {
        const res = await ApiService.getGAProperties();
        const props = res.properties || [];
        setProperties(props);
        // Auto-select only if exactly one property
        if (props.length === 1) {
          setSelectedProperty(props[0]);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Load Reports ──────────────────────────────────────────

  // @ts-ignore
  const loadReports = useCallback(async (property, p) => {
    if (!property) return;
    setReportsLoading(true);

    try {
      const [
        overviewRes, pagesRes, sourcesRes, geoRes, devicesRes, tsRes,
        channelsRes, landingRes, heatmapRes, nvrRes, eventsRes,
      ] = await Promise.all([
        ApiService.getGAOverview(property.id, p).catch(() => null),
        ApiService.getGAPages(property.id, p).catch(() => null),
        ApiService.getGASources(property.id, p).catch(() => null),
        ApiService.getGAGeography(property.id, p).catch(() => null),
        ApiService.getGADevices(property.id, p).catch(() => null),
        ApiService.getGATimeSeries(property.id, p).catch(() => null),
        ApiService.getGAChannels(property.id, p).catch(() => null),
        ApiService.getGALandingPages(property.id, p).catch(() => null),
        ApiService.getGAHeatmap(property.id, p).catch(() => null),
        ApiService.getGANewVsReturning(property.id, p).catch(() => null),
        ApiService.getGAEvents(property.id, p).catch(() => null),
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
    } catch (err) {
      console.error("GA reports fetch failed:", err);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  // ── Load Realtime ─────────────────────────────────────────

  const loadRealtime = useCallback(async (property: any) => {
    if (!property) return;
    try {
      const res = await ApiService.getGARealtime(property.id);
      setRealtime(res);
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
    // @ts-ignore
    clearInterval(realtimeTimer.current);
    // @ts-ignore
    realtimeTimer.current = setInterval(() => {
      loadRealtime(selectedProperty);
    }, 15_000);

    // @ts-ignore
    return () => clearInterval(realtimeTimer.current);
  }, [selectedProperty, period, loadReports, loadRealtime]);

  // ── Computed Values ───────────────────────────────────────

  const deviceSegments = useMemo(() => {
    if (!devices?.categories) return [];
    return devices.categories.map((d: any, i: any) => ({
      value: d.sessions,
      color: CHART_COLORS[i % CHART_COLORS.length],
      label: d.category,
    }));
  }, [devices]);

  const browserSegments = useMemo(() => {
    if (!devices?.browsers) return [];
    return devices.browsers.map((b: any, i: any) => ({
      value: b.sessions,
      color: CHART_COLORS[(i + 3) % CHART_COLORS.length],
      label: b.browser,
    }));
  }, [devices]);

  const maxSourceSessions = sources?.sources?.length > 0
    // @ts-ignore
    ? Math.max(...sources.sources.map((s) => s.sessions))
    : 0;

  const maxGeoUsers = geography?.locations?.length > 0
    // @ts-ignore
    ? Math.max(...geography.locations.map((l) => l.users))
    : 0;

  const osSegments = useMemo(() => {
    if (!devices?.operatingSystems) return [];
    return devices.operatingSystems.map((d: any, i: any) => ({
      value: d.sessions,
      color: CHART_COLORS[(i + 5) % CHART_COLORS.length],
      label: d.os,
    }));
  }, [devices]);

  const nvrSegments = useMemo(() => {
    if (!newVsReturning?.segments) return [];
    return newVsReturning.segments.map((s: any, i: any) => ({
      value: s.users,
      color: i === 0 ? "#6366f1" : "#10b981",
      label: s.segment === "new" ? "New" : s.segment === "returning" ? "Returning" : s.segment,
    }));
  }, [newVsReturning]);

  const maxChannelSessions = channels?.channels?.length > 0
    // @ts-ignore
    ? Math.max(...channels.channels.map((c) => c.sessions))
    : 0;

  const maxEventCount = events?.events?.length > 0
    // @ts-ignore
    ? Math.max(...events.events.map((e) => e.eventCount))
    : 0;

  const maxResSessions = devices?.screenResolutions?.length > 0
    // @ts-ignore
    ? Math.max(...devices.screenResolutions.map((r) => r.sessions))
    : 0;

  // ── Heatmap data processing ───────────────────────────────

  const heatmapData = useMemo(() => {
    if (!heatmap?.cells) return null;
    const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const grid = {};
    let maxVal = 0;
    for (const cell of heatmap.cells) {
      const key = `${cell.day}:${cell.hour}`;
      // @ts-ignore
      grid[key] = (grid[key] || 0) + cell.users;
      // @ts-ignore
      if (grid[key] > maxVal) maxVal = grid[key];
    }
    return { grid, dayOrder, maxVal };
  }, [heatmap]);

  // ── Table columns for pages ───────────────────────────────

  const pageColumns = [
    {
      key: "pagePath",
      label: "Page",
      render: (row: any) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
          {row.pagePath}
        </span>
      ),
    },
    { key: "pageviews", label: "Views", align: "right", render: (row: any) => formatNumber(row.pageviews) },
    { key: "users", label: "Users", align: "right", render: (row: any) => formatNumber(row.users) },
    { key: "avgDuration", label: "Avg Duration", align: "right", render: (row: any) => formatElapsedTime(row.avgDuration) },
    { key: "bounceRate", label: "Bounce", align: "right", render: (row: any) => formatPercent(row.bounceRate) },
  ];

  const landingColumns = [
    {
      key: "landingPage",
      label: "Landing Page",
      render: (row: any) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
          {row.landingPage}
        </span>
      ),
    },
    { key: "sessions", label: "Sessions", align: "right", render: (row: any) => formatNumber(row.sessions) },
    { key: "users", label: "Users", align: "right", render: (row: any) => formatNumber(row.users) },
    { key: "avgDuration", label: "Avg Duration", align: "right", render: (row: any) => formatElapsedTime(row.avgDuration) },
    { key: "bounceRate", label: "Bounce", align: "right", render: (row: any) => formatPercent(row.bounceRate) },
  ];

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <PageHeaderComponent sticky={false} title="Web Analytics" subtitle="Google Analytics (GA4) reports" />
        <LoadingIndicatorComponent size="small" label="Loading properties…" className="loading-center" />
      </div>
    );
  }

  if (error || properties.length === 0) {
    return (
      <div className={styles.dashboard}>
        <PageHeaderComponent sticky={false} title="Web Analytics" subtitle="Google Analytics (GA4) reports" />
        <div className={styles.emptyState}>
          <BarChart3 size={40} strokeWidth={1.5} className={styles.emptyIcon} />
          <span className={styles.emptyTitle}>No Analytics Properties Configured</span>
          <span className={styles.emptyDetail}>
            {error
              ? `Error: ${error}`
              : "Add GOOGLE_ANALYTICS_CREDENTIALS to your vault environment and declare analyticsPropertyId on project entries in projects.json to start tracking."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <PageHeaderComponent sticky={false} title="Web Analytics" subtitle="Google Analytics (GA4) reports">
        {selectedProperty && (
          <div className={styles.headerControls}>
            <div className={styles.periodTabs}>
              {["7d", "30d", "90d"].map((p) => (
                <button
                  key={p}
                  className={`${styles.periodTab} ${period === p ? styles.activeTab : ""}`}
                  onClick={() => setPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </PageHeaderComponent>

      {/* ── Property Listing (no property selected) ────────────── */}
      {!selectedProperty && (
        <PropertyListingComponent
          properties={properties}
          // @ts-ignore
          onSelect={(prop: any) => setSelectedProperty(prop)}
        />
      )}

      {/* ── Back bar + selected property header ────────────────── */}
      {selectedProperty && properties.length > 1 && (
        <div className={styles.backBar}>
          <button className={styles.backBtn} onClick={() => setSelectedProperty(null)}>
            <ArrowLeft size={12} strokeWidth={2.2} />
            All Properties
          </button>
          <span className={styles.selectedLabel}>{selectedProperty.label}</span>
          <span className={styles.selectedMeta}>{selectedProperty.measurementId}</span>
        </div>
      )}

      {selectedProperty && (
      <>
      {/* ── Realtime Banner ────────────────────────────────────── */}
      <div className={styles.realtimeBanner}>
        <div className={styles.realtimePulse}>
          <div className={styles.realtimePulseDot} />
          <div className={styles.realtimePulseRing} />
        </div>
        <div className={styles.realtimeInfo}>
          <span className={styles.realtimeLabel}>Active Users Right Now</span>
          <span className={styles.realtimeCount}>
            {realtime ? formatNumber(realtime.activeUsers) : "—"}
          </span>
        </div>
        {selectedProperty && (
          <span className={styles.realtimeMeta}>
            {selectedProperty.label} · {selectedProperty.measurementId}
          </span>
        )}
      </div>

      {reportsLoading ? (
        <LoadingIndicatorComponent size="small" label="Loading analytics…" className="loading-center" />
      ) : (
        <>
          {/* ── Overview Cards ────────────────────────────────── */}
          {overview && (
            <div className={styles.summaryGrid}>
              <StatCard icon={Users} label="Total Users" value={formatNumber(overview.totalUsers)}
                sub={`${formatNumber(overview.newUsers)} new`} color="#6366f1" delay={0} delta={overview.deltas?.totalUsers} />
              <StatCard icon={Eye} label="Pageviews" value={formatNumber(overview.pageviews)}
                color="#8b5cf6" delay={50} delta={overview.deltas?.pageviews} />
              <StatCard icon={Activity} label="Sessions" value={formatNumber(overview.sessions)}
                sub={`${formatNumber(overview.engagedSessions)} engaged`} color="#10b981" delay={100} delta={overview.deltas?.sessions} />
              <StatCard icon={Clock} label="Avg Duration" value={formatElapsedTime(overview.avgSessionDuration)}
                color="#3b82f6" delay={150} delta={overview.deltas?.avgSessionDuration} />
              <StatCard icon={MousePointerClick} label="Engagement" value={formatPercent(overview.engagementRate)}
                sub={`${formatPercent(overview.bounceRate)} bounce`} color="#f59e0b" delay={200} delta={overview.deltas?.engagementRate} />
            </div>
          )}

          {/* ── Sparkline Time Series ────────────────────────── */}
          {timeSeries?.series?.length > 0 && (
            <div className={styles.chartPanel}>
              <div className={styles.chartHeader}>
                <TrendingUp size={15} strokeWidth={2.2} className={styles.chartHeaderIcon} />
                <span className={styles.chartTitle}>Daily Trends</span>
              </div>
              <div className={styles.chartBody}>
                <SparklineChart
                  series={timeSeries.series}
                  metrics={[
                    { key: "pageviews", color: SPARKLINE_COLORS.pageviews },
                    { key: "users", color: SPARKLINE_COLORS.users },
                    { key: "sessions", color: SPARKLINE_COLORS.sessions },
                  ]}
                />
              </div>
              <div className={styles.chartLegend}>
                <div className={styles.chartLegendItem}>
                  <div className={styles.chartLegendDot} style={{ background: SPARKLINE_COLORS.pageviews }} />
                  Pageviews
                </div>
                <div className={styles.chartLegendItem}>
                  <div className={styles.chartLegendDot} style={{ background: SPARKLINE_COLORS.users }} />
                  Users
                </div>
                <div className={styles.chartLegendItem}>
                  <div className={styles.chartLegendDot} style={{ background: SPARKLINE_COLORS.sessions }} />
                  Sessions
                </div>
              </div>
            </div>
          )}

          {/* ── Top Pages ────────────────────────────────────── */}
          {pages?.pages?.length > 0 && (
            <TableComponent title="Top Pages" columns={pageColumns} data={pages.pages}
              getRowKey={(row: any, i: any) => row.pagePath || i} emptyText="No page data available" mini />
          )}

          {/* ── Landing Pages ─────────────────────────────────── */}
          {landingPages?.pages?.length > 0 && (
            <TableComponent title="Landing Pages" columns={landingColumns} data={landingPages.pages}
              getRowKey={(row: any, i: any) => row.landingPage || i} emptyText="No landing page data" mini />
          )}

          {/* ── Hourly Traffic Heatmap ────────────────────────── */}
          {heatmapData && (
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <Layers size={15} strokeWidth={2.2} className={styles.panelIcon} />
                <span className={styles.panelTitle}>Traffic by Hour &amp; Day</span>
              </div>
              <div className={styles.heatmapContainer}>
                <div className={styles.heatmapCorner} />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className={styles.heatmapColLabel}>{h}</div>
                ))}
                {heatmapData.dayOrder.map((day) => (
                  <React.Fragment key={day}>
                    <div className={styles.heatmapRowLabel}>{day.slice(0, 3)}</div>
                    {Array.from({ length: 24 }, (_, h) => {
                      // @ts-ignore
                      const val = heatmapData.grid[`${day}:${h}`] || 0;
                      const intensity = heatmapData.maxVal > 0 ? val / heatmapData.maxVal : 0;
                      return (
                        <div
                          key={h}
                          className={styles.heatmapCell}
                          style={{ background: `rgba(99, 102, 241, ${0.06 + intensity * 0.84})` }}
                          title={`${day} ${h}:00 — ${val} users`}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* ── Channel Grouping + Sources ─────────────────────── */}
          <div className={styles.contentGrid}>
            {channels?.channels?.length > 0 && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <Layers size={15} strokeWidth={2.2} className={styles.panelIcon} />
                  <span className={styles.panelTitle}>Channel Grouping</span>
                  <span className={styles.panelMeta}>{channels.channels.length} channels</span>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.barList}>
                    {channels.channels.map((c: any, i: any) => (
                      <HorizontalBar key={c.channel} label={c.channel} value={c.sessions}
                        max={maxChannelSessions} color={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {sources?.sources?.length > 0 && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <Link2 size={15} strokeWidth={2.2} className={styles.panelIcon} />
                  <span className={styles.panelTitle}>Traffic Sources</span>
                  <span className={styles.panelMeta}>{sources.sources.length} sources</span>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.barList}>
                    {sources.sources.slice(0, 10).map((s: any, i: any) => (
                      <HorizontalBar key={`${s.source}-${s.medium}`} label={`${s.source} / ${s.medium}`}
                        value={s.sessions} max={maxSourceSessions} color={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Geography + Events ─────────────────────────────── */}
          <div className={styles.contentGrid}>
            {geography?.locations?.length > 0 && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <MapPin size={15} strokeWidth={2.2} className={styles.panelIcon} />
                  <span className={styles.panelTitle}>Top Locations</span>
                  <span className={styles.panelMeta}>{geography.locations.length} locations</span>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.barList}>
                    {geography.locations.slice(0, 10).map((l: any, i: any) => (
                      <HorizontalBar key={`${l.country}-${l.city}`}
                        label={l.city && l.city !== "(not set)" ? `${l.city}, ${l.country}` : l.country}
                        value={l.users} max={maxGeoUsers} color={CHART_COLORS[(i + 4) % CHART_COLORS.length]} suffix=" users" />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {events?.events?.length > 0 && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <Zap size={15} strokeWidth={2.2} className={styles.panelIcon} />
                  <span className={styles.panelTitle}>Top Events</span>
                  <span className={styles.panelMeta}>{events.events.length} events</span>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.barList}>
                    {events.events.map((e: any, i: any) => (
                      <HorizontalBar key={e.eventName} label={e.eventName} value={e.eventCount}
                        max={maxEventCount} color={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Devices + Browsers + OS ────────────────────────── */}
          {devices && (
            <div className={styles.contentGrid}>
              {deviceSegments.length > 0 && (
                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <Monitor size={15} strokeWidth={2.2} className={styles.panelIcon} />
                    <span className={styles.panelTitle}>Device Categories</span>
                  </div>
                  <div className={styles.donutWrapper}>
                    <DonutChart segments={deviceSegments} size={130} strokeWidth={16} centerLabel="Sessions" />
                    <div className={styles.donutLegend}>
                      {devices.categories.map((d: any, i: any) => (
                        <HorizontalBar key={d.category} label={d.category} value={d.sessions}
                          // @ts-ignore
                          max={Math.max(...devices.categories.map((c) => c.sessions))}
                          color={CHART_COLORS[i % CHART_COLORS.length]} suffix=" sessions" />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {browserSegments.length > 0 && (
                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <Globe size={15} strokeWidth={2.2} className={styles.panelIcon} />
                    <span className={styles.panelTitle}>Browsers</span>
                  </div>
                  <div className={styles.donutWrapper}>
                    <DonutChart segments={browserSegments} size={130} strokeWidth={16} centerLabel="Sessions" />
                    <div className={styles.donutLegend}>
                      {devices.browsers.slice(0, 6).map((b: any, i: any) => (
                        <HorizontalBar key={b.browser} label={b.browser} value={b.sessions}
                          // @ts-ignore
                          max={Math.max(...devices.browsers.map((br) => br.sessions))}
                          color={CHART_COLORS[(i + 3) % CHART_COLORS.length]} suffix=" sessions" />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── OS + New vs Returning + Screen Resolution ──────── */}
          <div className={styles.contentGrid}>
            {osSegments.length > 0 && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <Laptop size={15} strokeWidth={2.2} className={styles.panelIcon} />
                  <span className={styles.panelTitle}>Operating Systems</span>
                </div>
                <div className={styles.donutWrapper}>
                  <DonutChart segments={osSegments} size={130} strokeWidth={16} centerLabel="Sessions" />
                  <div className={styles.donutLegend}>
                    {devices?.operatingSystems?.slice(0, 6).map((d: any, i: any) => (
                      <HorizontalBar key={d.os} label={d.os} value={d.sessions}
                        // @ts-ignore
                        max={Math.max(...(devices.operatingSystems || []).map((o) => o.sessions))}
                        color={CHART_COLORS[(i + 5) % CHART_COLORS.length]} suffix=" sessions" />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {nvrSegments.length > 0 && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <RefreshCw size={15} strokeWidth={2.2} className={styles.panelIcon} />
                  <span className={styles.panelTitle}>New vs Returning</span>
                </div>
                <div className={styles.donutWrapper}>
                  <DonutChart segments={nvrSegments} size={130} strokeWidth={16} centerLabel="Users" />
                  <div className={styles.donutLegend}>
                    {newVsReturning?.segments?.map((s: any, i: any) => (
                      <HorizontalBar key={s.segment} label={s.segment === "new" ? "New Users" : s.segment === "returning" ? "Returning Users" : s.segment}
                        // @ts-ignore
                        value={s.users} max={Math.max(...(newVsReturning.segments || []).map((sg) => sg.users))}
                        color={i === 0 ? "#6366f1" : "#10b981"} suffix=" users" />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Screen Resolution ──────────────────────────────── */}
          {devices?.screenResolutions?.length > 0 && (
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <Ruler size={15} strokeWidth={2.2} className={styles.panelIcon} />
                <span className={styles.panelTitle}>Screen Resolutions</span>
                <span className={styles.panelMeta}>{devices.screenResolutions.length} resolutions</span>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.barList}>
                  {devices.screenResolutions.map((r: any, i: any) => (
                    <HorizontalBar key={r.resolution} label={r.resolution} value={r.sessions}
                      max={maxResSessions} color={CHART_COLORS[(i + 1) % CHART_COLORS.length]} suffix=" sessions" />
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
