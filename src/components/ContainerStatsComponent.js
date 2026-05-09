"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { LoadingIndicatorComponent } from "@rodrigo-barraza/components-library";
import { Cpu, MemoryStick, Container } from "lucide-react";
import ApiService from "../services/ApiService";
import styles from "./ContainerStatsComponent.module.css";

const MAX_SPARKLINE_POINTS = 60;
const POLL_INTERVAL = 5_000;

// ── Formatting ──────────────────────────────────────────────────

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

function formatCompact(val, isMemory = false) {
  if (isMemory) return formatBytes(val);
  if (val < 0.01) return "0";
  if (val < 1) return val.toFixed(2);
  if (val < 10) return val.toFixed(1);
  return Math.round(val).toString();
}

function severityColor(pct, thresholds = [40, 80]) {
  if (pct > thresholds[1]) return "var(--danger)";
  if (pct > thresholds[0]) return "var(--warning)";
  return "var(--success)";
}

// ── Enhanced Sparkline (Canvas) — auto-scaled with markers ──────

function Sparkline({ data, color, fillColor, max: hardMax, height = 32, isMemory = false }) {
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

    // ── Compute auto-scaled range ──────────────────────────
    const dataMin = Math.min(...data);
    const dataMax = Math.max(...data);
    const dataRange = dataMax - dataMin;

    // Use auto-scaling: pad the local range by 20% on each side
    // so fluctuations are always visible. Fall back to hardMax
    // only when all values are identical (flat line).
    const MARKER_W = 30; // reserved width for Y-axis labels
    const chartW = w - MARKER_W;
    const paddingY = 4;
    const drawH = h - paddingY * 2;

    let yMin, yMax;
    if (dataRange < 0.001) {
      // Flat line — center it
      yMin = Math.max(0, dataMin - 1);
      yMax = dataMin + 1;
    } else {
      const rangePad = dataRange * 0.2;
      yMin = Math.max(0, dataMin - rangePad);
      yMax = dataMax + rangePad;
      // If there's a hard max and data is close to it, cap there
      if (hardMax && yMax > hardMax) yMax = hardMax;
    }

    const yRange = yMax - yMin || 1;
    const toY = (val) => paddingY + drawH - ((val - yMin) / yRange) * drawH;
    const step = chartW / (MAX_SPARKLINE_POINTS - 1);
    const startX = MARKER_W + chartW - (data.length - 1) * step;

    // ── Gridlines (2 horizontal references) ────────────────
    const gridValues = [yMin + yRange * 0.25, yMin + yRange * 0.75];
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (const gv of gridValues) {
      const gy = Math.round(toY(gv)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(MARKER_W, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    // ── Draw line ──────────────────────────────────────────
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = startX + i * step;
      const y = toY(data[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // ── Fill gradient ──────────────────────────────────────
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

    // ── Latest point dot ───────────────────────────────────
    const lastIdx = data.length - 1;
    const dotX = startX + lastIdx * step;
    const dotY = toY(data[lastIdx]);

    ctx.beginPath();
    ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    // Glow ring
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4.5, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ── Y-axis markers (min/max labels) ────────────────────
    const computedStyle = getComputedStyle(canvas);
    const fontFamily = computedStyle.fontFamily || "monospace";

    ctx.font = `500 9px ${fontFamily}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255,255,255,0.35)";

    // Max label (top)
    const maxLabel = isMemory ? formatBytes(dataMax) : formatCompact(dataMax);
    ctx.fillText(maxLabel, MARKER_W - 4, paddingY - 1);

    // Min label (bottom)
    ctx.textBaseline = "bottom";
    const minLabel = isMemory ? formatBytes(dataMin) : formatCompact(dataMin);
    ctx.fillText(minLabel, MARKER_W - 4, h - paddingY + 1);

  }, [data, color, fillColor, hardMax, height, isMemory]);

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

// ── Main Component ──────────────────────────────────────────────

export default function ContainerStatsComponent() {
  const [containerData, setContainerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const didFetch = useRef(false);

  const fetchStats = useCallback(async () => {
    try {
      const [currentRes, historyRes] = await Promise.all([
        ApiService.getContainerStats(),
        ApiService.getContainerStatsHistory(),
      ]);

      // Build sparkline data per container name from history
      const sparkMap = {};
      if (historyRes?.history) {
        for (const snapshot of historyRes.history) {
          for (const [name, stats] of Object.entries(snapshot.containers)) {
            if (!sparkMap[name]) sparkMap[name] = { cpu: [], mem: [] };
            sparkMap[name].cpu.push(stats.cpu);
            sparkMap[name].mem.push(stats.memoryUsed);
          }
        }
      }

      // Merge current snapshot with sparklines
      const containers = (currentRes?.containers || []).map((c) => ({
        ...c,
        spark: sparkMap[c.name] || null,
      }));

      // Sort by CPU desc
      containers.sort((a, b) => b.cpu.percent - a.cpu.percent);

      setContainerData(containers);
    } catch {
      // Supplementary data — don't break the page
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    fetchStats();
  }, [fetchStats]);

  // Poll every 5s
  useEffect(() => {
    const timer = setInterval(fetchStats, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchStats]);

  // Aggregated totals
  const totals = useMemo(() => {
    if (!containerData || containerData.length === 0) return null;
    const totalCpu = containerData.reduce((sum, c) => sum + c.cpu.percent, 0);
    const totalMem = containerData.reduce((sum, c) => sum + c.memory.used, 0);
    const memLimit = containerData[0]?.memory.limit || 0;
    const memPct = memLimit > 0 ? (totalMem / memLimit) * 100 : 0;
    return { totalCpu, totalMem, memLimit, memPct, count: containerData.length };
  }, [containerData]);

  if (loading) {
    return (
      <div className={styles.section}>
        <LoadingIndicatorComponent size="small" label="Querying container metrics…" className="loading-center" />
      </div>
    );
  }

  if (!containerData || containerData.length === 0) return null;

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.sectionTitle}>Live Container Metrics</h2>
          <span className={styles.sectionSubtitle}>
            {totals.count} containers · polling every 5s
          </span>
        </div>
        <div className={styles.headerTotals}>
          <div className={styles.headerStat}>
            <Cpu size={12} strokeWidth={2.2} />
            <span style={{ color: severityColor(totals.totalCpu) }}>
              {formatPercent(totals.totalCpu)}
            </span>
            <span className={styles.headerStatLabel}>CPU</span>
          </div>
          <div className={styles.headerStat}>
            <MemoryStick size={12} strokeWidth={2.2} />
            <span style={{ color: severityColor(totals.memPct, [60, 85]) }}>
              {formatBytes(totals.totalMem)}
            </span>
            <span className={styles.headerStatLabel}>
              / {formatBytes(totals.memLimit)}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.table}>
        {/* Header */}
        <div className={`${styles.row} ${styles.rowHeader}`}>
          <span className={styles.cellName}>Container</span>
          <span className={styles.cellMetric}>CPU</span>
          <span className={styles.cellSpark}>CPU History</span>
          <span className={styles.cellMetric}>Memory</span>
          <span className={styles.cellSpark}>MEM History</span>
          <span className={styles.cellPids}>PIDs</span>
        </div>

        {/* Rows */}
        {containerData.map((c, i) => {
          const cpuColor = severityColor(c.cpu.percent);
          const memColor = severityColor(c.memory.percent, [60, 85]);
          const cpuFill = c.cpu.percent > 80
            ? "rgba(239,68,68,0.12)"
            : c.cpu.percent > 40
              ? "rgba(245,158,11,0.12)"
              : "rgba(16,185,129,0.12)";
          const memFill = c.memory.percent > 85
            ? "rgba(239,68,68,0.12)"
            : c.memory.percent > 60
              ? "rgba(245,158,11,0.12)"
              : "rgba(16,185,129,0.12)";

          return (
            <div
              key={c.name}
              className={styles.row}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {/* Name */}
              <div className={styles.cellName}>
                <Container size={12} strokeWidth={1.8} className={styles.containerIcon} />
                <span className={styles.containerName} title={c.name}>{c.name}</span>
              </div>

              {/* CPU */}
              <div className={styles.cellMetric}>
                <span className={styles.metricValue} style={{ color: cpuColor }}>
                  {formatPercent(c.cpu.percent)}
                </span>
                <PercentBar percent={c.cpu.percent} color={cpuColor} />
              </div>

              {/* CPU Sparkline — auto-scaled, no hardMax */}
              <div className={styles.cellSpark}>
                {c.spark?.cpu?.length >= 2 ? (
                  <Sparkline
                    data={c.spark.cpu}
                    color={cpuColor}
                    fillColor={cpuFill}
                    height={32}
                  />
                ) : (
                  <span className={styles.noData}>—</span>
                )}
              </div>

              {/* Memory */}
              <div className={styles.cellMetric}>
                <div className={styles.metricRow}>
                  <span className={styles.metricValue} style={{ color: memColor }}>
                    {formatBytes(c.memory.used)}
                  </span>
                  <span className={styles.metricDim}>
                    {formatPercent(c.memory.percent)}
                  </span>
                </div>
                <PercentBar percent={c.memory.percent} color={memColor} />
              </div>

              {/* Memory Sparkline — auto-scaled with limit reference */}
              <div className={styles.cellSpark}>
                {c.spark?.mem?.length >= 2 ? (
                  <Sparkline
                    data={c.spark.mem}
                    color={memColor}
                    fillColor={memFill}
                    height={32}
                    isMemory
                  />
                ) : (
                  <span className={styles.noData}>—</span>
                )}
              </div>

              {/* PIDs */}
              <div className={styles.cellPids}>
                <span className={styles.pidValue}>{c.pids}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
