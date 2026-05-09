"use client";

import { useState, useRef, useEffect } from "react";
import {
  Box,
  Cpu,
  Globe,
  Lock,
  MemoryStick,
  Server,
} from "lucide-react";
import {
  AddressBadgeComponent,
  DeviceBadgeComponent,
  LoadingIndicatorComponent,
  PortBadgeComponent,
  ResponseTimeBadgeComponent,
  StatusBadgeComponent,
  VisibilityBadgeComponent,
} from "@rodrigo-barraza/components-library";
import { formatDuration } from "@rodrigo-barraza/utilities-library";
import ApiService from "../services/ApiService";
import styles from "./ContainerDetailPanel.module.css";

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

function Sparkline({ data, color, fillColor, max, height = 36 }) {
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

function PercentBar({ percent, color }) {
  const clamped = Math.min(percent, 100);
  return (
    <div className={styles.barTrack}>
      <div className={styles.barFill} style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────

export default function ContainerDetailPanel({ container, stats }) {
  const [history, setHistory] = useState(null);
  const didFetch = useRef(false);

  // Fetch sparkline history
  useEffect(() => {
    if (didFetch.current || !container) return;
    didFetch.current = true;

    (async () => {
      try {
        const res = await ApiService.getContainerStatsHistory();
        if (res?.history) {
          const cpuPoints = [];
          const memPoints = [];
          for (const snap of res.history) {
            const c = snap.containers?.[container.containerName];
            if (c) {
              cpuPoints.push(c.cpu ?? 0);
              memPoints.push(c.memoryUsed ?? 0);
            }
          }
          setHistory({ cpu: cpuPoints, mem: memPoints });
        }
      } catch { /* silent */ }
    })();
  }, [container]);

  return (
    <div className={styles.panel}>
      {/* ── Identity ── */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Status</h4>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Health</span>
            <StatusBadgeComponent healthy={container.healthy} />
          </div>
          {container.visibility && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Visibility</span>
              <VisibilityBadgeComponent visibility={container.visibility} icons={{ Globe, Lock }} />
            </div>
          )}
          {container.responseTimeMs != null && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Response</span>
              <ResponseTimeBadgeComponent ms={container.responseTimeMs} formatter={formatDuration} />
            </div>
          )}
          {container.device && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Device</span>
              <DeviceBadgeComponent device={container.device} icons={{ Server }} />
            </div>
          )}
        </div>
      </div>

      {container.port || container.url ? (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Network</h4>
          <div className={styles.fieldGrid}>
            {container.port && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Port</span>
                <PortBadgeComponent port={container.port} />
              </div>
            )}
            {container.url && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Address</span>
                <AddressBadgeComponent address={container.url} link />
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Metrics ── */}
      {stats ? (
        <div className={styles.metricsGrid}>
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
            {history?.cpu?.length >= 2 && (
              <Sparkline
                data={history.cpu}
                color={severityColor(stats.cpu.percent)}
                fillColor={stats.cpu.percent > 80 ? "rgba(239,68,68,0.12)" : stats.cpu.percent > 40 ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)"}
                max={100}
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
            {history?.mem?.length >= 2 && (
              <Sparkline
                data={history.mem}
                color={severityColor(stats.memory.percent, [60, 85])}
                fillColor={stats.memory.percent > 85 ? "rgba(239,68,68,0.12)" : stats.memory.percent > 60 ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)"}
                max={stats.memory.limit}
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
        <div className={styles.metricsEmpty}>
          <Box size={18} strokeWidth={1.5} className={styles.emptyIcon} />
          <span>No metrics available</span>
        </div>
      )}
    </div>
  );
}
