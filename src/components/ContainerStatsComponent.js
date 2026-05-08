"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Cpu, MemoryStick, HardDrive, Activity, ChevronDown, ChevronUp } from "lucide-react";
import ApiService from "../services/ApiService";
import styles from "./ContainerStatsComponent.module.css";

// ── Constants ────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 5_000;
const MAX_SPARKLINE_POINTS = 60;

/** Format bytes to human-readable. */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

/** Format percentage to display string. */
function formatPercent(pct) {
  if (pct < 0.01) return "0%";
  if (pct < 1) return `${pct.toFixed(2)}%`;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

// ── Sparkline Canvas Component ───────────────────────────────────

function Sparkline({ data, color, fillColor, max, height = 32, className }) {
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

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Compute bounds
    const effectiveMax = max || Math.max(...data, 0.01);
    const padding = 2;
    const drawW = w;
    const drawH = h - padding * 2;
    const step = drawW / (MAX_SPARKLINE_POINTS - 1);

    // Start from right side (newest data), offset for how many points we have
    const startX = drawW - (data.length - 1) * step;

    // Build path
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = startX + i * step;
      const y = padding + drawH - (data[i] / effectiveMax) * drawH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    // Stroke
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // Fill gradient
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
      className={`${styles.sparklineCanvas} ${className || ""}`}
      style={{ height: `${height}px` }}
    />
  );
}

// ── Individual Container Stats Row ───────────────────────────────

function ContainerRow({ name, cpuHistory, memHistory, memLimitHistory, blockWriteHistory }) {
  const latestCpu = cpuHistory[cpuHistory.length - 1] ?? 0;
  const latestMem = memHistory[memHistory.length - 1] ?? 0;
  const latestMemLimit = memLimitHistory[memLimitHistory.length - 1] ?? 0;
  const latestMemPct = latestMemLimit > 0 ? (latestMem / latestMemLimit) * 100 : 0;
  const latestBlock = blockWriteHistory[blockWriteHistory.length - 1] ?? 0;

  // Determine CPU severity color
  const cpuColor = latestCpu > 80 ? "#ef4444" : latestCpu > 50 ? "#f59e0b" : "#10b981";
  const cpuFill = latestCpu > 80 ? "rgba(239,68,68,0.15)" : latestCpu > 50 ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)";

  // Memory severity
  const memColor = latestMemPct > 80 ? "#ef4444" : latestMemPct > 60 ? "#f59e0b" : "#6366f1";
  const memFill = latestMemPct > 80 ? "rgba(239,68,68,0.15)" : latestMemPct > 60 ? "rgba(245,158,11,0.15)" : "rgba(99,102,241,0.15)";

  return (
    <div className={styles.containerRow}>
      <div className={styles.containerName}>
        <Activity size={12} strokeWidth={2.4} className={styles.containerIcon} />
        <span>{name}</span>
      </div>

      <div className={styles.metricsGrid}>
        {/* CPU */}
        <div className={styles.metric}>
          <div className={styles.metricHeader}>
            <Cpu size={11} strokeWidth={2.2} />
            <span className={styles.metricLabel}>CPU</span>
            <span className={styles.metricValue} style={{ color: cpuColor }}>
              {formatPercent(latestCpu)}
            </span>
          </div>
          <Sparkline data={cpuHistory} color={cpuColor} fillColor={cpuFill} max={100} height={28} />
        </div>

        {/* Memory */}
        <div className={styles.metric}>
          <div className={styles.metricHeader}>
            <MemoryStick size={11} strokeWidth={2.2} />
            <span className={styles.metricLabel}>RAM</span>
            <span className={styles.metricValue} style={{ color: memColor }}>
              {formatBytes(latestMem)}
            </span>
          </div>
          <Sparkline data={memHistory} color={memColor} fillColor={memFill} max={latestMemLimit || undefined} height={28} />
        </div>

        {/* Disk I/O */}
        <div className={styles.metric}>
          <div className={styles.metricHeader}>
            <HardDrive size={11} strokeWidth={2.2} />
            <span className={styles.metricLabel}>I/O Write</span>
            <span className={styles.metricValue} style={{ color: "#a855f7" }}>
              {formatBytes(latestBlock)}
            </span>
          </div>
          <Sparkline data={blockWriteHistory} color="#a855f7" fillColor="rgba(168,85,247,0.15)" height={28} />
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────

export default function ContainerStatsComponent() {
  const [containerData, setContainerData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const didFetch = useRef(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await ApiService.getContainerStatsHistory();
      if (!res?.history) return;

      setSampleCount(res.samples);

      // Transform history into per-container time-series arrays
      const containers = {};

      for (const snapshot of res.history) {
        for (const [name, stats] of Object.entries(snapshot.containers)) {
          if (!containers[name]) {
            containers[name] = {
              cpu: [],
              mem: [],
              memLimit: [],
              blockWrite: [],
            };
          }
          containers[name].cpu.push(stats.cpu);
          containers[name].mem.push(stats.memoryUsed);
          containers[name].memLimit.push(stats.memoryLimit);
          containers[name].blockWrite.push(stats.blockWrite);
        }
      }

      setContainerData(containers);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    fetchHistory();
  }, [fetchHistory]);

  // Poll every 5 seconds
  useEffect(() => {
    const timer = setInterval(fetchHistory, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchHistory]);

  const containerNames = Object.keys(containerData).sort();
  const hasData = containerNames.length > 0;

  if (loading && !hasData) return null;

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.header}
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className={styles.headerLeft}>
          <Activity size={14} strokeWidth={2.4} className={styles.headerIcon} />
          <span className={styles.headerTitle}>Live Container Metrics</span>
          <span className={styles.headerBadge}>
            {containerNames.length} containers
          </span>
          {sampleCount > 0 && (
            <span className={styles.headerSamples}>
              {sampleCount}/{MAX_SPARKLINE_POINTS} samples
            </span>
          )}
          <span className={styles.liveIndicator}>
            <span className={styles.liveDot} />
            LIVE
          </span>
        </div>
        <div className={styles.headerRight}>
          {collapsed ? (
            <ChevronDown size={14} strokeWidth={2.4} />
          ) : (
            <ChevronUp size={14} strokeWidth={2.4} />
          )}
        </div>
      </button>

      {!collapsed && (
        <div className={styles.body}>
          {error && (
            <div className={styles.errorBanner}>{error}</div>
          )}

          {!hasData && !error && (
            <div className={styles.emptyState}>
              Collecting data… first snapshot in ~5 seconds
            </div>
          )}

          {containerNames.map((name) => (
            <ContainerRow
              key={name}
              name={name}
              cpuHistory={containerData[name].cpu}
              memHistory={containerData[name].mem}
              memLimitHistory={containerData[name].memLimit}
              blockWriteHistory={containerData[name].blockWrite}
            />
          ))}
        </div>
      )}
    </div>
  );
}
