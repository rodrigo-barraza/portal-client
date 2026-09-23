"use client";

import React from "react";
import { ChartLineComponent } from "@rodrigo-barraza/components-library";
import { formatNumber } from "@rodrigo-barraza/utilities-library";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { CHART_COLORS, SOURCE_COLORS, SPARKLINE_COLORS, chartColor } from "./analytics/palette";
import { describeSeries } from "./analytics/analyticsSeries";
import { formatExact } from "./analytics/analyticsFormat";
import styles from "./WebAnalytics.module.css";
import type { DonutSegment } from "../types/portal";

/**
 * AnalyticsPrimitives — shared chart/stat widgets for the web-analytics
 * pages (and ExternalApis). One source of truth for the pieces GA and
 * first-party reports both render: stat cards, delta badges, horizontal
 * bars, donuts, stacked sparklines, and the realtime banner.
 */

export { CHART_COLORS, SPARKLINE_COLORS, SOURCE_COLORS };

type PanelIcon = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

// ── Delta Badge ───────────────────────────────────────────────

export function DeltaBadge({ value }: { value?: number | null }) {
  if (value == null || !Number.isFinite(value)) return null;
  const percentage = (value * 100).toFixed(1);
  const isUp = value >= 0;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`${styles["delta-badge"]} ${isUp ? styles["delta-up"] : styles["delta-down"]}`}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden />
      {isUp ? "+" : ""}
      {percentage}%
    </span>
  );
}

// ── Stat Card ─────────────────────────────────────────────────

export function StatCard({
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
    <div className={styles["stat-card"]} style={{ animationDelay: `${delay}ms` }}>
      <div
        className={styles["stat-card-icon"]}
        // color-mix, not `${color}15`: hex-alpha concatenation silently
        // breaks for anything but a 6-digit hex (var(), oklch, #abc)
        style={{ color, background: `color-mix(in srgb, ${color} 8%, transparent)` }}
        aria-hidden
      >
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className={styles["stat-card-content"]}>
        <div className={styles["stat-card-value-row"]}>
          <span className={styles["stat-card-value"]}>{value}</span>
          <DeltaBadge value={delta} />
        </div>
        <span className={styles["stat-card-label"]}>{label}</span>
        {sub && <span className={styles["stat-card-sub"]}>{sub}</span>}
      </div>
    </div>
  );
}

// ── Horizontal Bar ────────────────────────────────────────────

