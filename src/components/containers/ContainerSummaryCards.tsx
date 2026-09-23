import { Clock, Cpu, MemoryStick, Network, Server } from "lucide-react";
import { StatsCardComponent } from "@rodrigo-barraza/components-library";
import { formatBytes, formatDuration, formatPercent } from "@rodrigo-barraza/utilities-library";
import { percentCeiling } from "../monitoring/containerHistory";
import { severityColor, type SeverityThresholds } from "../monitoring/severity";
import ChartStatCard from "./ChartStatCard";
import type { ContainerSummary } from "./containerRows";
import styles from "./ContainerSummaryCards.module.css";

const formatPercentValue = (value: number) => formatPercent(value, "adaptive");

/** Summary row above the Containers table — every figure follows the filters. */
export default function ContainerSummaryCards({
  summary,
  activeDevices,
  cpuSeries,
  memorySeries,
  thresholds,
  showResponseTimes,
}: {
  summary: ContainerSummary;
  activeDevices: string[];
  cpuSeries: number[];
  memorySeries: number[];
  thresholds: SeverityThresholds;
  showResponseTimes: boolean;
}) {
  return (
    <div className={styles['summary-grid']}>
      <StatsCardComponent
        label="Containers"
        value={summary.total}
        subtitle={
          activeDevices.length > 0
            ? `${summary.healthy} healthy on ${activeDevices.join(", ")}`
            : `${summary.running} running · ${summary.stopped} stopped`
        }
        icon={Server}
        variant="accent"
      />

      <ChartStatCard
        label="CPU Usage"
        icon={Cpu}
        accent="var(--color-success)"
        value={`${summary.totalCpu.toFixed(1)}%`}
        valueColor={severityColor(summary.averageCpu, thresholds.cpu)}
        subtitle={`${summary.averageCpu.toFixed(1)}% avg per container`}
        series={cpuSeries}
        maxValue={percentCeiling(cpuSeries)}
        formatValue={formatPercentValue}
      />

      <ChartStatCard
        label="Memory Used"
        icon={MemoryStick}
        accent="var(--color-info)"
        value={formatBytes(summary.memoryUsed)}
        valueColor={severityColor(summary.memoryPercent, thresholds.memory)}
        subtitle={
          summary.memoryLimit
            ? `${formatPercent(summary.memoryPercent, "adaptive")} of ${formatBytes(summary.memoryLimit)} total`
            : "—"
        }
        series={memorySeries}
        maxValue={summary.memoryLimit || Math.max(...memorySeries, 1)}
        formatValue={formatBytes}
      />

      <StatsCardComponent
        label="Network I/O"
        value={formatBytes(summary.networkRx + summary.networkTx)}
        subtitle={`↓ ${formatBytes(summary.networkRx)} rx · ↑ ${formatBytes(summary.networkTx)} tx`}
        icon={Network}
        color="var(--accent-secondary)"
      />

      {showResponseTimes && (
        <StatsCardComponent
          label="Avg Response"
          value={summary.averageResponseMs > 0 ? formatDuration(summary.averageResponseMs) : "—"}
          subtitle={
            summary.responseSamples > 0
              ? `Based on ${summary.responseSamples} active service${summary.responseSamples === 1 ? "" : "s"}`
              : "No services with active responses"
          }
          icon={Clock}
          variant="warning"
        />
      )}
    </div>
  );
}
