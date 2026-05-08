"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  LoadingIndicatorComponent,
  PageHeaderComponent,
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
  BarChart3,
  TrendingUp,
  MapPin,
} from "lucide-react";

import ApiService from "../services/ApiService";
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

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatPercent(value) {
  if (value == null) return "0%";
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(n) {
  if (n == null) return "0";
  return n.toLocaleString();
}

// ── Stat Card ─────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color, delay = 0 }) {
  return (
    <div className={styles.statCard} style={{ animationDelay: `${delay}ms` }}>
      <div className={styles.statCardIcon} style={{ color, background: `${color}15` }}>
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

// ── Horizontal Bar ────────────────────────────────────────────

function HorizontalBar({ label, value, max, color, suffix = "" }) {
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

function DonutChart({ segments, size = 120, strokeWidth = 14, centerLabel = "Total" }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  // Pre-compute cumulative offsets to avoid mutating during render
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
      {segments.map((seg, i) => {
        const pct = total > 0 ? seg.value / total : 0;
        const dashLength = pct * circumference;
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

function SparklineChart({ series, metrics }) {
  if (!series || series.length === 0) return null;

  const width = 800;
  const height = 160;
  const padding = { top: 8, right: 8, bottom: 8, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  return (
    <div className={styles.sparklineContainer}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.sparklineSvg} preserveAspectRatio="none">
        {metrics.map((metric) => {
          const values = series.map((d) => d[metric.key] || 0);
          const max = Math.max(...values, 1);
          const points = values.map((v, i) => {
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
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [period, setPeriod] = useState("30d");

  const [realtime, setRealtime] = useState(null);
  const [overview, setOverview] = useState(null);
  const [pages, setPages] = useState(null);
  const [sources, setSources] = useState(null);
  const [geography, setGeography] = useState(null);
  const [devices, setDevices] = useState(null);
  const [timeSeries, setTimeSeries] = useState(null);

  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [error, setError] = useState(null);

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
        if (props.length > 0) {
          setSelectedProperty(props[0]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Load Reports ──────────────────────────────────────────

  const loadReports = useCallback(async (property, p) => {
    if (!property) return;
    setReportsLoading(true);

    try {
      const [overviewRes, pagesRes, sourcesRes, geoRes, devicesRes, tsRes] = await Promise.all([
        ApiService.getGAOverview(property.id, p).catch(() => null),
        ApiService.getGAPages(property.id, p).catch(() => null),
        ApiService.getGASources(property.id, p).catch(() => null),
        ApiService.getGAGeography(property.id, p).catch(() => null),
        ApiService.getGADevices(property.id, p).catch(() => null),
        ApiService.getGATimeSeries(property.id, p).catch(() => null),
      ]);

      setOverview(overviewRes);
      setPages(pagesRes);
      setSources(sourcesRes);
      setGeography(geoRes);
      setDevices(devicesRes);
      setTimeSeries(tsRes);
    } catch (err) {
      console.error("GA reports fetch failed:", err);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  // ── Load Realtime ─────────────────────────────────────────

  const loadRealtime = useCallback(async (property) => {
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
    clearInterval(realtimeTimer.current);
    realtimeTimer.current = setInterval(() => {
      loadRealtime(selectedProperty);
    }, 15_000);

    return () => clearInterval(realtimeTimer.current);
  }, [selectedProperty, period, loadReports, loadRealtime]);

  // ── Computed Values ───────────────────────────────────────

  const deviceSegments = useMemo(() => {
    if (!devices?.categories) return [];
    return devices.categories.map((d, i) => ({
      value: d.sessions,
      color: CHART_COLORS[i % CHART_COLORS.length],
      label: d.category,
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

  const maxSourceSessions = sources?.sources?.length > 0
    ? Math.max(...sources.sources.map((s) => s.sessions))
    : 0;

  const maxGeoUsers = geography?.locations?.length > 0
    ? Math.max(...geography.locations.map((l) => l.users))
    : 0;

  // ── Table columns for pages ───────────────────────────────

  const pageColumns = [
    {
      key: "pagePath",
      label: "Page",
      render: (row) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
          {row.pagePath}
        </span>
      ),
    },
    { key: "pageviews", label: "Views", align: "right", render: (row) => formatNumber(row.pageviews) },
    { key: "users", label: "Users", align: "right", render: (row) => formatNumber(row.users) },
    { key: "avgDuration", label: "Avg Duration", align: "right", render: (row) => formatDuration(row.avgDuration) },
    { key: "bounceRate", label: "Bounce", align: "right", render: (row) => formatPercent(row.bounceRate) },
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
              : "Add GOOGLE_ANALYTICS_CREDENTIALS and GOOGLE_ANALYTICS_PROPERTIES to your vault environment to start tracking."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <PageHeaderComponent sticky={false} title="Web Analytics" subtitle="Google Analytics (GA4) reports">
        <div className={styles.headerControls}>
          {properties.length > 1 && (
            <select
              className={styles.propertySelect}
              value={selectedProperty?.id || ""}
              onChange={(e) => {
                const prop = properties.find((p) => p.id === e.target.value);
                setSelectedProperty(prop);
              }}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
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
      </PageHeaderComponent>

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
              <StatCard
                icon={Users}
                label="Total Users"
                value={formatNumber(overview.totalUsers)}
                sub={`${formatNumber(overview.newUsers)} new`}
                color="#6366f1"
                delay={0}
              />
              <StatCard
                icon={Eye}
                label="Pageviews"
                value={formatNumber(overview.pageviews)}
                color="#8b5cf6"
                delay={50}
              />
              <StatCard
                icon={Activity}
                label="Sessions"
                value={formatNumber(overview.sessions)}
                sub={`${formatNumber(overview.engagedSessions)} engaged`}
                color="#10b981"
                delay={100}
              />
              <StatCard
                icon={Clock}
                label="Avg Duration"
                value={formatDuration(overview.avgSessionDuration)}
                color="#3b82f6"
                delay={150}
              />
              <StatCard
                icon={MousePointerClick}
                label="Engagement"
                value={formatPercent(overview.engagementRate)}
                sub={`${formatPercent(overview.bounceRate)} bounce`}
                color="#f59e0b"
                delay={200}
              />
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
            <TableComponent
              title="Top Pages"
              columns={pageColumns}
              data={pages.pages}
              getRowKey={(row, i) => row.pagePath || i}
              emptyText="No page data available"
              mini
            />
          )}

          {/* ── Two-Column Grid: Sources + Geography ─────────── */}
          <div className={styles.contentGrid}>
            {/* ── Traffic Sources ── */}
            {sources?.sources?.length > 0 && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <Link2 size={15} strokeWidth={2.2} className={styles.panelIcon} />
                  <span className={styles.panelTitle}>Traffic Sources</span>
                  <span className={styles.panelMeta}>{sources.sources.length} sources</span>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.barList}>
                    {sources.sources.slice(0, 10).map((s, i) => (
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

            {/* ── Geography ── */}
            {geography?.locations?.length > 0 && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <MapPin size={15} strokeWidth={2.2} className={styles.panelIcon} />
                  <span className={styles.panelTitle}>Top Locations</span>
                  <span className={styles.panelMeta}>{geography.locations.length} locations</span>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.barList}>
                    {geography.locations.slice(0, 10).map((l, i) => (
                      <HorizontalBar
                        key={`${l.country}-${l.city}`}
                        label={l.city && l.city !== "(not set)" ? `${l.city}, ${l.country}` : l.country}
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
          </div>

          {/* ── Two-Column Grid: Devices + Browsers ──────────── */}
          {devices && (
            <div className={styles.contentGrid}>
              {/* ── Device Categories ── */}
              {deviceSegments.length > 0 && (
                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <Monitor size={15} strokeWidth={2.2} className={styles.panelIcon} />
                    <span className={styles.panelTitle}>Device Categories</span>
                  </div>
                  <div className={styles.donutWrapper}>
                    <DonutChart segments={deviceSegments} size={130} strokeWidth={16} centerLabel="Sessions" />
                    <div className={styles.donutLegend}>
                      {devices.categories.map((d, i) => {
                        return (
                          <HorizontalBar
                            key={d.category}
                            label={d.category}
                            value={d.sessions}
                            max={Math.max(...devices.categories.map((c) => c.sessions))}
                            color={CHART_COLORS[i % CHART_COLORS.length]}
                            suffix=" sessions"
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Browsers ── */}
              {browserSegments.length > 0 && (
                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <Globe size={15} strokeWidth={2.2} className={styles.panelIcon} />
                    <span className={styles.panelTitle}>Browsers</span>
                  </div>
                  <div className={styles.donutWrapper}>
                    <DonutChart segments={browserSegments} size={130} strokeWidth={16} centerLabel="Sessions" />
                    <div className={styles.donutLegend}>
                      {devices.browsers.slice(0, 6).map((b, i) => (
                        <HorizontalBar
                          key={b.browser}
                          label={b.browser}
                          value={b.sessions}
                          max={Math.max(...devices.browsers.map((br) => br.sessions))}
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
        </>
      )}
    </div>
  );
}
