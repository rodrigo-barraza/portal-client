"use client";

import { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  BarChart3,
  Box,
  Cpu,
  Github,
  Globe,
  Lock,
  MemoryStick,
  Network,
  Server,
  TrendingUp,
} from "lucide-react";
import {
  AddressBadgeComponent,
  BadgeComponent,
  DateTimeBadgeComponent,
  DeviceBadgeComponent,
  DomainBadgeComponent,
  LoadingIndicatorComponent,
  PortBadgeComponent,
  RepositoryBadgeComponent,
  ResponseTimeBadgeComponent,
  StatusBadgeComponent,
  VisibilityBadgeComponent,
} from "@rodrigo-barraza/components-library";
import { formatDuration, formatElapsedTime, formatNumber } from "@rodrigo-barraza/utilities-library";
import { SERVICE_TYPE_COLORS } from "../constants";
import ApiService from "../services/ApiService";
import styles from "./ExpandedProjectPanel.module.css";

const MAX_SPARKLINE_POINTS = 60;

// ── Formatting helpers ─────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

function formatPercent(pct) {
  if (pct < 0.01) return "0%";
  if (pct < 1) return `${pct.toFixed(2)}%`;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

function severityColor(pct, thresholds = [40, 80]) {
  if (pct > thresholds[1]) return "var(--danger)";
  if (pct > thresholds[0]) return "var(--warning)";
  return "var(--success)";
}

const formatGADuration = (seconds) => {
  if (!seconds || seconds <= 0) return "0s";
  return formatElapsedTime(seconds);
};

function formatGAPercent(value) {
  if (value == null) return "0%";
  return `${(value * 100).toFixed(1)}%`;
}

// ── Sparkline (Canvas) ────────────────────────────────────────────

function Sparkline({ data, color, fillColor, max, height = 28 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length < 2) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const effectiveMax = max || Math.max(...data, 0.01);
    const padding = 1;
    const drawH = h - padding * 2;
    const step = w / (MAX_SPARKLINE_POINTS - 1);
    const startX = w - (data.length - 1) * step;

    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = startX + i * step;
      const y = padding + drawH - (data[i] / effectiveMax) * drawH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    if (fillColor) {
      const lastX = startX + (data.length - 1) * step;
      ctx.lineTo(lastX, h);
      ctx.lineTo(startX, h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, fillColor);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }, [data, color, fillColor, max, height]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.sparkline}
      style={{ height: `${height}px` }}
    />
  );
}

// ── Percentage Bar ────────────────────────────────────────────────

