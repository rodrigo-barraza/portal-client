"use client";

import {
  Box,
  Cpu,
  Database,
  Globe,
  HardDrive,
  Layers,
  Lock,
  MemoryStick,
  Server,
  Unplug,
} from "lucide-react";
import { BadgeComponent } from "@rodrigo-barraza/components-library";
import { formatBytes, formatDuration } from "@rodrigo-barraza/utilities-library";
import type { ContainerHistory, ContainerRow, ContainerStats } from "../types/portal";
import { usePortalSettings } from "@/lib/settings";
import {
  CpuMetricCard,
  MemoryMetricCard,
  MetricCard,
  MetricDim,
  MetricRow,
  TransferStat,
  TransferStats,
} from "./monitoring/ContainerMetricCards";
import {
  formatNanoseconds,
  formatUnixTimestamp,
  parseDockerUptime,
} from "./monitoring/dockerStatus";
import type { SeverityThresholds } from "./monitoring/severity";
import styles from "./ContainerDetailPanelComponent.module.css";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles['field']}>
      <span className={styles['field-label']}>{label}</span>
      {children}
    </div>
  );
}

function DetailItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "warning" | "danger";
}) {
  return (
    <div className={styles['detail-item']}>
      <span className={styles['detail-label']}>{label}</span>
      <span className={`${styles['detail-value']} ${tone ? styles[`detail-value-${tone}`] : ""}`}>
        {value}
      </span>
    </div>
  );
}

