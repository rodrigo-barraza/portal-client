"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Cpu,
  GitFork,
  Globe,
  Lock,
  MemoryStick,
  Package,
  Play,
  RotateCcw,
  ScrollText,
  Server,
  Square,
  Undo2,
} from "lucide-react";
import { BadgeComponent, ButtonComponent } from "@rodrigo-barraza/components-library";
import {
  formatBytes,
  formatDuration,
  formatElapsedTime,
  formatPercent,
  ACTION_COOLDOWN_MS,
  ACTION_COOLDOWN_LONG_MS,
} from "@rodrigo-barraza/utilities-library";
import {
  SERVICE_TYPE_ICONS,
  SERVICE_TYPE_COLORS,
  DEPLOY_TIER_COLORS,
  DEFAULT_SERVICE_TYPE_ICON,
} from "../constants";
import ApiService from "../services/ApiService";
import styles from "./ServiceCardComponent.module.css";
import type { PortalService, ContainerStats } from "../types/portal";

const MAX_SPARKLINE_POINTS = 60;

/** Severity color from percentage. */
function severityColor(pct: number, thresholds = [40, 80]) {
  if (pct > thresholds[1]) return "var(--color-danger)";
  if (pct > thresholds[0]) return "var(--color-warning)";
  return "var(--color-success)";
}

// ── Inline Sparkline Canvas ────────────────────────────────────────
function Sparkline({
  data,
  color,
  fillColor,
  max,
  height = 20,
}: {
  data: number[];
  color: string;
  fillColor?: string;
  max?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length < 2) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    context.scale(dpr, dpr);
    context.clearRect(0, 0, canvasWidth, canvasHeight);

    const effectiveMax = max || Math.max(...data, 0.01);
    const padding = 1;
    const drawH = canvasHeight - padding * 2;
    const step = canvasWidth / (MAX_SPARKLINE_POINTS - 1);
    const startX = canvasWidth - (data.length - 1) * step;

    context.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = startX + i * step;
      const y = padding + drawH - (data[i] / effectiveMax) * drawH;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }

    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.stroke();

    if (fillColor) {
      const lastX = startX + (data.length - 1) * step;
      context.lineTo(lastX, canvasHeight);
      context.lineTo(startX, canvasHeight);
      context.closePath();
      const grad = context.createLinearGradient(0, 0, 0, canvasHeight);
      grad.addColorStop(0, fillColor);
      grad.addColorStop(1, "transparent");
      context.fillStyle = grad;
      context.fill();
    }
  }, [data, color, fillColor, max, height]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.sparkline}
      style={{ height: `${height}px` }}
    />
  );
}

// ── Percentage Bar ──────────────────────────────────────────────
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

const NON_DEPLOYED_TYPES = new Set(["Library", "Kit", "Tool"]);