function PercentBar({ percent, color }) {
  const clamped = Math.min(percent, 100);
  return (
    <div className={styles.barTrack}>
      <div className={styles.barFill} style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}

// ── Tab definitions ───────────────────────────────────────────────

const TABS = [
  { id: "project", label: "Project", icon: Github },
  { id: "container", label: "Container", icon: Box },
  { id: "topology", label: "Topology", icon: Network },
  { id: "web-analytics", label: "Web Analytics", icon: TrendingUp },
];

// ── Tab: Project ──────────────────────────────────────────────────

function ProjectTab({ service }) {
  return (
    <div className={styles.projectTab}>
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Identity</h4>
        <div className={styles.fieldGrid}>
          {service.serviceType && (() => {
            const colors = SERVICE_TYPE_COLORS[service.serviceType];
            return (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Type</span>
                <BadgeComponent variant="info" style={colors ? {
                  color: colors.color,
                  background: colors.subtle,
                  borderColor: `color-mix(in srgb, ${colors.color} 25%, transparent)`,
                } : undefined}>
                  {service.serviceType}
                </BadgeComponent>
              </div>
            );
          })()}
          {service.repo && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Repository</span>
              <RepositoryBadgeComponent repo={service.repo} icons={{ Github }} />
            </div>
          )}
          {service.domain && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Domain</span>
              <DomainBadgeComponent domain={service.domain} icons={{ Globe }} />
            </div>
          )}
        </div>
      </div>

      {(service.metadata || service.checkedAt) && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Metadata</h4>
          <div className={styles.fieldGrid}>
            {service.metadata?.version && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Version</span>
                <span className={`${styles.fieldValue} ${styles.mono}`}>{service.metadata.version}</span>
              </div>
            )}
            {service.isInfrastructure && service.metadata?.uptime != null && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Uptime</span>
                <span className={styles.fieldValue}>{formatElapsedTime(service.metadata.uptime)}</span>
              </div>
            )}
            {service.isInfrastructure && service.metadata?.connections != null && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Connections</span>
                <span className={styles.fieldValue}>{service.metadata.connections}</span>
              </div>
            )}
            {service.isInfrastructure && service.metadata?.databases != null && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Databases</span>
                <span className={styles.fieldValue}>{service.metadata.databases}</span>
              </div>
            )}
            {service.isInfrastructure && service.metadata?.buckets != null && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Buckets</span>
                <span className={styles.fieldValue}>{service.metadata.buckets}</span>
              </div>
            )}
            {service.isInfrastructure && service.metadata?.bucketNames?.length > 0 && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Bucket Names</span>
                <span className={`${styles.fieldValue} ${styles.mono}`}>{service.metadata.bucketNames.join(", ")}</span>
              </div>
            )}
            {service.checkedAt && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Last Checked</span>
                <DateTimeBadgeComponent date={service.checkedAt} highlightNew />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Container ────────────────────────────────────────────────

function ContainerTab({ service, stats }) {
  return (
    <div className={styles.containerTab}>
      {/* ── Left: Container info ── */}
      <div className={styles.containerInfo}>
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Status &amp; Environment</h4>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Status</span>
              <StatusBadgeComponent healthy={service.healthy} />
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Environment</span>
              <BadgeComponent variant={service.environment === "Production" ? "success" : "info"}>
                {service.environment || "Unknown"}
              </BadgeComponent>
            </div>
            {service.visibility && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Visibility</span>
                <VisibilityBadgeComponent visibility={service.visibility} icons={{ Globe, Lock }} />
              </div>
            )}
            {service.responseTimeMs != null && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Response</span>
                <ResponseTimeBadgeComponent ms={service.responseTimeMs} formatter={formatDuration} />
              </div>
            )}
            {service.device && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Device</span>
                <DeviceBadgeComponent device={service.device} icons={{ Server }} />
              </div>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Network</h4>
          <div className={styles.fieldGrid}>
            {service.port && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Port</span>
                <PortBadgeComponent port={service.port} />
              </div>
            )}
            {service.url && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Address</span>
                <AddressBadgeComponent address={service.url} link />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: Metrics ── */}
      {stats ? (
        <div className={styles.containerMetrics}>
          {/* CPU */}
          <div className={styles.metricCard}>
            <div className={styles.metricCardHeader}>
              <Cpu size={13} strokeWidth={2.2} className={styles.metricCardIcon} />
              <span className={styles.metricCardTitle}>CPU</span>
              <span className={styles.metricCardValue} style={{ color: severityColor(stats.cpu.percent) }}>
                {formatPercent(stats.cpu.percent)}
              </span>
              <span className={styles.metricCardDim}>
                · {stats.cpu.cores} core{stats.cpu.cores !== 1 ? "s" : ""}
              </span>
            </div>
            <PercentBar percent={stats.cpu.percent} color={severityColor(stats.cpu.percent)} />
            {stats.spark?.cpu?.length >= 2 && (
              <Sparkline
                data={stats.spark.cpu}
                color={severityColor(stats.cpu.percent)}
                fillColor={stats.cpu.percent > 80 ? "rgba(239,68,68,0.12)" : stats.cpu.percent > 40 ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)"}
                max={100}
                height={36}
              />
            )}
          </div>

          {/* Memory */}
          <div className={styles.metricCard}>
            <div className={styles.metricCardHeader}>
              <MemoryStick size={13} strokeWidth={2.2} className={styles.metricCardIcon} />
              <span className={styles.metricCardTitle}>RAM</span>
              <span className={styles.metricCardValue} style={{ color: severityColor(stats.memory.percent, [60, 85]) }}>
                {formatBytes(stats.memory.used)}
              </span>
              <span className={styles.metricCardDim}>/ {formatBytes(stats.memory.limit)}</span>
              <span className={styles.metricCardValue} style={{ color: severityColor(stats.memory.percent, [60, 85]) }}>
                {formatPercent(stats.memory.percent)}
              </span>
            </div>
            <PercentBar percent={stats.memory.percent} color={severityColor(stats.memory.percent, [60, 85])} />
            {stats.spark?.mem?.length >= 2 && (
              <Sparkline
                data={stats.spark.mem}
                color={severityColor(stats.memory.percent, [60, 85])}
                fillColor={stats.memory.percent > 85 ? "rgba(239,68,68,0.12)" : stats.memory.percent > 60 ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)"}
                max={stats.memory.limit}
                height={36}
              />
            )}
          </div>

          {/* Network + Block I/O + PIDs */}
          <div className={styles.metricRow}>
            {stats.network && (stats.network.rx > 0 || stats.network.tx > 0) && (
              <div className={styles.metricCard}>
                <div className={styles.metricCardHeader}>
                  <Globe size={13} strokeWidth={2.2} className={styles.metricCardIcon} />
                  <span className={styles.metricCardTitle}>Network</span>
                </div>
                <div className={styles.ioStats}>
                  <span className={styles.ioStat}>
                    <span className={styles.ioDir}>RX</span>
                    <span className={styles.ioValue}>{formatBytes(stats.network.rx)}</span>
                  </span>
                  <span className={styles.ioStat}>
                    <span className={styles.ioDir}>TX</span>
                    <span className={styles.ioValue}>{formatBytes(stats.network.tx)}</span>
                  </span>
                </div>
              </div>
            )}

            {stats.blockIO && (stats.blockIO.read > 0 || stats.blockIO.write > 0) && (
              <div className={styles.metricCard}>
                <div className={styles.metricCardHeader}>
                  <Server size={13} strokeWidth={2.2} className={styles.metricCardIcon} />
                  <span className={styles.metricCardTitle}>Block I/O</span>
                </div>
                <div className={styles.ioStats}>
                  <span className={styles.ioStat}>
                    <span className={styles.ioDir}>Read</span>
                    <span className={styles.ioValue}>{formatBytes(stats.blockIO.read)}</span>
                  </span>
                  <span className={styles.ioStat}>
                    <span className={styles.ioDir}>Write</span>
                    <span className={styles.ioValue}>{formatBytes(stats.blockIO.write)}</span>
                  </span>
                </div>
              </div>
            )}

            {stats.pids > 0 && (
              <div className={styles.metricCard}>
                <div className={styles.metricCardHeader}>
                  <span className={styles.metricCardTitle}>PIDs</span>
                  <span className={styles.metricCardDim}>{stats.pids}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.containerMetricsEmpty}>
          <BarChart3 size={18} strokeWidth={1.5} className={styles.emptyTabIcon} />
          <span>No metrics</span>
        </div>
      )}
    </div>
  );
}

