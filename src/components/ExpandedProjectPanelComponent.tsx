"use client";

import { useState, useRef, useEffect } from "react";
import {
  BarChart3,
  Box,
  Cpu,
  GitFork,
  Globe,
  Lock,
  MemoryStick,
  Network,
  Server,
  TrendingUp,
} from "lucide-react";
import {
  AddressBadgeComponent,
  BadgeComponent,
  DateTimeBadgeComponent,
  DeviceBadgeComponent,
  DomainBadgeComponent,
  LoadingIndicatorComponent,
  PortBadgeComponent,
  RepositoryBadgeComponent,
  ResponseTimeBadgeComponent,
  StatusBadgeComponent,
  VisibilityBadgeComponent,
} from "@rodrigo-barraza/components-library";
import {
  formatBytes,
  formatDuration,
  formatElapsedTime,
  formatNumber,
  formatPercent,
} from "@rodrigo-barraza/utilities-library";
import {
  SERVICE_TYPE_COLORS,
  DEPLOY_TIER_COLORS,
  SERVICE_TYPE_ICONS,
  DEFAULT_SERVICE_TYPE_ICON,
} from "../constants";
import ApiService from "../services/ApiService";
import styles from "./ExpandedProjectPanelComponent.module.css";
import type { PortalService, ContainerStats, GAOverview, GAPageRow } from "../types/portal";

const MAX_SPARKLINE_POINTS = 60;
function severityColor(pct: number, thresholds = [40, 80]) {
  if (pct > thresholds[1]) return "var(--color-danger)";
  if (pct > thresholds[0]) return "var(--color-warning)";
  return "var(--color-success)";
}

const formatGADuration = (seconds: number) => {
  if (!seconds || seconds <= 0) return "0s";
  return formatElapsedTime(seconds);
};

function formatGAPercent(value: number | null | undefined) {
  if (value == null) return "0%";
  return `${(value * 100).toFixed(1)}%`;
}

// ── Sparkline (Canvas) ────────────────────────────────────────────

