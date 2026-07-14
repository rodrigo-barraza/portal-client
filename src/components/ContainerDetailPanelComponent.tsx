"use client";

import { useState, useRef, useEffect } from "react";
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
import {
  BadgeComponent,
  ChartLineComponent,
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
  percent: number,
  thresholds: [number, number] = [40, 80],
): string {
  if (percent > thresholds[1]) return "var(--color-danger)";
  if (percent > thresholds[0]) return "var(--color-warning)";
  return "var(--color-success)";
}

function PercentBar({ percent, color }: { percent: number; color: string }) {
  const clamped = Math.min(percent, 100);
  return (
    <div className={styles['bar-track']}>
      <div
        className={styles['bar-fill']}
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
              (point: ContainerMetricsPoint) => point.cpu ?? 0,
            ),
            mem: containerData.points.map(
              (point: ContainerMetricsPoint) => point.mem ?? 0,
            ),
            netRx: containerData.points.map(
              (point: ContainerMetricsPoint) => point.netRx ?? 0,
            ),
            netTx: containerData.points.map(
              (point: ContainerMetricsPoint) => point.netTx ?? 0,
            ),
          });
          return;
        }

        // Fall back to in-memory ring buffer
        // Fall back to in-memory ring buffer
        const statsHistoryResponse = await ApiService.getContainerStatsHistory();
        if (statsHistoryResponse?.history) {
          const cpuPoints: number[] = [];
          const memoryPoints: number[] = [];
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
                memoryPoints.push(containerSnapshot.memoryUsed ?? 0);
                netRxPoints.push(containerSnapshot.netRx ?? 0);
                netTxPoints.push(containerSnapshot.netTx ?? 0);
              }
            }
          }

          if (cpuPoints.length >= 2) {
            setHistory({
              cpu: cpuPoints,
              mem: memoryPoints,
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
    <div className={`container-detail-panel-component ${styles['panel']}`}>
      {/* ── Identity & Status ── */}
      <div className={styles['section']}>
        <h4 className={styles['section-title']}>Status</h4>
        <div className={styles['field-grid']}>
          <div className={styles['field']}>
            <span className={styles['field-label']}>Health</span>
            <BadgeComponent type="status" healthy={container.healthy} />
          </div>
          {container.visibility && (
            <div className={styles['field']}>
              <span className={styles['field-label']}>Visibility</span>
              <BadgeComponent
                type="visibility"
                visibility={container.visibility}
                icons={{ Globe, Lock }}
              />
            </div>
          )}
          {container.responseTimeMs != null && (
            <div className={styles['field']}>
              <span className={styles['field-label']}>Response</span>
              <BadgeComponent
                type="responseTime"
                ms={container.responseTimeMs}
                formatter={formatDuration}
              />
            </div>
          )}
          {container.device && (
            <div className={styles['field']}>
              <span className={styles['field-label']}>Device</span>
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
        <div className={styles['section']}>
          <h4 className={styles['section-title']}>Container</h4>
          <div className={styles['field-grid']}>
            {stats.image && (
              <div className={styles['field']}>
                <span className={styles['field-label']}>Image</span>
                <span className={styles['field-value-mono']}>{stats.image}</span>
              </div>
            )}
            {stats.state && (
              <div className={styles['field']}>
                <span className={styles['field-label']}>State</span>
                <span className={styles['state-badge']} data-state={stats.state}>
                  {stats.state}
                </span>
              </div>
            )}
            {uptime && (
              <div className={styles['field']}>
                <span className={styles['field-label']}>Uptime</span>
                <span className={styles['field-value-mono']}>{uptime}</span>
              </div>
            )}
            {stats.created && (
              <div className={styles['field']}>
                <span className={styles['field-label']}>Created</span>
                <span className={styles['field-value-mono']}>
                  {formatTimestamp(stats.created)}
                </span>
              </div>
            )}
            {stats.command && (
              <div className={styles['field']}>
                <span className={styles['field-label']}>Command</span>
                <span className={styles['command-text']} title={stats.command}>
                  {stats.command}
                </span>
              </div>
            )}
            {(stats.pids ?? 0) > 0 && (
              <div className={styles['field']}>
                <span className={styles['field-label']}>PIDs</span>
                <span className={styles['field-value-mono']}>{stats.pids}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {container.port || container.url ? (
        <div className={styles['section']}>
          <h4 className={styles['section-title']}>Networking</h4>
          <div className={styles['field-grid']}>
            {container.port && (
              <div className={styles['field']}>
                <span className={styles['field-label']}>Port</span>
                <BadgeComponent type="port" port={container.port} />
              </div>
            )}
            {container.url && (
              <div className={styles['field']}>
                <span className={styles['field-label']}>Address</span>
                <BadgeComponent type="address" address={container.url} link />
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Metrics ── */}
      {stats ? (
        <div className={styles['metrics-grid']}>
          {/* CPU */}
          <div className={styles['metric-card']}>
            <div className={styles['metric-card-header']}>
              <Cpu
                size={13}
                strokeWidth={2.2}
                className={styles['metric-card-icon']}
              />
              <span className={styles['metric-card-title']}>CPU</span>
              <span
                className={styles['metric-card-value']}
                style={{ color: severityColor(stats.cpu.percent) }}
              >
                {formatPercent(stats.cpu.percent, "adaptive")}
              </span>
              <span className={styles['metric-card-dim']}>
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
                formatValue={(value: number) => `${value.toFixed(1)}%`}
              />
            )}
          </div>

          {/* CPU Throttling */}
          {stats.cpuThrottling && stats.cpuThrottling.throttledPeriods > 0 && (
            <div className={styles['metric-card']}>
              <div className={styles['metric-card-header']}>
                <Cpu
                  size={13}
                  strokeWidth={2.2}
                  className={styles['metric-card-icon']}
                />
                <span className={styles['metric-card-title']}>CPU Throttling</span>
              </div>
              <div className={styles['input-output-stats']}>
                <span className={styles['input-output-stat']}>
                  <span className={styles['input-output-direction']}>Throttled</span>
                  <span className={styles['input-output-value']}>
                    {stats.cpuThrottling.throttledPeriods} /{" "}
                    {stats.cpuThrottling.periods} periods
                  </span>
                </span>
                <span className={styles['input-output-stat']}>
                  <span className={styles['input-output-direction']}>Time</span>
                  <span className={styles['input-output-value']}>
                    {formatNanoseconds(stats.cpuThrottling.throttledTimeNs)}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Memory */}
          <div className={styles['metric-card']}>
            <div className={styles['metric-card-header']}>
              <MemoryStick
                size={13}
                strokeWidth={2.2}
                className={styles['metric-card-icon']}
              />
              <span className={styles['metric-card-title']}>RAM</span>
              <span
                className={styles['metric-card-value']}
                style={{ color: severityColor(stats.memory.percent, [60, 85]) }}
              >
                {formatBytes(stats.memory.used)}
              </span>
              <span className={styles['metric-card-dim']}>
                / {formatBytes(stats.memory.limit)}
              </span>
              <span
                className={styles['metric-card-value']}
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
                formatValue={(value: number) => formatBytes(value)}
              />
            )}
          </div>

          {/* Memory Detail */}
          {stats.memoryDetail && (
            <div className={styles['metric-card']}>
              <div className={styles['metric-card-header']}>
                <MemoryStick
                  size={13}
                  strokeWidth={2.2}
                  className={styles['metric-card-icon']}
                />
                <span className={styles['metric-card-title']}>Memory Breakdown</span>
              </div>
              <div className={styles['detail-grid']}>
                <div className={styles['detail-item']}>
                  <span className={styles['detail-label']}>RSS</span>
                  <span className={styles['detail-value']}>
                    {formatBytes(stats.memoryDetail.rss)}
                  </span>
                </div>
                <div className={styles['detail-item']}>
                  <span className={styles['detail-label']}>Cache</span>
                  <span className={styles['detail-value']}>
                    {formatBytes(stats.memoryDetail.cache)}
                  </span>
                </div>
                {stats.memoryDetail.swap > 0 && (
                  <div className={styles['detail-item']}>
                    <span className={styles['detail-label']}>Swap</span>
                    <span
                      className={styles['detail-value']}
                      style={{ color: "var(--color-warning)" }}
                    >
                      {formatBytes(stats.memoryDetail.swap)}
                    </span>
                  </div>
                )}
                {stats.memoryDetail.maxUsage > 0 && (
                  <div className={styles['detail-item']}>
                    <span className={styles['detail-label']}>Peak</span>
                    <span className={styles['detail-value']}>
                      {formatBytes(stats.memoryDetail.maxUsage)}
                    </span>
                  </div>
                )}
                {stats.memoryDetail.pgfault > 0 && (
                  <div className={styles['detail-item']}>
                    <span className={styles['detail-label']}>Page Faults</span>
                    <span className={styles['detail-value']}>
                      {stats.memoryDetail.pgfault.toLocaleString()}
                    </span>
                  </div>
                )}
                {stats.memoryDetail.pgmajfault > 0 && (
                  <div className={styles['detail-item']}>
                    <span className={styles['detail-label']}>Major Faults</span>
                    <span
                      className={styles['detail-value']}
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
          <div className={styles['metric-row']}>
            {stats.network &&
              (stats.network.rx > 0 || stats.network.tx > 0) && (
                <div className={styles['metric-card']}>
                  <div className={styles['metric-card-header']}>
                    <Globe
                      size={13}
                      strokeWidth={2.2}
                      className={styles['metric-card-icon']}
                    />
                    <span className={styles['metric-card-title']}>Network</span>
                  </div>
                  <div className={styles['input-output-stats']}>
                    <span className={styles['input-output-stat']}>
                      <span className={styles['input-output-direction']}>RX</span>
                      <span className={styles['input-output-value']}>
                        {formatBytes(stats.network.rx)}
                      </span>
                    </span>
                    <span className={styles['input-output-stat']}>
                      <span className={styles['input-output-direction']}>TX</span>
                      <span className={styles['input-output-value']}>
                        {formatBytes(stats.network.tx)}
                      </span>
                    </span>
                  </div>
                  {/* Packet counts */}
                  {((stats.network.rxPackets ?? 0) > 0 ||
                    (stats.network.txPackets ?? 0) > 0) && (
                    <div className={styles['input-output-stats']}>
                      <span className={styles['input-output-stat']}>
                        <span className={styles['input-output-direction']}>Packets RX</span>
                        <span className={styles['input-output-value']}>
                          {stats.network.rxPackets?.toLocaleString()}
                        </span>
                      </span>
                      <span className={styles['input-output-stat']}>
                        <span className={styles['input-output-direction']}>Packets TX</span>
                        <span className={styles['input-output-value']}>
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
                    <div className={styles['input-output-stats-warning']}>
                      {((stats.network.rxDropped ?? 0) > 0 ||
                        (stats.network.txDropped ?? 0) > 0) && (
                        <span className={styles['input-output-stat']}>
                          <span className={styles['input-output-direction']}>Dropped</span>
                          <span className={styles['input-output-value']}>
                            {(
                              (stats.network.rxDropped ?? 0) +
                              (stats.network.txDropped ?? 0)
                            ).toLocaleString()}
                          </span>
                        </span>
                      )}
                      {((stats.network.rxErrors ?? 0) > 0 ||
                        (stats.network.txErrors ?? 0) > 0) && (
                        <span className={styles['input-output-stat']}>
                          <span className={styles['input-output-direction']}>Errors</span>
                          <span className={styles['input-output-value-danger']}>
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
                <div className={styles['metric-card']}>
                  <div className={styles['metric-card-header']}>
                    <HardDrive
                      size={13}
                      strokeWidth={2.2}
                      className={styles['metric-card-icon']}
                    />
                    <span className={styles['metric-card-title']}>Block I/O</span>
                  </div>
                  <div className={styles['input-output-stats']}>
                    <span className={styles['input-output-stat']}>
                      <span className={styles['input-output-direction']}>Read</span>
                      <span className={styles['input-output-value']}>
                        {formatBytes(stats.blockIO.read)}
                      </span>
                    </span>
                    <span className={styles['input-output-stat']}>
                      <span className={styles['input-output-direction']}>Write</span>
                      <span className={styles['input-output-value']}>
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
              <div className={styles['metric-card']}>
                <div className={styles['metric-card-header']}>
                  <Unplug
                    size={13}
                    strokeWidth={2.2}
                    className={styles['metric-card-icon']}
                  />
                  <span className={styles['metric-card-title']}>
                    Network Interfaces
                  </span>
                </div>
                <div className={styles['interface-list']}>
                  {Object.entries(stats.network.interfaces).map(
                    ([name, iface]) => (
                      <div key={name} className={styles['interface-row']}>
                        <span className={styles['interface-name']}>{name}</span>
                        <span className={styles['input-output-compact-detail']}>
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
            <div className={styles['metric-card']}>
              <div className={styles['metric-card-header']}>
                <Globe
                  size={13}
                  strokeWidth={2.2}
                  className={styles['metric-card-icon']}
                />
                <span className={styles['metric-card-title']}>Port Mappings</span>
              </div>
              <div className={styles['port-list']}>
                {stats.ports.map((port: PortMapping, i: number) => (
                  <div key={i} className={styles['port-row']}>
                    <span className={styles['port-mapping']}>
                      {port.publicPort
                        ? `${port.ip || "0.0.0.0"}:${port.publicPort}`
                        : "—"}{" "}
                      → {port.privatePort}/{port.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Volume Mounts */}
          {stats.mounts && stats.mounts.length > 0 && (
            <div className={styles['metric-card']}>
              <div className={styles['metric-card-header']}>
                <Database
                  size={13}
                  strokeWidth={2.2}
                  className={styles['metric-card-icon']}
                />
                <span className={styles['metric-card-title']}>Mounts</span>
                <span className={styles['metric-card-dim']}>
                  {stats.mounts.length}
                </span>
              </div>
              <div className={styles['mount-list']}>
                {stats.mounts.map((mount: VolumeMount, i: number) => (
                  <div key={i} className={styles['mount-row']}>
                    <span className={styles['mount-type']}>{mount.type}</span>
                    <span
                      className={styles['mount-path']}
                      title={`${mount.source} → ${mount.destination}`}
                    >
                      {mount.name || mount.source?.split("/").pop() || mount.source} →{" "}
                      {mount.destination}
                    </span>
                    <span className={styles['mount-mode']}>
                      {mount.rw ? "rw" : "ro"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Docker Labels */}
          {stats.labels && Object.keys(stats.labels).length > 0 && (
            <div className={styles['metric-card']}>
              <div className={styles['metric-card-header']}>
                <Layers
                  size={13}
                  strokeWidth={2.2}
                  className={styles['metric-card-icon']}
                />
                <span className={styles['metric-card-title']}>Labels</span>
                <span className={styles['metric-card-dim']}>
                  {Object.keys(stats.labels).length}
                </span>
              </div>
              <div className={styles['label-list']}>
                {Object.entries(stats.labels)
                  .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
                  .map(([key, value]) => (
                    <div key={key} className={styles['label-row']}>
                      <span className={styles['label-key']} title={key}>
                        {key}
                      </span>
                      <span
                        className={styles['label-value']}
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
        <div className={styles['metrics-empty']}>
          <Box size={18} strokeWidth={1.5} className={styles['empty-icon']} />
          <span>No metrics available</span>
        </div>
      )}
    </div>
  );
}