// ── Tab: Topology ─────────────────────────────────────────────────

function TopologyTab({ service }) {
  const deps = service.dependsOn || [];
  const required = deps.filter((d) => d.criticality !== "optional");
  const optional = deps.filter((d) => d.criticality === "optional");

  if (deps.length === 0) {
    return (
      <div className={styles.emptyTab}>
        <Network size={24} strokeWidth={1.5} className={styles.emptyTabIcon} />
        <span>No dependencies declared</span>
      </div>
    );
  }

  return (
    <div className={styles.topologyTab}>
      {/* Visual dependency graph */}
      <div className={styles.topologyGraph}>
        <div className={styles.topologyCenter}>
          <div className={styles.topologyNode + " " + styles.topologyNodeSelf}>
            {service.name}
          </div>
        </div>
        <div className={styles.topologyArrows}>
          {required.length > 0 && (
            <div className={styles.topologyGroup}>
              <span className={styles.topologyGroupLabel}>
                <ArrowUp size={10} strokeWidth={2.4} />
                Required
              </span>
              <div className={styles.topologyNodes}>
                {required.map((dep, i) => (
                  <div key={`req-${i}`} className={styles.topologyEdge}>
                    <div className={styles.topologyConnector} />
                    <div className={styles.topologyNode + " " + styles.topologyNodeRequired}>
                      {dep.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {optional.length > 0 && (
            <div className={styles.topologyGroup}>
              <span className={styles.topologyGroupLabel + " " + styles.topologyGroupLabelOptional}>
                <ArrowUp size={10} strokeWidth={2.4} />
                Optional
              </span>
              <div className={styles.topologyNodes}>
                {optional.map((dep, i) => (
                  <div key={`opt-${i}`} className={styles.topologyEdge}>
                    <div className={styles.topologyConnector + " " + styles.topologyConnectorOptional} />
                    <div className={styles.topologyNode + " " + styles.topologyNodeOptional}>
                      {dep.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



// ── Tab: Web Analytics ────────────────────────────────────────────

function WebAnalyticsTab({ service }) {
  const propertyId = service.analyticsPropertyId;
  const [overview, setOverview] = useState(null);
  const [pages, setPages] = useState(null);
  const [realtime, setRealtime] = useState(null);
  const [loading, setLoading] = useState(true);
  const didFetch = useRef(false);

  useEffect(() => {
    if (!propertyId || didFetch.current) return;
    didFetch.current = true;

    (async () => {
      try {
        const [ov, pg, rt] = await Promise.all([
          ApiService.getGAOverview(propertyId, "30d").catch(() => null),
          ApiService.getGAPages(propertyId, "30d").catch(() => null),
          ApiService.getGARealtime(propertyId).catch(() => null),
        ]);
        setOverview(ov);
        setPages(pg);
        setRealtime(rt);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [propertyId]);

  if (!propertyId) {
    return (
      <div className={styles.emptyTab}>
        <TrendingUp size={24} strokeWidth={1.5} className={styles.emptyTabIcon} />
        <span>No analytics property configured</span>
        <span className={styles.emptyTabHint}>
          Add <code>analyticsPropertyId</code> to this service in services.json
        </span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.emptyTab}>
        <LoadingIndicatorComponent size="small" label="Loading analytics…" />
      </div>
    );
  }

  return (
    <div className={styles.webAnalyticsTab}>
      {/* Realtime */}
      {realtime && (
        <div className={styles.realtimePill}>
          <div className={styles.realtimeDot} />
          <span className={styles.realtimeValue}>{formatNumber(realtime.activeUsers)}</span>
          <span className={styles.realtimeLabel}>active now</span>
        </div>
      )}

      {/* Overview cards */}
      {overview && (
        <div className={styles.gaCards}>
          <div className={styles.gaCard}>
            <span className={styles.gaCardValue}>{formatNumber(overview.totalUsers)}</span>
            <span className={styles.gaCardLabel}>Users</span>
          </div>
          <div className={styles.gaCard}>
            <span className={styles.gaCardValue}>{formatNumber(overview.pageviews)}</span>
            <span className={styles.gaCardLabel}>Pageviews</span>
          </div>
          <div className={styles.gaCard}>
            <span className={styles.gaCardValue}>{formatNumber(overview.sessions)}</span>
            <span className={styles.gaCardLabel}>Sessions</span>
          </div>
          <div className={styles.gaCard}>
            <span className={styles.gaCardValue}>{formatGADuration(overview.avgSessionDuration)}</span>
            <span className={styles.gaCardLabel}>Avg Duration</span>
          </div>
          <div className={styles.gaCard}>
            <span className={styles.gaCardValue}>{formatGAPercent(overview.engagementRate)}</span>
            <span className={styles.gaCardLabel}>Engagement</span>
          </div>
        </div>
      )}

      {/* Top Pages */}
      {pages?.pages?.length > 0 && (
        <div className={styles.gaSection}>
          <h4 className={styles.sectionTitle}>Top Pages (30d)</h4>
          <div className={styles.gaPageList}>
            {pages.pages.slice(0, 5).map((p, i) => (
              <div key={i} className={styles.gaPageRow}>
                <span className={`${styles.gaPagePath} ${styles.mono}`}>{p.pagePath}</span>
                <span className={styles.gaPageViews}>{formatNumber(p.pageviews)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Expanded Panel ───────────────────────────────────────────

export default function ExpandedProjectPanel({ service, stats }) {
  const [activeTab, setActiveTab] = useState("project");

  // Filter tabs: only show web-analytics if property exists
  const visibleTabs = TABS.filter((tab) => {
    if (tab.id === "web-analytics" && !service.analyticsPropertyId) return false;
    return true;
  });

  return (
    <div className={styles.panel}>
      {/* ── Tab Bar ── */}
      <div className={styles.tabBar}>
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={12} strokeWidth={2.2} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className={styles.tabContent}>
        {activeTab === "project" && <ProjectTab service={service} />}
        {activeTab === "container" && <ContainerTab service={service} stats={stats} />}
        {activeTab === "topology" && <TopologyTab service={service} />}
        {activeTab === "web-analytics" && <WebAnalyticsTab service={service} />}
      </div>

      {/* ── Error Bar ── */}
      {service.error && !service.healthy && (
        <div className={styles.errorBar}>
          {service.error}
        </div>
      )}
    </div>
  );
}