function Sparkline({
  data,
  color,
  fillColor,
  max,
  height = 28,
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
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    context.scale(dpr, dpr);
    context.clearRect(0, 0, w, h);

    const effectiveMax = max || Math.max(...data, 0.01);
    const padding = 1;
    const drawH = h - padding * 2;
    const step = w / (MAX_SPARKLINE_POINTS - 1);
    const startX = w - (data.length - 1) * step;

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
      context.lineTo(lastX, h);
      context.lineTo(startX, h);
      context.closePath();
      const grad = context.createLinearGradient(0, 0, 0, h);
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

// ── Percentage Bar ────────────────────────────────────────────────

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

// ── Tab definitions ───────────────────────────────────────────────

const TABS = [
  { id: "project", label: "Project", icon: GitFork },
  { id: "container", label: "Container", icon: Box },
  { id: "topology", label: "Topology", icon: Network },
  { id: "web-analytics", label: "Web Analytics", icon: TrendingUp },
];

// ── Tab: Project ──────────────────────────────────────────────────

function ProjectTab({ service }: { service: PortalService }) {
  return (
    <div className={styles.projectTab}>
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Identity</h4>
        <div className={`${styles.fieldGrid} ${styles.fieldGridSingle}`}>
          {service.projectType &&
            (() => {
              const colors = SERVICE_TYPE_COLORS[service.projectType as string];
              return (
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Type</span>
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
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Tier</span>
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
          {service.repo && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Repository</span>
              <RepositoryBadgeComponent
                repo={service.repo}
                icons={{ Github: GitFork }}
              />
            </div>
          )}
          {service.domain && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Domain</span>
              <DomainBadgeComponent domain={service.domain} icons={{ Globe }} />
            </div>
          )}
        </div>
      </div>

      {(service.metadata || service.checkedAt) && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Metadata</h4>
          <div className={styles.fieldGrid}>
            {service.metadata?.version && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Version</span>
                <span className={`${styles.fieldValue} ${styles.mono}`}>
                  {service.metadata.version}
                </span>
              </div>
            )}
            {service.isInfrastructure && service.metadata?.uptime != null && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Uptime</span>
                <span className={styles.fieldValue}>
                  {formatElapsedTime(service.metadata.uptime)}
                </span>
              </div>
            )}
            {service.isInfrastructure &&
              service.metadata?.connections != null && (
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Connections</span>
                  <span className={styles.fieldValue}>
                    {service.metadata.connections}
                  </span>
                </div>
              )}
            {service.isInfrastructure &&
              service.metadata?.databases != null && (
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Databases</span>
                  <span className={styles.fieldValue}>
                    {service.metadata.databases}
                  </span>
                </div>
              )}
            {service.isInfrastructure && service.metadata?.buckets != null && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Buckets</span>
                <span className={styles.fieldValue}>
                  {service.metadata.buckets}
                </span>
              </div>
            )}
            {service.isInfrastructure &&
              (service.metadata?.bucketNames?.length ?? 0) > 0 && (
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Bucket Names</span>
                  <span className={`${styles.fieldValue} ${styles.mono}`}>
                    {service.metadata!.bucketNames!.join(", ")}
                  </span>
                </div>
              )}
            {service.checkedAt && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Last Checked</span>
                <DateTimeBadgeComponent date={service.checkedAt} highlightNew />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Container ────────────────────────────────────────────────

function ContainerTab({ service, stats }: { service: PortalService; stats?: ContainerStats & { spark?: { cpu?: number[]; mem?: number[] } } }) {
  return (
    <div className={styles.containerTab}>
      {/* ── Left: Container info ── */}
      <div className={styles.containerInfo}>
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Status &amp; Environment</h4>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Status</span>
              <StatusBadgeComponent healthy={service.healthy} />
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Environment</span>
              <BadgeComponent
                variant={
                  service.environment === "Production" ? "success" : "info"
                }
              >
                {service.environment || "Unknown"}
              </BadgeComponent>
            </div>
            {service.visibility && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Visibility</span>
                <VisibilityBadgeComponent
                  visibility={service.visibility}
                  icons={{ Globe, Lock }}
                />
              </div>
            )}
            {service.responseTimeMs != null && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Response</span>
                <ResponseTimeBadgeComponent
                  ms={service.responseTimeMs}
                  formatter={formatDuration}
                />
              </div>
            )}
            {service.device && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Device</span>
                <DeviceBadgeComponent
                  device={service.device}
                  icons={{ Server }}
                />
              </div>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Network</h4>
          <div className={styles.fieldGrid}>
            {service.port && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Port</span>
                <PortBadgeComponent port={service.port} />
              </div>
            )}
            {service.url && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Address</span>
                <AddressBadgeComponent address={service.url} link />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: Metrics ── */}
      {stats ? (
        <div className={styles.containerMetrics}>
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
            {(stats.spark?.cpu?.length ?? 0) >= 2 && (
              <Sparkline
                data={stats.spark!.cpu!}
                color={severityColor(stats.cpu.percent)}
                fillColor={
                  stats.cpu.percent > 80
                    ? "rgba(239,68,68,0.12)"
                    : stats.cpu.percent > 40
                      ? "rgba(245,158,11,0.12)"
                      : "rgba(16,185,129,0.12)"
                }
                max={100}
                height={36}
              />
            )}
          </div>

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
            {(stats.spark?.mem?.length ?? 0) >= 2 && (
              <Sparkline
                data={stats.spark!.mem!}
                color={severityColor(stats.memory.percent, [60, 85])}
                fillColor={
                  stats.memory.percent > 85
                    ? "rgba(239,68,68,0.12)"
                    : stats.memory.percent > 60
                      ? "rgba(245,158,11,0.12)"
                      : "rgba(16,185,129,0.12)"
                }
                max={stats.memory.limit}
                height={36}
              />
            )}
          </div>

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
                  <div className={styles.ioStats}>
                    <span className={styles.ioStat}>
                      <span className={styles.ioDir}>RX</span>
                      <span className={styles.ioValue}>
                        {formatBytes(stats.network.rx)}
                      </span>
                    </span>
                    <span className={styles.ioStat}>
                      <span className={styles.ioDir}>TX</span>
                      <span className={styles.ioValue}>
                        {formatBytes(stats.network.tx)}
                      </span>
                    </span>
                  </div>
                </div>
              )}

            {stats.blockIO &&
              (stats.blockIO.read > 0 || stats.blockIO.write > 0) && (
                <div className={styles.metricCard}>
                  <div className={styles.metricCardHeader}>
                    <Server
                      size={13}
                      strokeWidth={2.2}
                      className={styles.metricCardIcon}
                    />
                    <span className={styles.metricCardTitle}>Block I/O</span>
                  </div>
                  <div className={styles.ioStats}>
                    <span className={styles.ioStat}>
                      <span className={styles.ioDir}>Read</span>
                      <span className={styles.ioValue}>
                        {formatBytes(stats.blockIO.read)}
                      </span>
                    </span>
                    <span className={styles.ioStat}>
                      <span className={styles.ioDir}>Write</span>
                      <span className={styles.ioValue}>
                        {formatBytes(stats.blockIO.write)}
                      </span>
                    </span>
                  </div>
                </div>
              )}

            {(stats.pids ?? 0) > 0 && (
              <div className={styles.metricCard}>
                <div className={styles.metricCardHeader}>
                  <span className={styles.metricCardTitle}>PIDs</span>
                  <span className={styles.metricCardDim}>{stats.pids}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.containerMetricsEmpty}>
          <BarChart3
            size={18}
            strokeWidth={1.5}
            className={styles.emptyTabIcon}
          />
          <span>No metrics</span>
        </div>
      )}
    </div>
  );
}

// ── Mini topology constants ───────────────────────────────────────
const MINI_NODE_W = 110;
const MINI_NODE_H = 52;
const TIER_LABELS = [
  "Tier 0 — Foundation",
  "Tier 1 — Services & Clients",
  "Tier 2 — Bots",
];

function getIcon(svc: PortalService) {
  return (svc.projectType && SERVICE_TYPE_ICONS[svc.projectType as string]) || DEFAULT_SERVICE_TYPE_ICON;
}

type MiniPortSide = "top" | "bottom" | "left" | "right";

interface MiniPortResult {
  x1: number;
  y1: number;
  side1: MiniPortSide;
  x2: number;
  y2: number;
  side2: MiniPortSide;
}

function getMiniPortPoint(pos: { x: number; y: number }, side: MiniPortSide) {
  switch (side) {
    case "top":
      return { x: pos.x + MINI_NODE_W / 2, y: pos.y };
    case "bottom":
      return { x: pos.x + MINI_NODE_W / 2, y: pos.y + MINI_NODE_H };
    case "left":
      return { x: pos.x, y: pos.y + MINI_NODE_H / 2 };
    case "right":
      return { x: pos.x + MINI_NODE_W, y: pos.y + MINI_NODE_H / 2 };
  }
}

function computeMiniEdgeAnchors(
  sp: { x: number; y: number },
  tp: { x: number; y: number },
): MiniPortResult {
  // Center-to-center delta
  const cx1 = sp.x + MINI_NODE_W / 2,
    cy1 = sp.y + MINI_NODE_H / 2;
  const cx2 = tp.x + MINI_NODE_W / 2,
    cy2 = tp.y + MINI_NODE_H / 2;
  const dx = cx2 - cx1;
  const dy = cy2 - cy1;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let side1: MiniPortSide, side2: MiniPortSide;

  // When the vertical gap between nodes is minimal (they're roughly side-by-side),
  // prefer horizontal ports to avoid edges crossing through node bodies
  const verticalOverlap = !(sp.y + MINI_NODE_H < tp.y || tp.y + MINI_NODE_H < sp.y);
  const horizontalOverlap = !(sp.x + MINI_NODE_W < tp.x || tp.x + MINI_NODE_W < sp.x);

  if (verticalOverlap && !horizontalOverlap) {
    // Nodes are side-by-side vertically — use left/right ports
    side1 = dx > 0 ? "right" : "left";
    side2 = dx > 0 ? "left" : "right";
  } else if (horizontalOverlap && !verticalOverlap) {
    // Nodes are stacked vertically — use top/bottom ports
    side1 = dy > 0 ? "bottom" : "top";
    side2 = dy > 0 ? "top" : "bottom";
  } else if (absDy >= absDx) {
    // Predominantly vertical relationship
    side1 = dy > 0 ? "bottom" : "top";
    side2 = dy > 0 ? "top" : "bottom";
  } else {
    // Predominantly horizontal relationship
    side1 = dx > 0 ? "right" : "left";
    side2 = dx > 0 ? "left" : "right";
  }

  const p1 = getMiniPortPoint(sp, side1);
  const p2 = getMiniPortPoint(tp, side2);

  return { x1: p1.x, y1: p1.y, side1, x2: p2.x, y2: p2.y, side2 };
}

// Control point offset — extends outward from the port face
function miniCtrlOffset(side: MiniPortSide, dist: number): { dx: number; dy: number } {
  const magnitude = Math.max(dist * 0.4, 40);
  switch (side) {
    case "top":
      return { dx: 0, dy: -magnitude };
    case "bottom":
      return { dx: 0, dy: magnitude };
    case "left":
      return { dx: -magnitude, dy: 0 };
    case "right":
      return { dx: magnitude, dy: 0 };
  }
}

function miniEdgePath(anchor: MiniPortResult): string {
  const { x1, y1, side1, x2, y2, side2 } = anchor;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const c1 = miniCtrlOffset(side1, dist);
  const c2 = miniCtrlOffset(side2, dist);
  return `M ${x1} ${y1} C ${x1 + c1.dx} ${y1 + c1.dy}, ${x2 + c2.dx} ${y2 + c2.dy}, ${x2} ${y2}`;
}

function TopologyTab({ service, allServices }: { service: PortalService; allServices: PortalService[] }) {
  const deps = service.dependsOn || [];

  if (deps.length === 0 && allServices.length === 0) {
    return (
      <div className={styles.emptyTab}>
        <Network size={24} strokeWidth={1.5} className={styles.emptyTabIcon} />
        <span>No dependencies declared</span>
      </div>
    );
  }

  // Build full edge list from all services
  const allEdges = [];
  const idSet = new Set(allServices.map((s) => s.id));
  for (const svc of allServices) {
    for (const dep of svc.dependsOn || []) {
      const depId = typeof dep === "string" ? dep : dep.id;
      const criticality =
        typeof dep === "string" ? "required" : dep.criticality || "required";
      if (idSet.has(depId))
        allEdges.push({ source: depId, target: svc.id, criticality });
    }
  }

  // Walk upstream (full chain) + downstream (one level)
  const upstream = new Map();
  const downstream = new Map();
  for (const e of allEdges) {
    if (!upstream.has(e.target)) upstream.set(e.target, []);
    upstream.get(e.target).push(e.source);
    if (!downstream.has(e.source)) downstream.set(e.source, []);
    downstream.get(e.source).push(e.target);
  }

  const connected = new Set([service.id]);
  const queue = [service.id];
  while (queue.length > 0) {
    const id = queue.shift();
    for (const dep of upstream.get(id) || []) {
      if (!connected.has(dep)) {
        connected.add(dep);
        queue.push(dep);
      }
    }
  }
  for (const child of downstream.get(service.id) || []) connected.add(child);

  // Filter services and edges to connected subgraph
  const graphServices = allServices.filter((s) => connected.has(s.id));
  const graphEdges = allEdges.filter(
    (e) => connected.has(e.source) && connected.has(e.target),
  );

  if (graphServices.length <= 1) {
    return (
      <div className={styles.emptyTab}>
        <Network size={24} strokeWidth={1.5} className={styles.emptyTabIcon} />
        <span>No connections found</span>
      </div>
    );
  }

  // Layout by deployTier
  const tiers: PortalService[][] = [[], [], []];
  for (const svc of graphServices) {
    const tier = Math.min(Math.max(svc.deployTier as number ?? 2, 0), 2);
    tiers[tier].push(svc);
  }
  for (const tier of tiers)
    tier.sort((a: PortalService, b: PortalService) => a.name.localeCompare(b.name));

  const GAP_X = 20;
  const GAP_Y = 72;
  const LABEL_W = 120;
  const positions: Record<string, { x: number; y: number }> = {};
  const layerWidths = tiers.map(
    (l) => l.length * (MINI_NODE_W + GAP_X) - GAP_X,
  );
  const maxW = Math.max(...layerWidths, 0);

  let usedTierCount = 0;
  tiers.forEach((layer, _li) => {
    if (!layer.length) return;
    const totalW = layer.length * (MINI_NODE_W + GAP_X) - GAP_X;
    const offsetX = LABEL_W + (maxW - totalW) / 2;
    layer.forEach((svc, si) => {
      positions[svc.id] = {
        x: offsetX + si * (MINI_NODE_W + GAP_X),
        y: usedTierCount * (MINI_NODE_H + GAP_Y),
      };
    });
    usedTierCount++;
  });

  const svgW = LABEL_W + maxW + 20;
  const svgH = usedTierCount * (MINI_NODE_H + GAP_Y) - GAP_Y + 10;

  // Map tier index to rendered row for label positioning
  let tierRow = 0;
  const tierYPositions = tiers.map((layer) => {
    if (!layer.length) return null;
    const y = tierRow * (MINI_NODE_H + GAP_Y) + MINI_NODE_H / 2;
    tierRow++;
    return y;
  });

  return (
    <div className={styles.miniTopology}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className={styles.miniTopologySvg}>
        <defs>
          <linearGradient
            id="mini-prism-gradient"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="300"
            y2="300"
          >
            <stop offset="0%" stopColor="#ff0000" />
            <stop offset="16%" stopColor="#ff8800" />
            <stop offset="33%" stopColor="#ffff00" />
            <stop offset="50%" stopColor="#00ff88" />
            <stop offset="66%" stopColor="#0088ff" />
            <stop offset="83%" stopColor="#8800ff" />
            <stop offset="100%" stopColor="#ff0088" />
            <animateTransform
              attributeName="gradientTransform"
              type="rotate"
              from="0 150 150"
              to="360 150 150"
              dur="2s"
              repeatCount="indefinite"
            />
          </linearGradient>
        </defs>

        {/* Edges */}
        {graphEdges.map((edge, i) => {
          const sp = positions[edge.source];
          const tp = positions[edge.target];
          if (!sp || !tp) return null;
          const anchor = computeMiniEdgeAnchors(sp, tp);
          const isOpt = edge.criticality === "optional";
          const isSelfEdge =
            edge.source === service.id || edge.target === service.id;
          const d = miniEdgePath(anchor);
          return (
            <g
              key={`${edge.source}-${edge.target}-${i}`}
              className={isSelfEdge ? styles.miniEdgeFlowing : ""}
            >
              <path
                d={d}
                stroke={
                  isSelfEdge
                    ? "url(#mini-prism-gradient)"
                    : "var(--border-color)"
                }
                strokeWidth={isSelfEdge ? 2 : 1.2}
                fill="none"
                strokeOpacity={isSelfEdge ? 0.9 : isOpt ? 0.25 : 0.4}
                strokeDasharray={isOpt && !isSelfEdge ? "4 3" : "none"}
                className={styles.miniEdgeLine}
              />
            </g>
          );
        })}

        {/* Tier labels */}
        {tiers.map((layer, li) => {
          if (!layer.length || tierYPositions[li] == null) return null;
          return (
            <text
              key={`tier-${li}`}
              x={0}
              y={tierYPositions[li]}
              className={styles.miniTierLabel}
              dominantBaseline="middle"
            >
              {TIER_LABELS[li] || `Tier ${li}`}
            </text>
          );
        })}

        {/* Nodes */}
        {graphServices.map((svc: PortalService) => {
          const pos = positions[svc.id];
          if (!pos) return null;
          const Icon = getIcon(svc);
          const isSelf = svc.id === service.id;
          const typeClass = svc.isInfrastructure
            ? styles.miniNodeInfra
            : svc.visibility === "external"
              ? styles.miniNodeExternal
              : styles.miniNodeInternal;
          return (
            <foreignObject
              key={svc.id}
              x={pos.x}
              y={pos.y}
              width={MINI_NODE_W}
              height={MINI_NODE_H}
              style={{ overflow: "visible" }}
            >
              <div
                className={`${styles.miniNodeCard} ${typeClass} ${isSelf ? styles.miniNodeSelf : ""}`}
              >
                <div
                  className={`${styles.miniStatusDot} ${svc.healthy ? styles.miniStatusHealthy : styles.miniStatusDown}`}
                />
                <div className={styles.miniNodeIconWrap}>
                  <Icon size={14} strokeWidth={1.5} />
                </div>
                <span className={styles.miniNodeName}>{svc.name}</span>
              </div>
            </foreignObject>
          );
        })}
      </svg>
    </div>
  );
}

// ── Tab: Web Analytics ────────────────────────────────────────────

function WebAnalyticsTab({ service }: { service: PortalService }) {
  const propertyId = service.analyticsPropertyId;
  const [overview, setOverview] = useState<GAOverview | null>(null);
  const [pages, setPages] = useState<{ pages: GAPageRow[] } | null>(null);
  const [realtime, setRealtime] = useState<{ activeUsers: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const didFetch = useRef(false);

  useEffect(() => {
    if (!propertyId || didFetch.current) return;
    didFetch.current = true;

    (async () => {
      try {
        const [ov, pg, rt] = await Promise.all([
          ApiService.getGAOverview(propertyId, "30d").catch(() => null),
          ApiService.getGAPages(propertyId, "30d").catch(() => null),
          ApiService.getGARealtime(propertyId).catch(() => null),
        ]);
        setOverview(ov);
        setPages(pg);
        setRealtime(rt);
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    })();
  }, [propertyId]);

  if (!propertyId) {
    return (
      <div className={styles.emptyTab}>
        <TrendingUp
          size={24}
          strokeWidth={1.5}
          className={styles.emptyTabIcon}
        />
        <span>No analytics property configured</span>
        <span className={styles.emptyTabHint}>
          Add <code>analyticsPropertyId</code> to this project in projects.json
        </span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.emptyTab}>
        <LoadingIndicatorComponent size="small" label="Loading analytics…" />
      </div>
    );
  }

  return (
    <div className={styles.webAnalyticsTab}>
      {/* Realtime */}
      {realtime && (
        <div className={styles.realtimePill}>
          <div className={styles.realtimeDot} />
          <span className={styles.realtimeValue}>
            {formatNumber(realtime.activeUsers)}
          </span>
          <span className={styles.realtimeLabel}>active now</span>
        </div>
      )}

      {/* Overview cards */}
      {overview && (
        <div className={styles.gaCards}>
          <div className={styles.gaCard}>
            <span className={styles.gaCardValue}>
              {formatNumber(overview.totalUsers)}
            </span>
            <span className={styles.gaCardLabel}>Users</span>
          </div>
          <div className={styles.gaCard}>
            <span className={styles.gaCardValue}>
              {formatNumber(overview.pageviews)}
            </span>
            <span className={styles.gaCardLabel}>Pageviews</span>
          </div>
          <div className={styles.gaCard}>
            <span className={styles.gaCardValue}>
              {formatNumber(overview.sessions)}
            </span>
            <span className={styles.gaCardLabel}>Sessions</span>
          </div>
          <div className={styles.gaCard}>
            <span className={styles.gaCardValue}>
              {formatGADuration(overview.avgSessionDuration)}
            </span>
            <span className={styles.gaCardLabel}>Avg Duration</span>
          </div>
          <div className={styles.gaCard}>
            <span className={styles.gaCardValue}>
              {formatGAPercent(overview.engagementRate)}
            </span>
            <span className={styles.gaCardLabel}>Engagement</span>
          </div>
        </div>
      )}

      {/* Top Pages */}
      {(pages?.pages?.length ?? 0) > 0 && (
        <div className={styles.gaSection}>
          <h4 className={styles.sectionTitle}>Top Pages (30d)</h4>
          <div className={styles.gaPageList}>
            {pages!.pages.slice(0, 5).map((p: GAPageRow, i: number) => (
              <div key={i} className={styles.gaPageRow}>
                <span className={`${styles.gaPagePath} ${styles.mono}`}>
                  {p.pagePath}
                </span>
                <span className={styles.gaPageViews}>
                  {formatNumber(p.pageviews)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Expanded Panel ───────────────────────────────────────────

export default function ExpandedProjectPanel({
  service,
  stats,
  allServices = [],
}: {
  service: PortalService;
  stats?: ContainerStats & { spark?: { cpu?: number[]; mem?: number[] } };
  allServices?: PortalService[];
}) {
  const [activeTab, setActiveTab] = useState("project");

  // Filter tabs: only show web-analytics if property exists
  const visibleTabs = TABS.filter((tab) => {
    if (tab.id === "web-analytics" && !service.analyticsPropertyId)
      return false;
    return true;
  });

  return (
    <div className={styles.panel}>
      {/* ── Tab Bar ── */}
      <div className={styles.tabBar}>
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={12} strokeWidth={2.2} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className={styles.tabContent}>
        {activeTab === "project" && <ProjectTab service={service} />}
        {activeTab === "container" && (
          <ContainerTab service={service} stats={stats} />
        )}
        {activeTab === "topology" && (
          <TopologyTab service={service} allServices={allServices} />
        )}
        {activeTab === "web-analytics" && <WebAnalyticsTab service={service} />}
      </div>

      {/* ── Error Bar ── */}
      {service.error && !service.healthy && (
        <div className={styles.errorBar}>{service.error}</div>
      )}
    </div>
  );
}