function ContainerMetrics({
  stats,
  history,
  thresholds,
}: {
  stats: ContainerStats;
  history?: ContainerHistory;
  thresholds: SeverityThresholds;
}) {
  const { network, blockIO, memoryDetail, cpuThrottling } = stats;
  const dropped = (network?.rxDropped ?? 0) + (network?.txDropped ?? 0);
  const errors = (network?.rxErrors ?? 0) + (network?.txErrors ?? 0);
  const interfaces = Object.entries(network?.interfaces ?? {});
  const labels = Object.entries(stats.labels ?? {}).sort(([first], [second]) =>
    first.localeCompare(second),
  );

  return (
    <div className={styles['metrics-grid']}>
      <CpuMetricCard cpu={stats.cpu} history={history?.cpu} bounds={thresholds.cpu} />

      {cpuThrottling && cpuThrottling.throttledPeriods > 0 && (
        <MetricCard icon={Cpu} title="CPU Throttling">
          <TransferStats>
            <TransferStat
              label="Throttled"
              value={`${cpuThrottling.throttledPeriods} / ${cpuThrottling.periods} periods`}
            />
            <TransferStat label="Time" value={formatNanoseconds(cpuThrottling.throttledTimeNs)} />
          </TransferStats>
        </MetricCard>
      )}

      <MemoryMetricCard memory={stats.memory} history={history?.mem} bounds={thresholds.memory} />

      {memoryDetail && (
        <MetricCard icon={MemoryStick} title="Memory Breakdown">
          <div className={styles['detail-grid']}>
            <DetailItem label="RSS" value={formatBytes(memoryDetail.rss)} />
            <DetailItem label="Cache" value={formatBytes(memoryDetail.cache)} />
            {memoryDetail.swap > 0 && (
              <DetailItem label="Swap" value={formatBytes(memoryDetail.swap)} tone="warning" />
            )}
            {memoryDetail.maxUsage > 0 && (
              <DetailItem label="Peak" value={formatBytes(memoryDetail.maxUsage)} />
            )}
            {memoryDetail.pgfault > 0 && (
              <DetailItem label="Page Faults" value={memoryDetail.pgfault.toLocaleString()} />
            )}
            {memoryDetail.pgmajfault > 0 && (
              <DetailItem
                label="Major Faults"
                value={memoryDetail.pgmajfault.toLocaleString()}
                tone="danger"
              />
            )}
          </div>
        </MetricCard>
      )}

      <MetricRow>
        {network && (network.rx > 0 || network.tx > 0) && (
          <MetricCard icon={Globe} title="Network">
            <TransferStats>
              <TransferStat label="RX" value={formatBytes(network.rx)} />
              <TransferStat label="TX" value={formatBytes(network.tx)} />
            </TransferStats>
            {((network.rxPackets ?? 0) > 0 || (network.txPackets ?? 0) > 0) && (
              <TransferStats>
                <TransferStat label="Packets RX" value={(network.rxPackets ?? 0).toLocaleString()} />
                <TransferStat label="Packets TX" value={(network.txPackets ?? 0).toLocaleString()} />
              </TransferStats>
            )}
            {(dropped > 0 || errors > 0) && (
              <TransferStats warning>
                {dropped > 0 && <TransferStat label="Dropped" value={dropped.toLocaleString()} />}
                {errors > 0 && (
                  <TransferStat label="Errors" value={errors.toLocaleString()} danger />
                )}
              </TransferStats>
            )}
          </MetricCard>
        )}

        {blockIO && (blockIO.read > 0 || blockIO.write > 0) && (
          <MetricCard icon={HardDrive} title="Block I/O">
            <TransferStats>
              <TransferStat label="Read" value={formatBytes(blockIO.read)} />
              <TransferStat label="Write" value={formatBytes(blockIO.write)} />
            </TransferStats>
          </MetricCard>
        )}
      </MetricRow>

      {interfaces.length > 1 && (
        <MetricCard icon={Unplug} title="Network Interfaces">
          <div className={styles['list']}>
            {interfaces.map(([name, networkInterface]) => (
              <div key={name} className={styles['interface-row']}>
                <span className={styles['interface-name']}>{name}</span>
                <span className={styles['mono-detail']}>
                  ↓ {formatBytes(networkInterface.rxBytes)} · ↑{" "}
                  {formatBytes(networkInterface.txBytes)}
                </span>
              </div>
            ))}
          </div>
        </MetricCard>
      )}

      {stats.ports && stats.ports.length > 0 && (
        <MetricCard icon={Globe} title="Port Mappings">
          <div className={styles['list']}>
            {stats.ports.map((port, index) => (
              <div
                key={`${port.ip}:${port.publicPort}:${port.privatePort}/${port.type}:${index}`}
                className={styles['port-row']}
              >
                <span className={styles['mono-detail']}>
                  {port.publicPort ? `${port.ip || "0.0.0.0"}:${port.publicPort}` : "—"} →{" "}
                  {port.privatePort}/{port.type}
                </span>
              </div>
            ))}
          </div>
        </MetricCard>
      )}

      {stats.mounts && stats.mounts.length > 0 && (
        <MetricCard
          icon={Database}
          title="Mounts"
          header={<MetricDim>{stats.mounts.length}</MetricDim>}
        >
          <div className={styles['list']}>
            {stats.mounts.map((mount) => (
              <div key={`${mount.destination}:${mount.source}`} className={styles['mount-row']}>
                <span className={styles['mount-type']}>{mount.type}</span>
                <span
                  className={styles['mount-path']}
                  title={`${mount.source} → ${mount.destination}`}
                >
                  {mount.name || mount.source?.split("/").pop() || mount.source} →{" "}
                  {mount.destination}
                </span>
                <span className={styles['mount-mode']}>{mount.rw ? "rw" : "ro"}</span>
              </div>
            ))}
          </div>
        </MetricCard>
      )}

      {labels.length > 0 && (
        <MetricCard icon={Layers} title="Labels" header={<MetricDim>{labels.length}</MetricDim>}>
          <div className={styles['label-list']}>
            {labels.map(([key, value]) => (
              <div key={key} className={styles['label-row']}>
                <span className={styles['label-key']} title={key}>
                  {key}
                </span>
                <span className={styles['label-value']} title={value}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </MetricCard>
      )}
    </div>
  );
}

/**
 * Drawer body for a Containers row: identity, Docker metadata and live
 * metrics. Sparkline history comes from the page, which already keeps a
 * per-container series (seeded from persisted metrics, extended by every
 * poll) — so the drawer's charts stay live instead of freezing at open.
 */
export default function ContainerDetailPanel({
  container,
  stats,
  history,
  thresholds,
}: {
  container: ContainerRow;
  stats: ContainerStats | null;
  history?: ContainerHistory;
  thresholds: SeverityThresholds;
}) {
  const { showResponseTimes } = usePortalSettings();
  const uptime = parseDockerUptime(stats?.status);

  return (
    <div className={`container-detail-panel-component ${styles['panel']}`}>
      <div className={styles['section']}>
        <h4 className={styles['section-title']}>Status</h4>
        <div className={styles['field-grid']}>
          <Field label="Health">
            {container.statusKind === "unknown" ? (
              <span className={styles['status-unknown-text']} title="Not yet checked">
                Checking…
              </span>
            ) : (
              <BadgeComponent type="status" healthy={container.healthy} />
            )}
          </Field>
          {container.visibility && (
            <Field label="Visibility">
              <BadgeComponent
                type="visibility"
                visibility={container.visibility}
                icons={{ Globe, Lock }}
              />
            </Field>
          )}
          {showResponseTimes && container.responseTimeMs != null && (
            <Field label="Response">
              <BadgeComponent
                type="responseTime"
                ms={container.responseTimeMs}
                formatter={formatDuration}
              />
            </Field>
          )}
          {container.device && (
            <Field label="Device">
              <BadgeComponent type="device" device={container.device} icons={{ Server }} />
            </Field>
          )}
        </div>
      </div>

      {stats && (
        <div className={styles['section']}>
          <h4 className={styles['section-title']}>Container</h4>
          <div className={styles['field-grid']}>
            {stats.image && (
              <Field label="Image">
                <span className={styles['field-value-mono']}>{stats.image}</span>
              </Field>
            )}
            {stats.state && (
              <Field label="State">
                <span className={styles['state-badge']} data-state={stats.state}>
                  {stats.state}
                </span>
              </Field>
            )}
            {uptime && (
              <Field label="Uptime">
                <span className={styles['field-value-mono']}>{uptime}</span>
              </Field>
            )}
            {stats.created ? (
              <Field label="Created">
                <span className={styles['field-value-mono']}>
                  {formatUnixTimestamp(stats.created)}
                </span>
              </Field>
            ) : null}
            {stats.command && (
              <Field label="Command">
                <span className={styles['command-text']} title={stats.command}>
                  {stats.command}
                </span>
              </Field>
            )}
            {(stats.pids ?? 0) > 0 && (
              <Field label="PIDs">
                <span className={styles['field-value-mono']}>{stats.pids}</span>
              </Field>
            )}
          </div>
        </div>
      )}

      {(container.port || container.url) && (
        <div className={styles['section']}>
          <h4 className={styles['section-title']}>Networking</h4>
          <div className={styles['field-grid']}>
            {container.port && (
              <Field label="Port">
                <BadgeComponent type="port" port={container.port} />
              </Field>
            )}
            {container.url && (
              <Field label="Address">
                <BadgeComponent type="address" address={container.url} link />
              </Field>
            )}
          </div>
        </div>
      )}

      {stats ? (
        <ContainerMetrics stats={stats} history={history} thresholds={thresholds} />
      ) : (
        <div className={styles['metrics-empty']}>
          <Box size={18} strokeWidth={1.5} className={styles['empty-icon']} />
          <span>No metrics available</span>
        </div>
      )}
    </div>
  );
}
