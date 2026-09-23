import { memo } from "react";
import { Cpu, Globe, Lock, MemoryStick } from "lucide-react";
import { BadgeComponent } from "@rodrigo-barraza/components-library";
import { formatBytes, formatPercent } from "@rodrigo-barraza/utilities-library";
import type { ContainerRow } from "@/types/portal";
import { parseDockerUptime } from "../monitoring/dockerStatus";
import { severityColor, type SeverityThresholds } from "../monitoring/severity";
import type { ContainerAction } from "../monitoring/useActionRunner";
import UsageBar from "../monitoring/UsageBar";
import CardSitePreview from "./CardSitePreview";
import ContainerActionButtons from "./ContainerActionButtons";
import { CheckingPill, ContainerStatusIcon } from "./ContainerStatus";
import { memoryUsage } from "./containerRows";
import styles from "./ContainerCard.module.css";

const STATUS_CLASS = {
  healthy: styles['card-healthy'],
  down: styles['card-unhealthy'],
  unknown: styles['card-unknown'],
} as const;

/** One container in the Containers page card view. */
function ContainerCard({
  row,
  hostRam,
  thresholds,
  active,
  pending,
  rollbackAvailable,
  onSelect,
  onAction,
}: {
  row: ContainerRow;
  hostRam: number;
  thresholds: SeverityThresholds;
  active: boolean;
  pending?: ContainerAction;
  rollbackAvailable: boolean;
  onSelect: (row: ContainerRow) => void;
  onAction: (row: ContainerRow, action: ContainerAction) => void;
}) {
  const stats = row._stats;
  const cpuPercent = stats?.cpu?.percent;
  const memory = stats?.memory;
  const memoryPercent = memory ? memoryUsage(memory, hostRam).percent : null;
  const uptime = parseDockerUptime(stats?.status);

  return (
    <div
      className={`${styles['card']} ${STATUS_CLASS[row.statusKind]} ${active ? styles['card-active'] : ""}`}
      onClick={() => onSelect(row)}
    >
      <div className={styles['card-header']}>
        <div className={styles['card-title-section']}>
          <ContainerStatusIcon statusKind={row.statusKind} />
          {/* Keyboard entry point for the card: its click bubbles to the
              card's own handler, which opens the detail drawer. */}
          <button
            type="button"
            className={styles['card-name']}
            aria-label={`Show details for ${row.containerName}`}
          >
            {row.containerName}
          </button>
        </div>
        <div className={styles['card-badge-section']}>
          {row.statusKind === "unknown" ? (
            <CheckingPill />
          ) : (
            <BadgeComponent type="status" healthy={row.healthy} />
          )}
          {row.device && <span className={styles['card-device-pill']}>{row.device}</span>}
        </div>
      </div>

      <div className={styles['card-meta']}>
        {row.port && <BadgeComponent type="port" port={row.port} />}
        {row.visibility && (
          <BadgeComponent type="visibility" visibility={row.visibility} icons={{ Globe, Lock }} />
        )}
        {row.domain && <BadgeComponent type="domain" domain={row.domain} icons={{ Globe }} />}
      </div>

      {row.projectType === "client" && row.healthy && row.domain && (
        <CardSitePreview domain={row.domain} />
      )}

      <div className={styles['card-metrics-grid']}>
        <div className={styles['card-metric']}>
          <div className={styles['card-metric-header']}>
            <Cpu size={12} className={styles['metric-icon-cpu']} />
            <span className={styles['card-metric-label']}>CPU</span>
            <span className={styles['card-metric-value']}>
              {cpuPercent != null ? formatPercent(cpuPercent, "adaptive") : "—"}
            </span>
          </div>
          {cpuPercent != null && (
            <UsageBar percent={cpuPercent} color={severityColor(cpuPercent, thresholds.cpu)} />
          )}
        </div>

        <div className={styles['card-metric']}>
          <div className={styles['card-metric-header']}>
            <MemoryStick size={12} className={styles['metric-icon-ram']} />
            <span className={styles['card-metric-label']}>RAM</span>
            <span className={styles['card-metric-value']}>
              {memory ? formatBytes(memory.used) : "—"}
            </span>
          </div>
          {memoryPercent != null && (
            <UsageBar
              percent={memoryPercent}
              color={severityColor(memoryPercent, thresholds.memory)}
            />
          )}
        </div>
      </div>

      <div className={styles['card-footer']}>
        <div className={styles['card-uptime']}>
          {uptime ? (
            <>
              <span className={styles['uptime-label']}>Uptime:</span>
              <span className={styles['uptime-value']}>{uptime}</span>
            </>
          ) : (
            "—"
          )}
        </div>
        <ContainerActionButtons
          row={row}
          pending={pending}
          rollbackAvailable={rollbackAvailable}
          onAction={onAction}
        />
      </div>
    </div>
  );
}

export default memo(ContainerCard);
