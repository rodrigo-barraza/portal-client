"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { LoadingIndicatorComponent } from "@rodrigo-barraza/components-library";
import { Cpu, MemoryStick, Activity, Container } from "lucide-react";
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

function severityColor(pct, thresholds = [40, 80]) {
  if (pct > thresholds[1]) return "var(--danger)";
  if (pct > thresholds[0]) return "var(--warning)";
  return "var(--success)";
}

// ── Sparkline (Canvas) ──────────────────────────────────────────

function Sparkline({ data, color, fillColor, max, height = 24 }) {
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

              {/* CPU Sparkline */}
              <div className={styles.cellSpark}>
                {c.spark?.cpu?.length >= 2 ? (
                  <Sparkline data={c.spark.cpu} color={cpuColor} fillColor={cpuFill} max={100} />
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

              {/* Memory Sparkline */}
              <div className={styles.cellSpark}>
                {c.spark?.mem?.length >= 2 ? (
                  <Sparkline
                    data={c.spark.mem}
                    color={memColor}
                    fillColor={memFill}
                    max={c.memory.limit}
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
