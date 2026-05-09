"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowUp, Cpu, Github, Globe, Lock, MemoryStick, Play, RotateCcw, ScrollText, Server, Square } from "lucide-react";
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
  VisibilityBadgeComponent,
} from "@rodrigo-barraza/components-library";
import { formatDuration, formatElapsedTime } from "@rodrigo-barraza/utilities-library";
import { SERVICE_TYPE_ICONS, SERVICE_TYPE_COLORS, DEPLOY_TIER_COLORS, DEFAULT_SERVICE_TYPE_ICON } from "../constants";
import styles from "./ServiceCardComponent.module.css";


const MAX_SPARKLINE_POINTS = 60;

/** Format bytes to human-readable. */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

/** Format percentage. */
function formatPercent(pct) {
  if (pct < 0.01) return "0%";
  if (pct < 1) return `${pct.toFixed(2)}%`;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

/** Severity color from percentage. */
function severityColor(pct, thresholds = [40, 80]) {
  if (pct > thresholds[1]) return "var(--danger)";
  if (pct > thresholds[0]) return "var(--warning)";
  return "var(--success)";
}

// ── Inline Sparkline Canvas ────────────────────────────────────────
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

// ── Percentage Bar ──────────────────────────────────────────────
function PercentBar({ percent, color }) {
  const clamped = Math.min(percent, 100);
  return (
    <div className={styles.barTrack}>
      <div className={styles.barFill} style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}

export default function ServiceCardComponent({ service, containerStats, onRestart, onStop, onStart }) {
  const [restarting, setRestarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [starting, setStarting] = useState(false);
  const isHealthy = service.healthy;
  const statusClass = isHealthy ? styles.healthy : styles.unhealthy;
  const isProduction = service.environment === "Production";
  const isInfra = service.isInfrastructure;

  const TypeIcon = SERVICE_TYPE_ICONS[service.projectType] || DEFAULT_SERVICE_TYPE_ICON;

  return (
    <div className={`${styles.card} ${statusClass}`}>
      <div className={styles.cardHeader}>
        <div className={styles.nameRow}>
          <TypeIcon
            size={16}
            strokeWidth={2.6}
            className={`${styles.infraIcon} ${statusClass}`}
          />
          <span className={styles.name}>{service.name}</span>
        </div>
      </div>

      <div className={styles.details}>
        {/* ── Action Buttons (containerized services only) ── */}
        {service.restartable && (
          <div className={styles.actionRow}>
            {isHealthy ? (
              <button
                className={`${styles.actionButton} ${styles.stopButton} ${stopping ? styles.actionButtonLoading : ""}`}
                disabled={stopping || restarting}
                onClick={async () => {
                  setStopping(true);
                  try {
                    await onStop?.(service.id);
                  } finally {
                    setTimeout(() => setStopping(false), 5000);
                  }
                }}
              >
                <Square size={10} strokeWidth={2.6} className={stopping ? styles.pulse : ""} />
                {stopping ? "Stopping…" : "Stop"}
              </button>
            ) : (
              <button
                className={`${styles.actionButton} ${styles.startButton} ${starting ? styles.actionButtonLoading : ""}`}
                disabled={starting || restarting}
                onClick={async () => {
                  setStarting(true);
                  try {
                    await onStart?.(service.id);
                  } finally {
                    setTimeout(() => setStarting(false), 5000);
                  }
                }}
              >
                <Play size={10} strokeWidth={2.6} fill="currentColor" className={starting ? styles.pulse : ""} />
                {starting ? "Starting…" : "Start"}
              </button>
            )}

            <Link
              href={`/logs?service=${service.id}`}
              className={`${styles.actionButton} ${styles.logsButton}`}
            >
              <ScrollText size={10} strokeWidth={2.6} />
              Logs
            </Link>

            <button
              className={`${styles.actionButton} ${styles.restartButton} ${restarting ? styles.actionButtonLoading : ""}`}
              disabled={restarting || stopping || starting}
              onClick={async () => {
                setRestarting(true);
                try {
                  await onRestart?.(service.id);
                } finally {
                  setTimeout(() => setRestarting(false), 5000);
                }
              }}
            >
              <RotateCcw size={10} strokeWidth={2.6} className={restarting ? styles.spin : ""} />
              {restarting ? "Restarting…" : "Restart"}
            </button>
          </div>
        )}

        {/* ── Status ── */}
        <div className={styles.detail}>
          <span className={styles.detailLabel}>Status</span>
          <StatusBadgeComponent healthy={isHealthy} />
        </div>

        {/* ── Container Resource Metrics (inline sparklines) ── */}
        {containerStats && (
          <div className={styles.metricsSection}>
            {/* CPU */}
            <div className={styles.metricBlock}>
              <div className={styles.metricHeader}>
                <Cpu size={11} strokeWidth={2.2} className={styles.metricIcon} />
                <span className={styles.metricLabel}>CPU</span>
                <span className={styles.metricValues}>
                  <span style={{ color: severityColor(containerStats.cpu.percent) }}>
                    {formatPercent(containerStats.cpu.percent)}
                  </span>
                  <span className={styles.metricDim}>
                    · {containerStats.cpu.cores} core{containerStats.cpu.cores !== 1 ? "s" : ""}
                  </span>
                </span>
              </div>
              <PercentBar percent={containerStats.cpu.percent} color={severityColor(containerStats.cpu.percent)} />
              {containerStats.spark?.cpu?.length >= 2 && (
                <Sparkline
                  data={containerStats.spark.cpu}
                  color={severityColor(containerStats.cpu.percent)}
                  fillColor={containerStats.cpu.percent > 80 ? "rgba(239,68,68,0.12)" : containerStats.cpu.percent > 40 ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)"}
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
                  <span style={{ color: severityColor(containerStats.memory.percent, [60, 85]) }}>
                    {formatBytes(containerStats.memory.used)}
                  </span>
                  <span className={styles.metricDim}>
                    / {formatBytes(containerStats.memory.limit)}
                  </span>
                  <span style={{ color: severityColor(containerStats.memory.percent, [60, 85]) }}>
                    {formatPercent(containerStats.memory.percent)}
                  </span>
                </span>
              </div>
              <PercentBar percent={containerStats.memory.percent} color={severityColor(containerStats.memory.percent, [60, 85])} />
              {containerStats.spark?.mem?.length >= 2 && (
                <Sparkline
                  data={containerStats.spark.mem}
                  color={severityColor(containerStats.memory.percent, [60, 85])}
                  fillColor={containerStats.memory.percent > 85 ? "rgba(239,68,68,0.12)" : containerStats.memory.percent > 60 ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)"}
                  max={containerStats.memory.limit}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Stage / Visibility ── */}
        <div className={styles.detail}>
          <span className={styles.detailLabel}>Environment</span>
          <BadgeComponent
            variant={isProduction ? "success" : "info"}
          >
            {service.environment || "Unknown"}
          </BadgeComponent>
        </div>

        {service.projectType && (() => {
          const colors = SERVICE_TYPE_COLORS[service.projectType];
          return (
            <div className={styles.detail}>
              <span className={styles.detailLabel}>Type</span>
              <BadgeComponent
                variant="info"
                style={colors ? {
                  color: colors.color,
                  background: colors.subtle,
                  borderColor: `color-mix(in srgb, ${colors.color} 25%, transparent)`,
                } : undefined}
              >
                {service.projectType}
              </BadgeComponent>
            </div>
          );
        })()}

        {service.deployTier != null && (() => {
          const colors = DEPLOY_TIER_COLORS[service.deployTier];
          return (
            <div className={styles.detail}>
              <span className={styles.detailLabel}>Tier</span>
              <BadgeComponent
                variant="info"
                style={colors ? {
                  color: colors.color,
                  background: colors.subtle,
                  borderColor: `color-mix(in srgb, ${colors.color} 25%, transparent)`,
                } : undefined}
              >
                {`Tier ${service.deployTier}`}
              </BadgeComponent>
            </div>
          );
        })()}

        {service.visibility && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Visibility</span>
            <VisibilityBadgeComponent visibility={service.visibility} icons={{ Globe, Lock }} />
          </div>
        )}



        {service.responseTimeMs != null && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Response</span>
            <ResponseTimeBadgeComponent ms={service.responseTimeMs} formatter={formatDuration} />
          </div>
        )}

        {service.device && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Device</span>
            <DeviceBadgeComponent device={service.device} icons={{ Server }} />
          </div>
        )}

        {/* ── Infrastructure-specific metadata ── */}
        {isInfra && service.metadata && (
          <>
            {service.metadata.version && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Version</span>
                <span className={`${styles.detailValue} ${styles.mono}`}>
                  {service.metadata.version}
                </span>
              </div>
            )}
            {service.metadata.uptime != null && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Uptime</span>
                <span className={styles.detailValue}>
                  {formatElapsedTime(service.metadata.uptime)}
                </span>
              </div>
            )}
            {service.metadata.connections != null && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Connections</span>
                <span className={styles.detailValue}>
                  {service.metadata.connections}
                </span>
              </div>
            )}
            {service.metadata.databases != null && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Databases</span>
                <span className={styles.detailValue}>
                  {service.metadata.databases}
                </span>
              </div>
            )}
            {service.metadata.buckets != null && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Buckets</span>
                <span className={styles.detailValue}>
                  {service.metadata.buckets}
                </span>
              </div>
            )}
            {service.metadata.bucketNames?.length > 0 && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Bucket Names</span>
                <span className={`${styles.detailValue} ${styles.mono}`}>
                  {service.metadata.bucketNames.join(", ")}
                </span>
              </div>
            )}
          </>
        )}

        {/* ── Standard service metadata ── */}
        {!isInfra && service.metadata?.version && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Version</span>
            <span className={styles.detailValue}>
              {service.metadata.version}
            </span>
          </div>
        )}

        {service.port && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Port</span>
            <PortBadgeComponent port={service.port} />
          </div>
        )}

        {service.url && !isInfra && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Address</span>
            <AddressBadgeComponent address={service.url} link />
          </div>
        )}

        {service.domain && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Domain</span>
            <DomainBadgeComponent domain={service.domain} icons={{ Globe }} />
          </div>
        )}

        {service.repo && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Repository</span>
            <RepositoryBadgeComponent repo={service.repo} icons={{ Github }} />
          </div>
        )}

        {service.checkedAt && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Checked</span>
            <DateTimeBadgeComponent date={service.checkedAt} highlightNew />
          </div>
        )}
      </div>

      {service.error && !isHealthy && (
        <div className={styles.errorBar}>
          {service.error}
        </div>
      )}

      {/* ── Connections (dependency graph) ── */}
      {service.dependsOn?.length > 0 && (() => {
        const required = service.dependsOn.filter((d) => d.criticality !== "optional");
        const optional = service.dependsOn.filter((d) => d.criticality === "optional");
        return (
          <div className={styles.connections}>
            {required.length > 0 && (
              <>
                <span className={styles.connectionLabel}>
                  <ArrowUp size={10} strokeWidth={2.4} />
                  Requires
                </span>
                <div className={styles.connectionTags}>
                  {required.map((dep, i) => (
                    <span key={`req-${i}-${dep.name || dep.id || ''}`} className={styles.connectionTag}>
                      {dep.name}
                    </span>
                  ))}
                </div>
              </>
            )}
            {optional.length > 0 && (
              <>
                <span className={`${styles.connectionLabel} ${styles.connectionLabelOptional}`}>
                  <ArrowUp size={10} strokeWidth={2.4} />
                  Optional
                </span>
                <div className={styles.connectionTags}>
                  {optional.map((dep, i) => (
                    <span key={`opt-${i}-${dep.name || dep.id || ''}`} className={`${styles.connectionTag} ${styles.connectionTagOptional}`}>
                      {dep.name}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

