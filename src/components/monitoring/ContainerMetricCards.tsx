import type { ReactNode } from "react";
import { Cpu, MemoryStick, type LucideIcon } from "lucide-react";
import { ChartLineComponent } from "@rodrigo-barraza/components-library";
import { formatBytes, formatPercent } from "@rodrigo-barraza/utilities-library";
import type { CpuStats, MemoryStats } from "@/types/portal";
import { HISTORY_MAX, percentCeiling } from "./containerHistory";
import { severityColor, type SeverityBounds } from "./severity";
import UsageBar from "./UsageBar";
import styles from "./ContainerMetricCards.module.css";

/**
 * Container metric cards shared by the Containers drawer and the Projects
 * drawer's Container tab — the same CPU / RAM / I/O widgets in both places.
 */

const formatPercentValue = (value: number) => formatPercent(value, "adaptive");

export function MetricCard({
  icon: Icon,
  title,
  header,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  /** Extra header content, right of the title (values, counts). */
  header?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={styles["card"]}>
      <div className={styles["header"]}>
        {Icon && (
          <Icon size={13} strokeWidth={2.2} className={styles["icon"]} />
        )}
        <span className={styles["title"]}>{title}</span>
        {header}
      </div>
      {children}
    </div>
  );
}

export function MetricValue({
  color,
  children,
}: {
  color?: string;
  children: ReactNode;
}) {
  return (
    <span className={styles["value"]} style={color ? { color } : undefined}>
      {children}
    </span>
  );
}

export function MetricDim({ children }: { children: ReactNode }) {
  return <span className={styles["dim"]}>{children}</span>;
}

export function CpuMetricCard({
  cpu,
  history,
  bounds,
}: {
  cpu: CpuStats;
  history?: number[];
  bounds: SeverityBounds;
}) {
  const color = severityColor(cpu.percent, bounds);
  return (
    <MetricCard
      icon={Cpu}
      title="CPU"
      header={
        <>
          <MetricValue color={color}>
            {formatPercent(cpu.percent, "adaptive")}
          </MetricValue>
          <MetricDim>
            · {cpu.cores} core{cpu.cores === 1 ? "" : "s"}
          </MetricDim>
        </>
      }
    >
      <UsageBar percent={cpu.percent} color={color} />
      {history && history.length >= 2 && (
        <ChartLineComponent
          data={history}
          color={color}
          maxValue={percentCeiling(history)}
          height={36}
          historyMax={HISTORY_MAX}
          formatValue={formatPercentValue}
        />
      )}
    </MetricCard>
  );
}

export function MemoryMetricCard({
  memory,
  history,
  bounds,
}: {
  memory: MemoryStats;
  history?: number[];
  bounds: SeverityBounds;
}) {
  const color = severityColor(memory.percent, bounds);
  return (
    <MetricCard
      icon={MemoryStick}
      title="RAM"
      header={
        <>
          <MetricValue color={color}>{formatBytes(memory.used)}</MetricValue>
          <MetricDim>/ {formatBytes(memory.limit)}</MetricDim>
          <MetricValue color={color}>
            {formatPercent(memory.percent, "adaptive")}
          </MetricValue>
        </>
      }
    >
      <UsageBar percent={memory.percent} color={color} />
      {history && history.length >= 2 && (
        <ChartLineComponent
          data={history}
          color={color}
          maxValue={memory.limit || Math.max(...history, 1)}
          height={36}
          historyMax={HISTORY_MAX}
          formatValue={formatBytes}
        />
      )}
    </MetricCard>
  );
}

/** A row of labelled figures ("RX 1.2 MB   TX 340 KB"). */
export function TransferStats({
  warning = false,
  children,
}: {
  /** Separated and tinted — for drops / errors. */
  warning?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={
        warning ? styles["transfer-row-warning"] : styles["transfer-row"]
      }
    >
      {children}
    </div>
  );
}

export function TransferStat({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: ReactNode;
  danger?: boolean;
}) {
  return (
    <span className={styles["transfer-stat"]}>
      <span className={styles["transfer-label"]}>{label}</span>
      <span
        className={
          danger ? styles["transfer-value-danger"] : styles["transfer-value"]
        }
      >
        {value}
      </span>
    </span>
  );
}

/** Grid row that lays small cards side by side (Network / Block I/O / PIDs). */
export function MetricRow({ children }: { children: ReactNode }) {
  return <div className={styles["row"]}>{children}</div>;
}