export function HorizontalBar({
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
    <div className={styles["bar-row"]}>
      <div className={styles["bar-info"]}>
        <span className={styles["bar-label"]} title={label}>
          {label}
        </span>
        <span className={styles["bar-value"]}>
          {formatNumber(value)}
          {suffix}
        </span>
      </div>
      <div className={styles["bar-track"]} aria-hidden>
        <div
          className={styles["bar-fill"]}
          style={{ width: `${percentage}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Donut Chart ───────────────────────────────────────────────

export function DonutChart({
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
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  // Pre-compute cumulative offsets to avoid mutating during render
  const cumulativeValues: number[] = [];
  let running = 0;
  for (const segment of segments) {
    cumulativeValues.push(running);
    running += segment.value;
  }

  const description = `${centerLabel}: ${formatExact(total)}. ${segments
    .map((segment) => `${segment.label} ${formatExact(segment.value)}`)
    .join(", ")}.`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={styles["donut"]}
      role="img"
      aria-label={description}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--background-elevated)"
        strokeWidth={strokeWidth}
      />
      {segments.map((segment, index) => {
        const percentage = total > 0 ? segment.value / total : 0;
        const dashLength = percentage * circumference;
        const dashOffset = total > 0 ? -(cumulativeValues[index] / total) * circumference : 0;

        return (
          <circle
            key={`${segment.label}-${index}`}
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
            className={styles["donut-segment"]}
            style={{ animationDelay: `${index * 100}ms` }}
          />
        );
      })}
      <text
        x={center}
        y={center - 4}
        textAnchor="middle"
        className={styles["donut-center"]}
        aria-hidden
      >
        {formatNumber(total)}
      </text>
      <text
        x={center}
        y={center + 12}
        textAnchor="middle"
        className={styles["donut-center-label"]}
        aria-hidden
      >
        {centerLabel}
      </text>
    </svg>
  );
}

// ── Panel chrome ──────────────────────────────────────────────

/** The bordered card + header row every analytics panel shares. */
export function Panel({
  icon: Icon,
  title,
  meta,
  children,
}: {
  icon: PanelIcon;
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={styles["panel"]} aria-label={title}>
      <div className={styles["panel-header"]}>
        <Icon size={15} strokeWidth={2.2} className={styles["panel-icon"]} aria-hidden />
        <span className={styles["panel-title"]}>{title}</span>
        {meta && <span className={styles["panel-meta"]}>{meta}</span>}
      </div>
      {children}
    </section>
  );
}

// ── Donut Panel (donut + horizontal-bar legend) ───────────────

const DONUT_LEGEND_LIMIT = 6;

export function DonutPanel({
  icon,
  title,
  segments,
  centerLabel = "Sessions",
  suffix = " sessions",
}: {
  icon: PanelIcon;
  title: string;
  segments: DonutSegment[];
  centerLabel?: string;
  suffix?: string;
}) {
  if (segments.length === 0) return null;
  const max = Math.max(...segments.map((segment) => segment.value));
  return (
    <Panel icon={icon} title={title}>
      <div className={styles["donut-wrapper"]}>
        <DonutChart segments={segments} size={130} strokeWidth={16} centerLabel={centerLabel} />
        <div className={styles["donut-legend"]}>
          {segments.slice(0, DONUT_LEGEND_LIMIT).map((segment, index) => (
            <HorizontalBar
              key={`${segment.label}-${index}`}
              label={segment.label}
              value={segment.value}
              max={max}
              color={segment.color}
              suffix={suffix}
            />
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ── Bar-list Panel (title + ranked horizontal bars) ───────────

export function BarListPanel({
  icon,
  title,
  meta,
  bars,
  colorOffset = 0,
  suffix = "",
  limit = 10,
}: {
  icon: PanelIcon;
  title: string;
  meta?: string;
  bars: { key: string; label: string; value: number }[];
  colorOffset?: number;
  suffix?: string;
  limit?: number;
}) {
  if (bars.length === 0) return null;
  const max = Math.max(...bars.map((bar) => bar.value));
  return (
    <Panel icon={icon} title={title} meta={meta}>
      <div className={styles["panel-body"]}>
        <div className={styles["bar-list"]}>
          {bars.slice(0, limit).map((bar, index) => (
            <HorizontalBar
              // Keys can repeat (two GA sources that differ only by case,
              // a referrer seen as null and "(direct)") — suffix the rank
              key={`${bar.key}-${index}`}
              label={bar.label}
              value={bar.value}
              max={max}
              color={chartColor(index, colorOffset)}
              suffix={suffix}
            />
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ── Sparkline Trends Panel (stacked line charts + legend) ─────

export function TrendsPanel({
  icon: Icon,
  title,
  series,
  metrics,
}: {
  icon: PanelIcon;
  title: string;
  series: Record<string, unknown>[];
  metrics: { key: string; label: string; color: string }[];
}) {
  if (!series || series.length === 0) return null;

  return (
    <section className={styles["chart-panel"]} aria-label={title}>
      <div className={styles["chart-header"]}>
        <Icon size={15} strokeWidth={2.2} className={styles["chart-header-icon"]} aria-hidden />
        <span className={styles["chart-title"]}>{title}</span>
      </div>
      <div
        className={styles["chart-body"]}
        role="img"
        aria-label={`${title}: ${describeSeries(series, metrics)}`}
      >
        <div className={styles["sparkline-stack"]}>
          {metrics.map((metric) => {
            const values = series.map((point) => Number(point[metric.key]) || 0);
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
      </div>
      <div className={styles["chart-legend"]}>
        {metrics.map((metric) => (
          <div key={metric.key} className={styles["chart-legend-item"]}>
            <div className={styles["chart-legend-dot"]} style={{ background: metric.color }} />
            {metric.label}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Realtime Banner ───────────────────────────────────────────

export function RealtimeBanner({
  label,
  count,
  meta,
}: {
  label: string;
  count: number | null;
  meta: string;
}) {
  return (
    <div className={styles["realtime-banner"]}>
      <div className={styles["realtime-pulse"]} aria-hidden>
        <div className={styles["realtime-pulse-dot"]} />
        <div className={styles["realtime-pulse-ring"]} />
      </div>
      <div className={styles["realtime-info"]}>
        <span className={styles["realtime-label"]}>{label}</span>
        <span className={styles["realtime-count"]}>
          {count !== null ? formatNumber(count) : "—"}
        </span>
      </div>
      <span className={styles["realtime-meta"]}>{meta}</span>
    </div>
  );
}

// ── Source Badges ─────────────────────────────────────────────

export function SourceBadges({ hasGA, hasSessions }: { hasGA: boolean; hasSessions: boolean }) {
  if (!hasGA && !hasSessions) return null;
  return (
    <span className={styles["source-badges"]}>
      {hasGA && (
        <span className={`${styles["source-badge"]} ${styles["source-badge-ga"]}`}>GA4</span>
      )}
      {hasSessions && (
        <span className={`${styles["source-badge"]} ${styles["source-badge-fp"]}`}>1st-party</span>
      )}
    </span>
  );
}
