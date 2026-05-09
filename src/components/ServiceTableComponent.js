"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowUp,
  Cpu,
  Github,
  Globe,
  Lock,
  MemoryStick,
  Play,
  RotateCcw,
  ScrollText,
  Server,
  Square,
} from "lucide-react";
import {
  AddressBadgeComponent,
  BadgeComponent,
  DateTimeBadgeComponent,
  DeviceBadgeComponent,
  DomainBadgeComponent,
  PortBadgeComponent,
  RepositoryBadgeComponent,
  ResponseTimeBadgeComponent,
  StatusBadgeComponent,
  TableComponent,
  VisibilityBadgeComponent,
} from "@rodrigo-barraza/components-library";
import { formatDuration, formatElapsedTime, getRootDomain, getSubdomain } from "@rodrigo-barraza/utilities-library";
import { SERVICE_TYPE_ICONS, SERVICE_TYPE_COLORS, DEFAULT_SERVICE_TYPE_ICON } from "../constants";
import styles from "./ServiceTableComponent.module.css";


// ── Formatting helpers ─────────────────────────────────────────────

const MAX_SPARKLINE_POINTS = 60;

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

// ── Sparkline (Canvas) ────────────────────────────────────────────

function Sparkline({ data, color, fillColor, max, height = 20 }) {
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

/**
 * Column definitions for the centralized TableComponent.
 * Each column maps to a field on the service status object.
 */
function buildColumns({ onRestart, onStop, onStart }) {
  return [
    {
      key: "name",
      label: "Project",
      sortable: true,
      render: (service) => {
        const isHealthy = service.healthy;
        const TypeIcon = SERVICE_TYPE_ICONS[service.serviceType] || DEFAULT_SERVICE_TYPE_ICON;
        return (
          <div className={styles.nameCell}>
            <TypeIcon
              size={14}
              strokeWidth={2.6}
              className={`${styles.typeIcon} ${isHealthy ? styles.iconHealthy : styles.iconUnhealthy}`}
            />
            <span className={styles.serviceName}>{service.name}</span>
          </div>
        );
      },
      sortValue: (row) => row.name || "",
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (service) => (
        <StatusBadgeComponent healthy={service.healthy} />
      ),
      sortValue: (row) => (row.healthy ? 1 : 0),
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      render: (service) => {
        if (!service.serviceType) return null;
        const colors = SERVICE_TYPE_COLORS[service.serviceType];
        return (
          <BadgeComponent
            variant="info"
            style={colors ? {
              color: colors.color,
              background: colors.subtle,
              borderColor: `color-mix(in srgb, ${colors.color} 25%, transparent)`,
            } : undefined}
          >
            {service.serviceType}
          </BadgeComponent>
        );
      },
      sortValue: (row) => row.serviceType || "",
    },
    {
      key: "visibility",
      label: "Visibility",
      sortable: true,
      render: (service) =>
        service.visibility ? (
          <VisibilityBadgeComponent visibility={service.visibility} icons={{ Globe, Lock }} />
        ) : null,
      sortValue: (row) => row.visibility || "",
    },
    {
      key: "port",
      label: "Port",
      sortable: true,
      render: (service) =>
        service.port ? (
          <PortBadgeComponent port={service.port} />
        ) : null,
      sortValue: (row) => row.port || 0,
    },
    {
      key: "address",
      label: "Address",
      sortable: true,
      description: "Internal IP and port (socket address)",
      render: (service) =>
        service.url ? (
          <AddressBadgeComponent address={service.url} link />
        ) : null,
      sortValue: (row) => row.url || "",
    },
    {
      key: "subdomain",
      label: "Subdomain",
      sortable: true,
      description: "Subdomain prefix (e.g. api.prism)",
      render: (service) => {
        const sub = getSubdomain(service.domain);
        return sub ? (
          <span className={styles.mono}>{sub}</span>
        ) : null;
      },
      sortValue: (row) => getSubdomain(row.domain),
    },
    {
      key: "domain",
      label: "Domain",
      sortable: true,
      description: "Registrable root domain",
      render: (service) => {
        const root = getRootDomain(service.domain);
        return root ? (
          <DomainBadgeComponent domain={service.domain} icons={{ Globe }} />
        ) : null;
      },
      sortValue: (row) => getRootDomain(row.domain),
    },
    {
      key: "response",
      label: "Response",
      sortable: true,
      render: (service) =>
        service.responseTimeMs != null ? (
          <ResponseTimeBadgeComponent ms={service.responseTimeMs} formatter={formatDuration} />
        ) : null,
      sortValue: (row) => row.responseTimeMs ?? Infinity,
    },
    {
      key: "device",
      label: "Device",
      sortable: true,
      render: (service) =>
        service.device ? (
          <DeviceBadgeComponent device={service.device} icons={{ Server }} />
        ) : null,
      sortValue: (row) => row.device || "",
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      align: "right",
      render: (service) => (
        <ActionCell
          service={service}
          onRestart={onRestart}
          onStop={onStop}
          onStart={onStart}
        />
      ),
    },
  ];
}

function ActionCell({ service, onRestart, onStop, onStart }) {
  const [restarting, setRestarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [starting, setStarting] = useState(false);

  const isHealthy = service.healthy;

  if (!service.restartable) return null;

  return (
    <div className={styles.actionRow}>
      {isHealthy ? (
        <button
          className={`${styles.actionBtn} ${styles.stopBtn} ${stopping ? styles.actionBtnLoading : ""}`}
          disabled={stopping || restarting}
          onClick={async (e) => {
            e.stopPropagation();
            setStopping(true);
            try { await onStop?.(service.id); }
            finally { setTimeout(() => setStopping(false), 5000); }
          }}
          title="Stop"
        >
          <Square size={9} strokeWidth={2.6} />
        </button>
      ) : (
        <button
          className={`${styles.actionBtn} ${styles.startBtn} ${starting ? styles.actionBtnLoading : ""}`}
          disabled={starting || restarting}
          onClick={async (e) => {
            e.stopPropagation();
            setStarting(true);
            try { await onStart?.(service.id); }
            finally { setTimeout(() => setStarting(false), 5000); }
          }}
          title="Start"
        >
          <Play size={9} strokeWidth={2.6} fill="currentColor" />
        </button>
      )}

      <Link
        href={`/logs?service=${service.id}`}
        className={`${styles.actionBtn} ${styles.logsBtn}`}
        title="Logs"
        onClick={(e) => e.stopPropagation()}
      >
        <ScrollText size={9} strokeWidth={2.6} />
      </Link>

      <button
        className={`${styles.actionBtn} ${styles.restartBtn} ${restarting ? styles.actionBtnLoading : ""}`}
        disabled={restarting || stopping || starting}
        onClick={async (e) => {
          e.stopPropagation();
          setRestarting(true);
          try { await onRestart?.(service.id); }
          finally { setTimeout(() => setRestarting(false), 5000); }
        }}
        title="Restart"
      >
        <RotateCcw size={9} strokeWidth={2.6} className={restarting ? styles.spin : ""} />
      </button>
    </div>
  );
}

// ── Expanded Row Detail Panel ──────────────────────────────────────

function ExpandedDetail({ service, stats }) {
  const isInfra = service.isInfrastructure;

  return (
    <div className={styles.expandedPanel}>
      {/* ── Left Column: Info ── */}
      <div className={styles.expandedInfo}>
        <div className={styles.expandedSection}>
          <h4 className={styles.expandedSectionTitle}>Project Details</h4>
          <div className={styles.expandedGrid}>
            <div className={styles.expandedField}>
              <span className={styles.expandedLabel}>Status</span>
              <StatusBadgeComponent healthy={service.healthy} />
            </div>

            <div className={styles.expandedField}>
              <span className={styles.expandedLabel}>Environment</span>
              <BadgeComponent variant={service.environment === "Production" ? "success" : "info"}>
                {service.environment || "Unknown"}
              </BadgeComponent>
            </div>

            {service.serviceType && (() => {
              const colors = SERVICE_TYPE_COLORS[service.serviceType];
              return (
                <div className={styles.expandedField}>
                  <span className={styles.expandedLabel}>Type</span>
                  <BadgeComponent
                    variant="info"
                    style={colors ? {
                      color: colors.color,
                      background: colors.subtle,
                      borderColor: `color-mix(in srgb, ${colors.color} 25%, transparent)`,
                    } : undefined}
                  >
                    {service.serviceType}
                  </BadgeComponent>
                </div>
              );
            })()}

            {service.visibility && (
              <div className={styles.expandedField}>
                <span className={styles.expandedLabel}>Visibility</span>
                <VisibilityBadgeComponent visibility={service.visibility} icons={{ Globe, Lock }} />
              </div>
            )}

            {service.responseTimeMs != null && (
              <div className={styles.expandedField}>
                <span className={styles.expandedLabel}>Response</span>
                <ResponseTimeBadgeComponent ms={service.responseTimeMs} formatter={formatDuration} />
              </div>
            )}

            {service.device && (
              <div className={styles.expandedField}>
                <span className={styles.expandedLabel}>Device</span>
                <DeviceBadgeComponent device={service.device} icons={{ Server }} />
              </div>
            )}
          </div>
        </div>

        {/* ── Network Info ── */}
        <div className={styles.expandedSection}>
          <h4 className={styles.expandedSectionTitle}>Network</h4>
          <div className={styles.expandedGrid}>
            {service.port && (
              <div className={styles.expandedField}>
                <span className={styles.expandedLabel}>Port</span>
                <PortBadgeComponent port={service.port} />
              </div>
            )}

            {service.url && (
              <div className={styles.expandedField}>
                <span className={styles.expandedLabel}>Address</span>
                <AddressBadgeComponent address={service.url} link />
              </div>
            )}

            {service.domain && (
              <div className={styles.expandedField}>
                <span className={styles.expandedLabel}>Domain</span>
                <DomainBadgeComponent domain={service.domain} icons={{ Globe }} />
              </div>
            )}
          </div>
        </div>

        {/* ── Metadata ── */}
        {(service.metadata || service.repo || service.checkedAt) && (
          <div className={styles.expandedSection}>
            <h4 className={styles.expandedSectionTitle}>Metadata</h4>
            <div className={styles.expandedGrid}>
              {service.metadata?.version && (
                <div className={styles.expandedField}>
                  <span className={styles.expandedLabel}>Version</span>
                  <span className={`${styles.expandedValue} ${styles.mono}`}>
                    {service.metadata.version}
                  </span>
                </div>
              )}

              {isInfra && service.metadata?.uptime != null && (
                <div className={styles.expandedField}>
                  <span className={styles.expandedLabel}>Uptime</span>
                  <span className={styles.expandedValue}>{formatElapsedTime(service.metadata.uptime)}</span>
                </div>
              )}

              {isInfra && service.metadata?.connections != null && (
                <div className={styles.expandedField}>
                  <span className={styles.expandedLabel}>Connections</span>
                  <span className={styles.expandedValue}>{service.metadata.connections}</span>
                </div>
              )}

              {isInfra && service.metadata?.databases != null && (
                <div className={styles.expandedField}>
                  <span className={styles.expandedLabel}>Databases</span>
                  <span className={styles.expandedValue}>{service.metadata.databases}</span>
                </div>
              )}

              {isInfra && service.metadata?.buckets != null && (
                <div className={styles.expandedField}>
                  <span className={styles.expandedLabel}>Buckets</span>
                  <span className={styles.expandedValue}>{service.metadata.buckets}</span>
                </div>
              )}

              {isInfra && service.metadata?.bucketNames?.length > 0 && (
                <div className={styles.expandedField}>
                  <span className={styles.expandedLabel}>Bucket Names</span>
                  <span className={`${styles.expandedValue} ${styles.mono}`}>
                    {service.metadata.bucketNames.join(", ")}
                  </span>
                </div>
              )}

              {service.repo && (
                <div className={styles.expandedField}>
                  <span className={styles.expandedLabel}>Repository</span>
                  <RepositoryBadgeComponent repo={service.repo} icons={{ Github }} />
                </div>
              )}

              {service.checkedAt && (
                <div className={styles.expandedField}>
                  <span className={styles.expandedLabel}>Checked</span>
                  <DateTimeBadgeComponent date={service.checkedAt} highlightNew />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Dependencies ── */}
        {service.dependsOn?.length > 0 && (() => {
          const required = service.dependsOn.filter((d) => d.criticality !== "optional");
          const optional = service.dependsOn.filter((d) => d.criticality === "optional");
          return (
            <div className={styles.expandedSection}>
              <h4 className={styles.expandedSectionTitle}>Dependencies</h4>
              {required.length > 0 && (
                <div className={styles.depsGroup}>
                  <span className={styles.depsLabel}>
                    <ArrowUp size={10} strokeWidth={2.4} />
                    Requires
                  </span>
                  <div className={styles.depsTags}>
                    {required.map((dep, i) => (
                      <span key={`req-${i}-${dep.name || dep.id || ""}`} className={styles.depTag}>
                        {dep.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {optional.length > 0 && (
                <div className={styles.depsGroup}>
                  <span className={`${styles.depsLabel} ${styles.depsLabelOptional}`}>
                    <ArrowUp size={10} strokeWidth={2.4} />
                    Optional
                  </span>
                  <div className={styles.depsTags}>
                    {optional.map((dep, i) => (
                      <span key={`opt-${i}-${dep.name || dep.id || ""}`} className={`${styles.depTag} ${styles.depTagOptional}`}>
                        {dep.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Right Column: Container Metrics ── */}
      {stats && (
        <div className={styles.expandedMetrics}>
          <h4 className={styles.expandedSectionTitle}>Container Metrics</h4>

          {/* CPU */}
          <div className={styles.metricBlock}>
            <div className={styles.metricHeader}>
              <Cpu size={11} strokeWidth={2.2} className={styles.metricIcon} />
              <span className={styles.metricLabel}>CPU</span>
              <span className={styles.metricValues}>
                <span style={{ color: severityColor(stats.cpu.percent) }}>
                  {formatPercent(stats.cpu.percent)}
                </span>
                <span className={styles.metricDim}>
                  · {stats.cpu.cores} core{stats.cpu.cores !== 1 ? "s" : ""}
                </span>
              </span>
            </div>
            <PercentBar percent={stats.cpu.percent} color={severityColor(stats.cpu.percent)} />
            {stats.spark?.cpu?.length >= 2 && (
              <Sparkline
                data={stats.spark.cpu}
                color={severityColor(stats.cpu.percent)}
                fillColor={stats.cpu.percent > 80 ? "rgba(239,68,68,0.12)" : stats.cpu.percent > 40 ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)"}
                max={100}
              />
            )}
          </div>

          {/* Memory */}
          <div className={styles.metricBlock}>
            <div className={styles.metricHeader}>
              <MemoryStick size={11} strokeWidth={2.2} className={styles.metricIcon} />
              <span className={styles.metricLabel}>RAM</span>
              <span className={styles.metricValues}>
                <span style={{ color: severityColor(stats.memory.percent, [60, 85]) }}>
                  {formatBytes(stats.memory.used)}
                </span>
                <span className={styles.metricDim}>
                  / {formatBytes(stats.memory.limit)}
                </span>
                <span style={{ color: severityColor(stats.memory.percent, [60, 85]) }}>
                  {formatPercent(stats.memory.percent)}
                </span>
              </span>
            </div>
            <PercentBar percent={stats.memory.percent} color={severityColor(stats.memory.percent, [60, 85])} />
            {stats.spark?.mem?.length >= 2 && (
              <Sparkline
                data={stats.spark.mem}
                color={severityColor(stats.memory.percent, [60, 85])}
                fillColor={stats.memory.percent > 85 ? "rgba(239,68,68,0.12)" : stats.memory.percent > 60 ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)"}
                max={stats.memory.limit}
              />
            )}
          </div>

          {/* Network I/O */}
          {stats.network && (stats.network.rx > 0 || stats.network.tx > 0) && (
            <div className={styles.metricBlock}>
              <div className={styles.metricHeader}>
                <Globe size={11} strokeWidth={2.2} className={styles.metricIcon} />
                <span className={styles.metricLabel}>Network</span>
              </div>
              <div className={styles.netStats}>
                <span className={styles.netStat}>
                  <span className={styles.netDir}>RX</span>
                  <span className={styles.netValue}>{formatBytes(stats.network.rx)}</span>
                </span>
                <span className={styles.netStat}>
                  <span className={styles.netDir}>TX</span>
                  <span className={styles.netValue}>{formatBytes(stats.network.tx)}</span>
                </span>
              </div>
            </div>
          )}

          {/* Block I/O */}
          {stats.blockIO && (stats.blockIO.read > 0 || stats.blockIO.write > 0) && (
            <div className={styles.metricBlock}>
              <div className={styles.metricHeader}>
                <Server size={11} strokeWidth={2.2} className={styles.metricIcon} />
                <span className={styles.metricLabel}>Block I/O</span>
              </div>
              <div className={styles.netStats}>
                <span className={styles.netStat}>
                  <span className={styles.netDir}>Read</span>
                  <span className={styles.netValue}>{formatBytes(stats.blockIO.read)}</span>
                </span>
                <span className={styles.netStat}>
                  <span className={styles.netDir}>Write</span>
                  <span className={styles.netValue}>{formatBytes(stats.blockIO.write)}</span>
                </span>
              </div>
            </div>
          )}

          {/* PIDs */}
          {stats.pids > 0 && (
            <div className={styles.metricBlock}>
              <div className={styles.metricHeader}>
                <span className={styles.metricLabel}>PIDs</span>
                <span className={styles.metricValues}>
                  <span className={styles.metricDim}>{stats.pids}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Error Bar ── */}
      {service.error && !service.healthy && (
        <div className={styles.expandedError}>
          {service.error}
        </div>
      )}
    </div>
  );
}

export default function ServiceTableComponent({
  services,
  containerStats = {},
  sortKey,
  sortDir,
  onSort,
  onRestart,
  onStop,
  onStart,
}) {
  const columns = useCallback(
    () => buildColumns({ onRestart, onStop, onStart }),
    [onRestart, onStop, onStart],
  )();

  const getRowClassName = useCallback(
    (row) => row.healthy ? styles.rowHealthy : styles.rowUnhealthy,
    [],
  );

  const renderExpandedContent = useCallback(
    (row) => {
      const stats = row.dockerProject ? containerStats[row.dockerProject] : null;
      return <ExpandedDetail service={row} stats={stats} />;
    },
    [containerStats],
  );

  if (services.length === 0) {
    return (
      <div className={styles.emptyState}>
        No services match the selected filters
      </div>
    );
  }

  return (
    <TableComponent
      columns={columns}
      data={services}
      getRowKey={(row) => row.id}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={(key, dir) => onSort(key, dir)}
      emptyText="No services match the selected filters"
      getRowClassName={getRowClassName}
      renderExpandedContent={renderExpandedContent}
      storageKey="service-table"
    />
  );
}
