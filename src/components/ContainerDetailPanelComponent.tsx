"use client";

import { useState, useRef, useEffect } from "react";
import {
  Box,
  Clock,
  Cpu,
  Database,
  Globe,
  HardDrive,
  Layers,
  Lock,
  MemoryStick,
  Server,
  Terminal,
  Unplug,
} from "lucide-react";
import {
  BadgeComponent,
  ChartLineComponent,
  LoadingIndicatorComponent,
} from "@rodrigo-barraza/components-library";
import {
  formatBytes,
  formatDuration,
  formatPercent,
} from "@rodrigo-barraza/utilities-library";
import type {
  ContainerRow,
  ContainerStats,
  ContainerDetailHistory,
  ContainerMetricsPoint,
  NetworkInterface,
  PortMapping,
  VolumeMount,
} from "../types/portal";
import ApiService from "../services/ApiService";
import styles from "./ContainerDetailPanelComponent.module.css";

const MAX_SPARKLINE_POINTS = 60;

function severityColor(
  pct: number,
  thresholds: [number, number] = [40, 80],
): string {
  if (pct > thresholds[1]) return "var(--color-danger)";
  if (pct > thresholds[0]) return "var(--color-warning)";
  return "var(--color-success)";
}

function PercentBar({ percent, color }: { percent: number; color: string }) {
  const clamped = Math.min(percent, 100);
  return (
    <div className={styles.barTrack}>
      <div
        className={styles.barFill}
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}

/** Format nanoseconds to human-readable duration */
function formatNanoseconds(ns: number): string {
  if (!ns || ns === 0) return "0s";
  const ms = ns / 1_000_000;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const totalMinutes = totalSeconds / 60;
  return `${totalMinutes.toFixed(1)}m`;
}

/** Format a Unix timestamp to a localized string */
function formatTimestamp(ts: number): string {
  if (!ts) return "—";
  const date = new Date(ts * 1000);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Main Panel ────────────────────────────────────────────────────

export default function ContainerDetailPanel({
  container,
  stats,
}: {
  container: ContainerRow;
  stats: ContainerStats | null;
}) {
  const [history, setHistory] = useState<ContainerDetailHistory | null>(null);
  const didFetch = useRef(false);

  // Fetch sparkline history — prefer persistent metrics, fall back to ring buffer
  useEffect(() => {
    if (didFetch.current || !container) return;
    didFetch.current = true;

    (async () => {
      try {
        // Try persistent MongoDB metrics first (1 hour of 30s samples)
        const metricsRes = await ApiService.getContainerMetrics({
          container: container.containerName,
          range: "1h",
          limit: MAX_SPARKLINE_POINTS,
        });

        const containerData = metricsRes?.containers?.[container.containerName];
        if (containerData?.points?.length >= 2) {
          setHistory({
            cpu: containerData.points.map(
              (p: ContainerMetricsPoint) => p.cpu ?? 0,
            ),
            mem: containerData.points.map(
              (p: ContainerMetricsPoint) => p.mem ?? 0,
            ),
            netRx: containerData.points.map(
              (p: ContainerMetricsPoint) => p.netRx ?? 0,
            ),
            netTx: containerData.points.map(
              (p: ContainerMetricsPoint) => p.netTx ?? 0,
            ),
          });
          return;
        }

        // Fall back to in-memory ring buffer
        // Fall back to in-memory ring buffer
        const statsHistoryResponse = await ApiService.getContainerStatsHistory();
        if (statsHistoryResponse?.history) {
          const cpuPoints: number[] = [];
          const memPoints: number[] = [];
          const netRxPoints: number[] = [];
          const netTxPoints: number[] = [];

          // Ring buffer returns per-device history; flatten all devices
          for (const deviceHistory of Object.values(statsHistoryResponse.history) as unknown[]) {
            const historyEntries = Array.isArray(deviceHistory)
              ? deviceHistory
              : [];
            for (const snap of historyEntries) {
              const snapshotRecord = snap as Record<
                string,
                Record<string, Record<string, number>>
              >;
              const containerSnapshot =
                snapshotRecord?.containers?.[container.containerName];
              if (containerSnapshot) {
                cpuPoints.push(containerSnapshot.cpu ?? 0);
                memPoints.push(containerSnapshot.memoryUsed ?? 0);
                netRxPoints.push(containerSnapshot.netRx ?? 0);
                netTxPoints.push(containerSnapshot.netTx ?? 0);
              }
            }
          }

          if (cpuPoints.length >= 2) {
            setHistory({
              cpu: cpuPoints,
              mem: memPoints,
              netRx: netRxPoints,
              netTx: netTxPoints,
            });
          }
        }
      } catch {
        /* silent */
      }
    })();
  }, [container]);

  // Extract uptime from status string
  const uptimeMatch = stats?.status?.match(/Up\s+(.*?)(?:\s*\(|$)/);
  const uptime = uptimeMatch ? uptimeMatch[1].trim() : null;

  return (
    <div className={styles.panel}>
      {/* ── Identity & Status ── */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Status</h4>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Health</span>
            <BadgeComponent type="status" healthy={container.healthy} />
          </div>
          {container.visibility && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Visibility</span>
              <BadgeComponent
                type="visibility"
                visibility={container.visibility}
                icons={{ Globe, Lock }}
              />
            </div>
          )}
          {container.responseTimeMs != null && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Response</span>
              <BadgeComponent
                type="responseTime"
                ms={container.responseTimeMs}
                formatter={formatDuration}
              />
            </div>
          )}
          {container.device && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Device</span>
              <BadgeComponent
                type="device"
                device={container.device}
                icons={{ Server }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Container Info ── */}
      {stats && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Container</h4>
          <div className={styles.fieldGrid}>
            {stats.image && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Image</span>
                <span className={styles.fieldValueMono}>{stats.image}</span>
              </div>
            )}
            {stats.state && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>State</span>
                <span className={styles.stateBadge} data-state={stats.state}>
                  {stats.state}
                </span>
              </div>
            )}
            {uptime && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Uptime</span>
                <span className={styles.fieldValueMono}>{uptime}</span>
              </div>
            )}
            {stats.created && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Created</span>
                <span className={styles.fieldValueMono}>
                  {formatTimestamp(stats.created)}
                </span>
              </div>
            )}
            {stats.command && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Command</span>
                <span className={styles.commandText} title={stats.command}>
                  {stats.command}
                </span>
              </div>
            )}
            {(stats.pids ?? 0) > 0 && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>PIDs</span>
                <span className={styles.fieldValueMono}>{stats.pids}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {container.port || container.url ? (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Networking</h4>
          <div className={styles.fieldGrid}>
            {container.port && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Port</span>
                <BadgeComponent type="port" port={container.port} />
              </div>
            )}
            {container.url && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Address</span>
                <BadgeComponent type="address" address={container.url} link />
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Metrics ── */}
      {stats ? (
        <div className={styles.metricsGrid}>
          {/* CPU */}
          <div className={styles.metricCard}>
            <div className={styles.metricCardHeader}>
              <Cpu
                size={13}
                strokeWidth={2.2}
                className={styles.metricCardIcon}
              />
              <span className={styles.metricCardTitle}>CPU</span>
              <span
                className={styles.metricCardValue}
                style={{ color: severityColor(stats.cpu.percent) }}
              >
                {formatPercent(stats.cpu.percent, "adaptive")}
              </span>
              <span className={styles.metricCardDim}>
                · {stats.cpu.cores} core{stats.cpu.cores !== 1 ? "s" : ""}
              </span>
            </div>
            <PercentBar
              percent={stats.cpu.percent}
              color={severityColor(stats.cpu.percent)}
            />
            {(history?.cpu?.length ?? 0) >= 2 && (
              <ChartLineComponent
                data={history!.cpu}
                color={severityColor(stats.cpu.percent)}
                maxValue={100}
                height={36}
                historyMax={MAX_SPARKLINE_POINTS}
                formatValue={(v: number) => `${v.toFixed(1)}%`}
              />
            )}
          </div>

          {/* CPU Throttling */}
          {stats.cpuThrottling && stats.cpuThrottling.throttledPeriods > 0 && (
            <div className={styles.metricCard}>
              <div className={styles.metricCardHeader}>
                <Cpu
                  size={13}
                  strokeWidth={2.2}
                  className={styles.metricCardIcon}
                />
                <span className={styles.metricCardTitle}>CPU Throttling</span>
              </div>
              <div className={styles.inputOutputStats}>
                <span className={styles.inputOutputStat}>
                  <span className={styles.inputOutputDirection}>Throttled</span>
                  <span className={styles.inputOutputValue}>
                    {stats.cpuThrottling.throttledPeriods} /{" "}
                    {stats.cpuThrottling.periods} periods
                  </span>
                </span>
                <span className={styles.inputOutputStat}>
                  <span className={styles.inputOutputDirection}>Time</span>
                  <span className={styles.inputOutputValue}>
                    {formatNanoseconds(stats.cpuThrottling.throttledTimeNs)}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Memory */}
          <div className={styles.metricCard}>
            <div className={styles.metricCardHeader}>
              <MemoryStick
                size={13}
                strokeWidth={2.2}
                className={styles.metricCardIcon}
              />
              <span className={styles.metricCardTitle}>RAM</span>
              <span
                className={styles.metricCardValue}
                style={{ color: severityColor(stats.memory.percent, [60, 85]) }}
              >
                {formatBytes(stats.memory.used)}
              </span>
              <span className={styles.metricCardDim}>
                / {formatBytes(stats.memory.limit)}
              </span>
              <span
                className={styles.metricCardValue}
                style={{ color: severityColor(stats.memory.percent, [60, 85]) }}
              >
                {formatPercent(stats.memory.percent, "adaptive")}
              </span>
            </div>
            <PercentBar
              percent={stats.memory.percent}
              color={severityColor(stats.memory.percent, [60, 85])}
            />
            {(history?.mem?.length ?? 0) >= 2 && (
              <ChartLineComponent
                data={history!.mem}
                color={severityColor(stats.memory.percent, [60, 85])}
                maxValue={stats.memory.limit}
                height={36}
                historyMax={MAX_SPARKLINE_POINTS}
                formatValue={(v: number) => formatBytes(v)}
              />
            )}
          </div>

          {/* Memory Detail */}
          {stats.memoryDetail && (
            <div className={styles.metricCard}>
              <div className={styles.metricCardHeader}>
                <MemoryStick
                  size={13}
                  strokeWidth={2.2}
                  className={styles.metricCardIcon}
                />
                <span className={styles.metricCardTitle}>Memory Breakdown</span>
              </div>
              <div className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>RSS</span>
                  <span className={styles.detailValue}>
                    {formatBytes(stats.memoryDetail.rss)}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Cache</span>
                  <span className={styles.detailValue}>
                    {formatBytes(stats.memoryDetail.cache)}
                  </span>
                </div>
                {stats.memoryDetail.swap > 0 && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Swap</span>
                    <span
                      className={styles.detailValue}
                      style={{ color: "var(--color-warning)" }}
                    >
                      {formatBytes(stats.memoryDetail.swap)}
                    </span>
                  </div>
                )}
                {stats.memoryDetail.maxUsage > 0 && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Peak</span>
                    <span className={styles.detailValue}>
                      {formatBytes(stats.memoryDetail.maxUsage)}
                    </span>
                  </div>
                )}
                {stats.memoryDetail.pgfault > 0 && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Page Faults</span>
                    <span className={styles.detailValue}>
                      {stats.memoryDetail.pgfault.toLocaleString()}
                    </span>
                  </div>
                )}
                {stats.memoryDetail.pgmajfault > 0 && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Major Faults</span>
                    <span
                      className={styles.detailValue}
                      style={{ color: "var(--color-danger)" }}
                    >
                      {stats.memoryDetail.pgmajfault.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Network + Block I/O + PIDs */}
          <div className={styles.metricRow}>
            {stats.network &&
              (stats.network.rx > 0 || stats.network.tx > 0) && (
                <div className={styles.metricCard}>
                  <div className={styles.metricCardHeader}>
                    <Globe
                      size={13}
                      strokeWidth={2.2}
                      className={styles.metricCardIcon}
                    />
                    <span className={styles.metricCardTitle}>Network</span>
                  </div>
                  <div className={styles.inputOutputStats}>
                    <span className={styles.inputOutputStat}>
                      <span className={styles.inputOutputDirection}>RX</span>
                      <span className={styles.inputOutputValue}>
                        {formatBytes(stats.network.rx)}
                      </span>
                    </span>
                    <span className={styles.inputOutputStat}>
                      <span className={styles.inputOutputDirection}>TX</span>
                      <span className={styles.inputOutputValue}>
                        {formatBytes(stats.network.tx)}
                      </span>
                    </span>
                  </div>
                  {/* Packet counts */}
                  {((stats.network.rxPackets ?? 0) > 0 ||
                    (stats.network.txPackets ?? 0) > 0) && (
                    <div className={styles.inputOutputStats}>
                      <span className={styles.inputOutputStat}>
                        <span className={styles.inputOutputDirection}>Packets RX</span>
                        <span className={styles.inputOutputValue}>
                          {stats.network.rxPackets?.toLocaleString()}
                        </span>
                      </span>
                      <span className={styles.inputOutputStat}>
                        <span className={styles.inputOutputDirection}>Packets TX</span>
                        <span className={styles.inputOutputValue}>
                          {stats.network.txPackets?.toLocaleString()}
                        </span>
                      </span>
                    </div>
                  )}
                  {/* Errors / Drops */}
                  {((stats.network.rxDropped ?? 0) > 0 ||
                    (stats.network.txDropped ?? 0) > 0 ||
                    (stats.network.rxErrors ?? 0) > 0 ||
                    (stats.network.txErrors ?? 0) > 0) && (
                    <div className={styles.inputOutputStatsWarning}>
                      {((stats.network.rxDropped ?? 0) > 0 ||
                        (stats.network.txDropped ?? 0) > 0) && (
                        <span className={styles.inputOutputStat}>
                          <span className={styles.inputOutputDirection}>Dropped</span>
                          <span className={styles.inputOutputValue}>
                            {(
                              (stats.network.rxDropped ?? 0) +
                              (stats.network.txDropped ?? 0)
                            ).toLocaleString()}
                          </span>
                        </span>
                      )}
                      {((stats.network.rxErrors ?? 0) > 0 ||
                        (stats.network.txErrors ?? 0) > 0) && (
                        <span className={styles.inputOutputStat}>
                          <span className={styles.inputOutputDirection}>Errors</span>
                          <span className={styles.inputOutputValueDanger}>
                            {(
                              (stats.network.rxErrors ?? 0) +
                              (stats.network.txErrors ?? 0)
                            ).toLocaleString()}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

            {stats.blockIO &&
              (stats.blockIO.read > 0 || stats.blockIO.write > 0) && (
                <div className={styles.metricCard}>
                  <div className={styles.metricCardHeader}>
                    <HardDrive
                      size={13}
                      strokeWidth={2.2}
                      className={styles.metricCardIcon}
                    />
                    <span className={styles.metricCardTitle}>Block I/O</span>
                  </div>
                  <div className={styles.inputOutputStats}>
                    <span className={styles.inputOutputStat}>
                      <span className={styles.inputOutputDirection}>Read</span>
                      <span className={styles.inputOutputValue}>
                        {formatBytes(stats.blockIO.read)}
                      </span>
                    </span>
                    <span className={styles.inputOutputStat}>
                      <span className={styles.inputOutputDirection}>Write</span>
                      <span className={styles.inputOutputValue}>
                        {formatBytes(stats.blockIO.write)}
                      </span>
                    </span>
                  </div>
                </div>
              )}
          </div>

          {/* Per-Interface Network Breakdown */}
          {stats.network?.interfaces &&
            Object.keys(stats.network.interfaces).length > 1 && (
              <div className={styles.metricCard}>
                <div className={styles.metricCardHeader}>
                  <Unplug
                    size={13}
                    strokeWidth={2.2}
                    className={styles.metricCardIcon}
                  />
                  <span className={styles.metricCardTitle}>
                    Network Interfaces
                  </span>
                </div>
                <div className={styles.interfaceList}>
                  {Object.entries(stats.network.interfaces).map(
                    ([name, iface]) => (
                      <div key={name} className={styles.interfaceRow}>
                        <span className={styles.interfaceName}>{name}</span>
                        <span className={styles.inputOutputCompactDetail}>
                          ↓ {formatBytes((iface as NetworkInterface).rxBytes)} ·
                          ↑ {formatBytes((iface as NetworkInterface).txBytes)}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

          {/* Port Mappings */}
          {stats.ports && stats.ports.length > 0 && (
            <div className={styles.metricCard}>
              <div className={styles.metricCardHeader}>
                <Globe
                  size={13}
                  strokeWidth={2.2}
                  className={styles.metricCardIcon}
                />
                <span className={styles.metricCardTitle}>Port Mappings</span>
              </div>
              <div className={styles.portList}>
                {stats.ports.map((p: PortMapping, i: number) => (
                  <div key={i} className={styles.portRow}>
                    <span className={styles.portMapping}>
                      {p.publicPort
                        ? `${p.ip || "0.0.0.0"}:${p.publicPort}`
                        : "—"}{" "}
                      → {p.privatePort}/{p.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Volume Mounts */}
          {stats.mounts && stats.mounts.length > 0 && (
            <div className={styles.metricCard}>
              <div className={styles.metricCardHeader}>
                <Database
                  size={13}
                  strokeWidth={2.2}
                  className={styles.metricCardIcon}
                />
                <span className={styles.metricCardTitle}>Mounts</span>
                <span className={styles.metricCardDim}>
                  {stats.mounts.length}
                </span>
              </div>
              <div className={styles.mountList}>
                {stats.mounts.map((m: VolumeMount, i: number) => (
                  <div key={i} className={styles.mountRow}>
                    <span className={styles.mountType}>{m.type}</span>
                    <span
                      className={styles.mountPath}
                      title={`${m.source} → ${m.destination}`}
                    >
                      {m.name || m.source?.split("/").pop() || m.source} →{" "}
                      {m.destination}
                    </span>
                    <span className={styles.mountMode}>
                      {m.rw ? "rw" : "ro"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Docker Labels */}
          {stats.labels && Object.keys(stats.labels).length > 0 && (
            <div className={styles.metricCard}>
              <div className={styles.metricCardHeader}>
                <Layers
                  size={13}
                  strokeWidth={2.2}
                  className={styles.metricCardIcon}
                />
                <span className={styles.metricCardTitle}>Labels</span>
                <span className={styles.metricCardDim}>
                  {Object.keys(stats.labels).length}
                </span>
              </div>
              <div className={styles.labelList}>
                {Object.entries(stats.labels)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([key, value]) => (
                    <div key={key} className={styles.labelRow}>
                      <span className={styles.labelKey} title={key}>
                        {key}
                      </span>
                      <span
                        className={styles.labelValue}
                        title={value as string}
                      >
                        {value as string}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.metricsEmpty}>
          <Box size={18} strokeWidth={1.5} className={styles.emptyIcon} />
          <span>No metrics available</span>
        </div>
      )}
    </div>
  );
}
