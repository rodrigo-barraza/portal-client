import type { ReactNode } from "react";
import { Globe, Lock, Server } from "lucide-react";
import { BadgeComponent, ChartLineComponent } from "@rodrigo-barraza/components-library";
import {
  formatBytes,
  formatDuration,
  formatPercent,
  getRootDomain,
} from "@rodrigo-barraza/utilities-library";
import type { ContainerRow, ContainerStatusKind } from "@/types/portal";
import { HISTORY_MAX, percentCeiling, type HistoryMap } from "../monitoring/containerHistory";
import { dockerUptimeSeconds, parseDockerUptime } from "../monitoring/dockerStatus";
import { severityColor, type SeverityThresholds } from "../monitoring/severity";
import UsageBar from "../monitoring/UsageBar";
import { ContainerStatusIcon, StatusIndicator } from "./ContainerStatus";
import { memoryUsage } from "./containerRows";
import styles from "./ContainerTable.module.css";

const STATUS_RANK: Record<ContainerStatusKind, number> = { healthy: 2, unknown: 1, down: 0 };

const ROW_CLASS: Record<ContainerStatusKind, string> = {
  healthy: styles['status-row-healthy'],
  down: styles['status-row-unhealthy'],
  unknown: styles['status-row-unknown'],
};

export const getContainerRowClassName = (row: ContainerRow) => ROW_CLASS[row.statusKind];

const formatPercentValue = (value: number) => formatPercent(value, "adaptive");

const dash = <span className={styles['dim-text']}>—</span>;

export interface ContainerColumnOptions {
  history: HistoryMap;
  hostRam: Record<string, number>;
  thresholds: SeverityThresholds;
  showResponseTimes: boolean;
  renderActions: (row: ContainerRow) => ReactNode;
}

