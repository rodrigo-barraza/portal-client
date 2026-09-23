import { Check, Cpu, Globe, MemoryStick, X } from "lucide-react";
import { StatsCardComponent } from "@rodrigo-barraza/components-library";
import { formatBytes, formatPercent } from "@rodrigo-barraza/utilities-library";
import type { DockerContainerStats } from "@/types/portal";
import { severityOf, type SeverityThresholds } from "../monitoring/severity";
import styles from "./LogStatisticsPanel.module.css";

/** Status / CPU / memory / network cards above the log terminal. */
export default function LogStatisticsPanel({
  stats,
  thresholds,
}: {
  stats: DockerContainerStats;
  thresholds: SeverityThresholds;
}) {
  const isRunning = stats.state === "running";
  const cpuPercent = stats.cpu.percent;
  const cores = stats.cpu.cores;
  const memory = stats.memory;
  const received = stats.network.rx;
  const sent = stats.network.tx;

  return (
    <div className={styles['panel']}>
      <StatsCardComponent
        label="Status"
        value={stats.state || "unknown"}
        subtitle={<span title={stats.status || ""}>{stats.status || "No status"}</span>}
        icon={isRunning ? Check : X}
        variant={isRunning ? "success" : "danger"}
      />
      <StatsCardComponent
        label="CPU Usage"
        value={formatPercent(cpuPercent, "adaptive")}
        subtitle={`${cores} core${cores === 1 ? "" : "s"}`}
        icon={Cpu}
        variant={severityOf(cpuPercent, thresholds.cpu)}
      />
      <StatsCardComponent
        label="Memory Used"
        value={formatBytes(memory.used)}
        subtitle={memory.limit ? `Limit: ${formatBytes(memory.limit)}` : "No limit"}
        icon={MemoryStick}
        variant={severityOf(memory.percent, thresholds.memory)}
      />
      <StatsCardComponent
        label="Network I/O"
        value={formatBytes(received + sent)}
        subtitle={`↓ ${formatBytes(received)} · ↑ ${formatBytes(sent)}`}
        icon={Globe}
        variant="accent"
      />
    </div>
  );
}