export default function ServiceCardComponent({
  service,
  containerStats,
  onRestart,
  onStop,
  onStart,
  onRollback,
}: {
  service: PortalService;
  containerStats?: ContainerStats & {
    spark?: { cpu?: number[]; mem?: number[] };
  };
  onRestart?: (id: string) => Promise<void>;
  onStop?: (id: string) => Promise<void>;
  onStart?: (id: string) => Promise<void>;
  onRollback?: (id: string) => Promise<void>;
}) {
  const [restarting, setRestarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [starting, setStarting] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackAvailable, setRollbackAvailable] = useState(false);
  const isNonDeployed = NON_DEPLOYED_TYPES.has(service.projectType as string);
  const isHealthy = isNonDeployed ? true : service.healthy;
  const statusClass = isNonDeployed
    ? styles['non-deployed']
    : isHealthy
      ? styles.healthy
      : styles.unhealthy;
  const isProduction = service.environment === "Production";
  const isInfra = service.isInfrastructure;

  const TypeIcon =
    (service.projectType &&
      SERVICE_TYPE_ICONS[service.projectType as string]) ||
    DEFAULT_SERVICE_TYPE_ICON;

  // Lazily check rollback availability for restartable services
  useEffect(() => {
    if (!service.restartable) return;
    ApiService.getRollbackStatus(service.id)
      .then((res) => setRollbackAvailable(res.available === true))
      .catch(() => setRollbackAvailable(false));
  }, [service.id, service.restartable]);

  return (
    <div className={`${styles.card} ${statusClass}`}>
      <div className={styles['card-header']}>
        <div className={styles['name-row']}>
          <TypeIcon
            size={16}
            strokeWidth={2.6}
            className={`${styles['infra-icon']} ${statusClass}`}
          />
          <span className={styles.name}>{service.name}</span>
        </div>
      </div>

      <div className={styles.details}>
        {/* ── Action Buttons (containerized services only) ── */}
        {service.restartable && (
          <div className={styles['action-row']}>
            {isHealthy ? (
              <ButtonComponent
                variant="outlined"
                size="small"
                icon={Square}
                loading={stopping}
                disabled={stopping || restarting || rollingBack}
                onClick={async () => {
                  setStopping(true);
                  try {
                    await onStop?.(service.id);
                  } finally {
                    setTimeout(() => setStopping(false), ACTION_COOLDOWN_MS);
                  }
                }}
                className={`${styles['action-button']} ${styles['stop-button']}`}
              >
                {stopping ? "Stopping…" : "Stop"}
              </ButtonComponent>
            ) : (
              <ButtonComponent
                variant="outlined"
                size="small"
                icon={Play}
                loading={starting}
                disabled={starting || restarting || rollingBack}
                onClick={async () => {
                  setStarting(true);
                  try {
                    await onStart?.(service.id);
                  } finally {
                    setTimeout(() => setStarting(false), ACTION_COOLDOWN_MS);
                  }
                }}
                className={`${styles['action-button']} ${styles['start-button']}`}
              >
                {starting ? "Starting…" : "Start"}
              </ButtonComponent>
            )}

            <Link
              href={`/logs?container=${service.dockerProject || service.id}`}
              className={`${styles['action-button']} ${styles['logs-button']}`}
            >
              <ScrollText size={10} strokeWidth={2.6} />
              Logs
            </Link>

            {rollbackAvailable && (
              <ButtonComponent
                variant="outlined"
                size="small"
                icon={Undo2}
                loading={rollingBack}
                disabled={rollingBack || restarting || stopping || starting}
                onClick={async () => {
                  setRollingBack(true);
                  try {
                    await onRollback?.(service.id);
                  } finally {
                    setTimeout(
                      () => setRollingBack(false),
                      ACTION_COOLDOWN_LONG_MS,
                    );
                  }
                }}
                className={`${styles['action-button']} ${styles['rollback-button']}`}
              >
                {rollingBack ? "Rolling back…" : "Rollback"}
              </ButtonComponent>
            )}

            <ButtonComponent
              variant="outlined"
              size="small"
              icon={RotateCcw}
              loading={restarting}
              disabled={restarting || stopping || starting || rollingBack}
              onClick={async () => {
                setRestarting(true);
                try {
                  await onRestart?.(service.id);
                } finally {
                  setTimeout(() => setRestarting(false), ACTION_COOLDOWN_MS);
                }
              }}
              className={`${styles['action-button']} ${styles['restart-button']}`}
            >
              {restarting ? "Restarting…" : "Restart"}
            </ButtonComponent>
          </div>
        )}

        {/* ── Status ── */}
        <div className={styles.detail}>
          <span className={styles['detail-label']}>Status</span>
          {isNonDeployed ? (
            <BadgeComponent variant="info">Not Deployed</BadgeComponent>
          ) : (
            <BadgeComponent type="status" healthy={isHealthy} />
          )}
        </div>

        {/* ── NPM Package (libraries only) ── */}
        {service.npmPackage && (
          <div className={styles.detail}>
            <span className={styles['detail-label']}>Package</span>
            <BadgeComponent variant="info">
              <Package size={11} strokeWidth={2.2} style={{ marginRight: 4 }} />
              {service.npmPackage}
            </BadgeComponent>
          </div>
        )}

        {/* ── Container Resource Metrics (inline sparklines) ── */}
        {containerStats && (
          <div className={styles['metrics-section']}>
            {/* CPU */}
            <div className={styles['metric-block']}>
              <div className={styles['metric-header']}>
                <Cpu
                  size={11}
                  strokeWidth={2.2}
                  className={styles['metric-icon']}
                />
                <span className={styles['metric-label']}>CPU</span>
                <span className={styles['metric-values']}>
                  <span
                    style={{ color: severityColor(containerStats.cpu.percent) }}
                  >
                    {formatPercent(containerStats.cpu.percent, "adaptive")}
                  </span>
                  <span className={styles['metric-dim']}>
                    · {containerStats.cpu.cores} core
                    {containerStats.cpu.cores !== 1 ? "s" : ""}
                  </span>
                </span>
              </div>
              <PercentBar
                percent={containerStats.cpu.percent}
                color={severityColor(containerStats.cpu.percent)}
              />
              {(containerStats.spark?.cpu?.length ?? 0) >= 2 && (
                <Sparkline
                  data={containerStats.spark!.cpu!}
                  color={severityColor(containerStats.cpu.percent)}
                  fillColor={
                    containerStats.cpu.percent > 80
                      ? "rgba(239,68,68,0.12)"
                      : containerStats.cpu.percent > 40
                        ? "rgba(245,158,11,0.12)"
                        : "rgba(16,185,129,0.12)"
                  }
                  max={100}
                />
              )}
            </div>

            {/* Memory */}
            <div className={styles['metric-block']}>
              <div className={styles['metric-header']}>
                <MemoryStick
                  size={11}
                  strokeWidth={2.2}
                  className={styles['metric-icon']}
                />
                <span className={styles['metric-label']}>RAM</span>
                <span className={styles['metric-values']}>
                  <span
                    style={{
                      color: severityColor(
                        containerStats.memory.percent,
                        [60, 85],
                      ),
                    }}
                  >
                    {formatBytes(containerStats.memory.used)}
                  </span>
                  <span className={styles['metric-dim']}>
                    / {formatBytes(containerStats.memory.limit)}
                  </span>
                  <span
                    style={{
                      color: severityColor(
                        containerStats.memory.percent,
                        [60, 85],
                      ),
                    }}
                  >
                    {formatPercent(containerStats.memory.percent, "adaptive")}
                  </span>
                </span>
              </div>
              <PercentBar
                percent={containerStats.memory.percent}
                color={severityColor(containerStats.memory.percent, [60, 85])}
              />
              {(containerStats.spark?.mem?.length ?? 0) >= 2 && (
                <Sparkline
                  data={containerStats.spark!.mem!}
                  color={severityColor(containerStats.memory.percent, [60, 85])}
                  fillColor={
                    containerStats.memory.percent > 85
                      ? "rgba(239,68,68,0.12)"
                      : containerStats.memory.percent > 60
                        ? "rgba(245,158,11,0.12)"
                        : "rgba(16,185,129,0.12)"
                  }
                  max={containerStats.memory.limit}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Stage / Visibility ── */}
        <div className={styles.detail}>
          <span className={styles['detail-label']}>Environment</span>
          <BadgeComponent variant={isProduction ? "success" : "info"}>
            {service.environment || "Unknown"}
          </BadgeComponent>
        </div>

        {service.projectType &&
          (() => {
            const colors = SERVICE_TYPE_COLORS[service.projectType as string];
            return (
              <div className={styles.detail}>
                <span className={styles['detail-label']}>Type</span>
                <BadgeComponent
                  variant="info"
                  style={
                    colors
                      ? {
                          color: colors.color,
                          background: colors.subtle,
                          borderColor: `color-mix(in srgb, ${colors.color} 25%, transparent)`,
                        }
                      : undefined
                  }
                >
                  {service.projectType}
                </BadgeComponent>
              </div>
            );
          })()}

        {service.deployTier != null &&
          (() => {
            const colors = DEPLOY_TIER_COLORS[service.deployTier as number];
            return (
              <div className={styles.detail}>
                <span className={styles['detail-label']}>Tier</span>
                <BadgeComponent
                  variant="info"
                  style={
                    colors
                      ? {
                          color: colors.color,
                          background: colors.subtle,
                          borderColor: `color-mix(in srgb, ${colors.color} 25%, transparent)`,
                        }
                      : undefined
                  }
                >
                  {`Tier ${service.deployTier}`}
                </BadgeComponent>
              </div>
            );
          })()}

        {service.visibility && (
          <div className={styles.detail}>
            <span className={styles['detail-label']}>Visibility</span>
            <BadgeComponent
              type="visibility"
              visibility={service.visibility}
              icons={{ Globe, Lock }}
            />
          </div>
        )}

        {service.responseTimeMs != null && (
          <div className={styles.detail}>
            <span className={styles['detail-label']}>Response</span>
            <BadgeComponent
              type="responseTime"
              ms={service.responseTimeMs}
              formatter={formatDuration}
            />
          </div>
        )}

        {service.device && (
          <div className={styles.detail}>
            <span className={styles['detail-label']}>Device</span>
            <BadgeComponent
              type="device"
              device={service.device}
              icons={{ Server }}
            />
          </div>
        )}

        {/* ── Infrastructure-specific metadata ── */}
        {isInfra && service.metadata && (
          <>
            {service.metadata.version && (
              <div className={styles.detail}>
                <span className={styles['detail-label']}>Version</span>
                <span className={`${styles['detail-value']} ${styles.mono}`}>
                  {service.metadata.version}
                </span>
              </div>
            )}
            {service.metadata.uptime != null && (
              <div className={styles.detail}>
                <span className={styles['detail-label']}>Uptime</span>
                <span className={styles['detail-value']}>
                  {formatElapsedTime(service.metadata.uptime)}
                </span>
              </div>
            )}
            {service.metadata.connections != null && (
              <div className={styles.detail}>
                <span className={styles['detail-label']}>Connections</span>
                <span className={styles['detail-value']}>
                  {service.metadata.connections}
                </span>
              </div>
            )}
            {service.metadata.databases != null && (
              <div className={styles.detail}>
                <span className={styles['detail-label']}>Databases</span>
                <span className={styles['detail-value']}>
                  {service.metadata.databases}
                </span>
              </div>
            )}
            {service.metadata.buckets != null && (
              <div className={styles.detail}>
                <span className={styles['detail-label']}>Buckets</span>
                <span className={styles['detail-value']}>
                  {service.metadata.buckets}
                </span>
              </div>
            )}
            {service.metadata.bucketNames &&
              service.metadata.bucketNames.length > 0 && (
                <div className={styles.detail}>
                  <span className={styles['detail-label']}>Bucket Names</span>
                  <span className={`${styles['detail-value']} ${styles.mono}`}>
                    {service.metadata.bucketNames.join(", ")}
                  </span>
                </div>
              )}
          </>
        )}

        {/* ── Standard service metadata ── */}
        {!isInfra && service.metadata?.version && (
          <div className={styles.detail}>
            <span className={styles['detail-label']}>Version</span>
            <span className={styles['detail-value']}>
              {service.metadata.version}
            </span>
          </div>
        )}

        {/* ── Node Version (from health endpoint) ── */}
        {service.metadata?.nodeVersion && (
          <div className={styles.detail}>
            <span className={styles['detail-label']}>Node</span>
            <span className={`${styles['detail-value']} ${styles.mono}`}>
              {service.metadata.nodeVersion}
            </span>
          </div>
        )}

        {/* ── Python Version (from health endpoint, if available) ── */}
        {service.metadata?.pythonVersion && (
          <div className={styles.detail}>
            <span className={styles['detail-label']}>Python</span>
            <span className={`${styles['detail-value']} ${styles.mono}`}>
              {service.metadata.pythonVersion}
            </span>
          </div>
        )}

        {service.port && (
          <div className={styles.detail}>
            <span className={styles['detail-label']}>Port</span>
            <BadgeComponent type="port" port={service.port} />
          </div>
        )}

        {service.url && !isInfra && (
          <div className={styles.detail}>
            <span className={styles['detail-label']}>Address</span>
            <BadgeComponent type="address" address={service.url} link />
          </div>
        )}

        {service.domain && (
          <div className={styles.detail}>
            <span className={styles['detail-label']}>Domain</span>
            <BadgeComponent
              type="domain"
              domain={service.domain}
              icons={{ Globe }}
            />
          </div>
        )}

        {service.repo && (
          <div className={styles.detail}>
            <span className={styles['detail-label']}>Repository</span>
            <BadgeComponent
              type="repository"
              repo={service.repo}
              icons={{ Github: GitFork }}
            />
          </div>
        )}

        {service.checkedAt && (
          <div className={styles.detail}>
            <span className={styles['detail-label']}>Checked</span>
            <BadgeComponent
              type="dateTime"
              date={service.checkedAt}
              highlightNew
            />
          </div>
        )}
      </div>

      {service.error && !isHealthy && (
        <div className={styles['error-bar']}>{service.error}</div>
      )}
    </div>
  );
}