/** Column definitions for the Containers table. */
export function buildContainerColumns({
  history,
  hostRam,
  thresholds,
  showResponseTimes,
  renderActions,
}: ContainerColumnOptions) {
  const columns = [
    {
      key: "name",
      label: "Container",
      sortable: true,
      render: (row: ContainerRow) => (
        <div className={styles['name-cell']}>
          <ContainerStatusIcon statusKind={row.statusKind} />
          {/* Keyboard entry point: its click bubbles to the row handler. */}
          <button
            type="button"
            className={styles['container-name']}
            aria-label={`Show details for ${row.containerName}`}
          >
            {row.containerName}
          </button>
        </div>
      ),
      sortValue: (row: ContainerRow) => row.containerName,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row: ContainerRow) => <StatusIndicator statusKind={row.statusKind} />,
      sortValue: (row: ContainerRow) => STATUS_RANK[row.statusKind],
    },
    {
      key: "cpu",
      label: "CPU",
      sortable: true,
      render: (row: ContainerRow) => {
        const cpuPercent = row._stats?.cpu?.percent;
        if (cpuPercent == null) return dash;
        const color = severityColor(cpuPercent, thresholds.cpu);
        return (
          <div className={styles['metric-cell']}>
            <span className={styles['metric-value']} style={{ color }}>
              {formatPercent(cpuPercent, "adaptive")}
            </span>
            <UsageBar percent={cpuPercent} color={color} />
          </div>
        );
      },
      sortValue: (row: ContainerRow) => row._stats?.cpu?.percent ?? -1,
    },
    {
      key: "cpuTrend",
      label: "CPU Trend",
      sortable: false,
      render: (row: ContainerRow) => {
        const series = history[row.id]?.cpu;
        if (!series || series.length < 2) return dash;
        return (
          <div className={styles['inline-sparkline']}>
            <ChartLineComponent
              data={series}
              color="var(--color-success)"
              maxValue={percentCeiling(series)}
              height={24}
              historyMax={HISTORY_MAX}
              showGrid
              formatValue={formatPercentValue}
            />
          </div>
        );
      },
    },
    {
      key: "ram",
      label: "RAM",
      sortable: true,
      render: (row: ContainerRow) => {
        const memory = row._stats?.memory;
        if (!memory) return dash;
        const { capped, percent } = memoryUsage(memory, hostRam[row.device || ""] || 0);
        const color = severityColor(percent, thresholds.memory);
        return (
          <div className={styles['metric-cell']}>
            <span className={styles['metric-value']} style={{ color }}>
              {formatBytes(memory.used)}
              <span className={styles['metric-limit']}>
                {" "}
                / {capped ? formatBytes(memory.limit) : "∞"}
              </span>
            </span>
            <UsageBar percent={percent} color={color} />
          </div>
        );
      },
      sortValue: (row: ContainerRow) => row._stats?.memory?.used ?? -1,
    },
    {
      key: "ramTrend",
      label: "RAM Trend",
      sortable: false,
      render: (row: ContainerRow) => {
        const series = history[row.id]?.mem;
        if (!series || series.length < 2) return dash;
        return (
          <div className={styles['inline-sparkline']}>
            <ChartLineComponent
              data={series}
              color="var(--color-info)"
              maxValue={row._stats?.memory?.limit || Math.max(...series, 1)}
              height={24}
              historyMax={HISTORY_MAX}
              showGrid
              formatValue={formatBytes}
            />
          </div>
        );
      },
    },
    {
      key: "netio",
      label: "Net I/O",
      sortable: true,
      render: (row: ContainerRow) => {
        const network = row._stats?.network;
        if (!network || (network.rx === 0 && network.tx === 0)) return dash;
        return (
          <div className={styles['input-output-cell']}>
            <span className={styles['input-output-compact']}>
              <span className={styles['input-output-arrow']}>↓</span>
              {formatBytes(network.rx)}
            </span>
            <span className={styles['input-output-compact']}>
              <span className={styles['input-output-arrow']}>↑</span>
              {formatBytes(network.tx)}
            </span>
          </div>
        );
      },
      sortValue: (row: ContainerRow) =>
        (row._stats?.network?.rx || 0) + (row._stats?.network?.tx || 0),
    },
    {
      key: "uptime",
      label: "Uptime",
      sortable: true,
      description: "Time since the container last started (from Docker's status)",
      render: (row: ContainerRow) => {
        const uptime = parseDockerUptime(row._stats?.status);
        return uptime ? <span className={styles['uptime-text']}>{uptime}</span> : dash;
      },
      sortValue: (row: ContainerRow) => dockerUptimeSeconds(row._stats?.status) ?? -1,
    },
    {
      key: "visibility",
      label: "Visibility",
      sortable: true,
      render: (row: ContainerRow) =>
        row.visibility ? (
          <BadgeComponent type="visibility" visibility={row.visibility} icons={{ Globe, Lock }} />
        ) : null,
      sortValue: (row: ContainerRow) => row.visibility || "",
    },
    {
      key: "port",
      label: "Port",
      sortable: true,
      render: (row: ContainerRow) =>
        row.port ? <BadgeComponent type="port" port={row.port} /> : null,
      sortValue: (row: ContainerRow) => row.port || 0,
    },
    {
      key: "address",
      label: "Address",
      sortable: true,
      description: "Internal IP and port (socket address)",
      render: (row: ContainerRow) =>
        row.url ? <BadgeComponent type="address" address={row.url} link /> : null,
      sortValue: (row: ContainerRow) => row.url || "",
    },
    {
      key: "domain",
      label: "Domain",
      sortable: true,
      description: "Registrable root domain",
      render: (row: ContainerRow) =>
        row.domain && getRootDomain(row.domain) ? (
          <BadgeComponent type="domain" domain={row.domain} icons={{ Globe }} />
        ) : null,
      sortValue: (row: ContainerRow) => getRootDomain(row.domain) || "",
    },
    {
      key: "response",
      label: "Response",
      sortable: true,
      render: (row: ContainerRow) =>
        row.responseTimeMs != null ? (
          <BadgeComponent type="responseTime" ms={row.responseTimeMs} formatter={formatDuration} />
        ) : null,
      sortValue: (row: ContainerRow) => row.responseTimeMs ?? Infinity,
    },
    {
      key: "device",
      label: "Device",
      sortable: true,
      render: (row: ContainerRow) =>
        row.device ? <BadgeComponent type="device" device={row.device} icons={{ Server }} /> : null,
      sortValue: (row: ContainerRow) => row.device || "",
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      align: "right" as const,
      render: renderActions,
    },
  ];

  // Response-time visibility is a user setting (Settings → Monitoring)
  return showResponseTimes ? columns : columns.filter((column) => column.key !== "response");
}
