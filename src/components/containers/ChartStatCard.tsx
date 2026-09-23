import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChartLineComponent } from "@rodrigo-barraza/components-library";
import { HISTORY_MAX } from "../monitoring/containerHistory";
import styles from "./ChartStatCard.module.css";

/**
 * Mirrors the library StatsCardComponent anatomy (header → value →
 * subtitle) with a sparkline appended; kept local because the library
 * card has no chart slot. Metrics match StatsCardComponent.module.css.
 */
export default function ChartStatCard({
  label,
  icon: Icon,
  accent,
  value,
  valueColor,
  subtitle,
  series,
  maxValue,
  formatValue,
}: {
  label: string;
  icon: LucideIcon;
  /** Theme colour for the icon chip, hover border and sparkline. */
  accent: string;
  value: ReactNode;
  valueColor?: string;
  subtitle: ReactNode;
  series: number[];
  maxValue: number;
  formatValue: (value: number) => string;
}) {
  return (
    <div className={styles['card']} style={{ "--chart-stat-accent": accent } as CSSProperties}>
      <div className={styles['header']}>
        <span className={styles['label']}>{label}</span>
        <div className={styles['icon']}>
          <Icon size={14} strokeWidth={2} />
        </div>
      </div>
      <span className={styles['value']} style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
      <span className={styles['subtitle']}>{subtitle}</span>
      <ChartLineComponent
        data={series}
        color={accent}
        maxValue={maxValue}
        height={48}
        historyMax={HISTORY_MAX}
        showGrid
        formatValue={formatValue}
      />
    </div>
  );
}
