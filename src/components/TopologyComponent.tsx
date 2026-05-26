"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  X,
  Move,
  Eye,
  EyeOff,
  Layers,
  Grid3X3,
  ArrowDown,
  ArrowUp,
  GitBranch,
  HardDrive,
} from "lucide-react";
import {
  ButtonComponent,
  LoadingIndicatorComponent,
} from "@rodrigo-barraza/components-library";
import {
  SERVICE_TYPE_ICONS,
  DEFAULT_SERVICE_TYPE_ICON,
  DEPLOY_TIER_COLORS,
  SERVICE_TYPE_COLORS,
} from "../constants";
import ApiService from "../services/ApiService";
import type {
  PortalService,
  DependsOnEntry,
  DependencyRef,
  NodePosition,
  TopologyEdge,
  ProjectAnalysis,
  DeployTierColor,
} from "../types/portal";
import styles from "./TopologyComponent.module.css";

// ── Dimensions ───────────────────────────────────────────────────
const NODE_W = 130;
const NODE_H = 64;
const MAX_COLS = 5; // max nodes per row inside a cluster
const CLUSTER_GAP_X = 32; // horizontal gap between nodes inside a cluster
const CLUSTER_GAP_Y = 16; // vertical gap between rows inside a cluster
const CLUSTER_PAD = 24; // padding inside cluster rect
const TIER_SPACING = 60; // vertical gap between tier clusters
const LIBS_GAP = 80; // horizontal gap between libs column and tier column
const LIBS_MAX_COLS = 2; // max columns in the libraries cluster
const TYPE_MAX_COLS = 4; // max columns per type-group cluster
const TYPE_COLS = 2; // number of columns in the type-group grid
const TYPE_GROUP_GAP_X = 80; // horizontal gap between type-group clusters
const TYPE_GROUP_GAP_Y = 60; // vertical gap between type-group rows

// ── View mode ───────────────────────────────────────────────────
type ViewMode = "tier" | "type";

// ── Canonical projectType ordering for the "by type" layout ─────
const TYPE_ORDER = [
  "Service",
  "Client",
  "Bot",
  "Library",
  "Kit",
  "Tool",
  "Database",
  "Store",
];

// ── Non-tiered project types (rendered independently) ────────
const NON_TIERED_TYPES = new Set(["Library", "Kit", "Tool"]);

// ── Size formatter ──────────────────────────────────────────
function formatSize(kb: number): string {
  if (kb >= 1024 * 1024) return `${(kb / (1024 * 1024)).toFixed(1)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}

// ── Edge type taxonomy ──────────────────────────────────────────
type EdgeType = "api" | "import" | "tooling" | "infra";

// Maps projectType (from the registry) → edge relationship type
const PROJECT_TYPE_TO_EDGE: Record<string, EdgeType> = {
  Library: "import",
  Kit: "tooling",
  Tool: "tooling",
  Database: "infra",
  Store: "infra",
};

const EDGE_TYPE_CONFIG: Record<
  EdgeType,
  {
    label: string;
    color: string;
    subtle: string;
    dash: string;
    width: number;
    opacity: number;
    defaultVisible: boolean;
  }
> = {
  api: {
    label: "API Calls",
    color: "#3b82f6",
    subtle: "rgba(59, 130, 246, 0.12)",
    dash: "none",
    width: 1.5,
    opacity: 0.45,
    defaultVisible: true,
  },
  infra: {
    label: "Infrastructure",
    color: "#f97316",
    subtle: "rgba(249, 115, 22, 0.12)",
    dash: "none",
    width: 2,
    opacity: 0.5,
    defaultVisible: true,
  },
  import: {
    label: "Library Imports",
    color: "#06b6d4",
    subtle: "rgba(6, 182, 212, 0.12)",
    dash: "3 5",
    width: 1,
    opacity: 0.25,
    defaultVisible: true,
  },
  tooling: {
    label: "Deploy Tooling",
    color: "#a855f7",
    subtle: "rgba(168, 85, 247, 0.12)",
    dash: "6 4",
    width: 1,
    opacity: 0.15,
    defaultVisible: false,
  },
};

// ── Directional edge colors (when a node is selected) ───────
// Incoming  = direct edges flowing INTO the selected node (its immediate dependencies)
// Outgoing  = direct edges flowing OUT FROM the selected node (its immediate consumers)
// Network   = transitive edges between other connected nodes (not directly touching the selected node)
const EDGE_DIRECTION_CONFIG = {
  incoming: {
    color: "#00e5ff",
    label: "Upstream",
    glow: "rgba(0, 229, 255, 0.3)",
  },
  outgoing: {
    color: "#ff5722",
    label: "Downstream",
    glow: "rgba(255, 87, 34, 0.3)",
  },
  network: {
    color: "#b388ff",
    label: "Network",
    glow: "rgba(179, 136, 255, 0.2)",
  },
};

// ── Icon resolver (by projectType) ──────────────────────────────
function getIcon(svc: Pick<PortalService, "projectType">) {
  return SERVICE_TYPE_ICONS[svc.projectType || ""] || DEFAULT_SERVICE_TYPE_ICON;
}

// ── Tier labels ─────────────────────────────────────────────────
const TIER_LABELS = [
  "Tier 0 — Foundation",
  "Tier 1 — Services & Clients",
  "Tier 2 — Bots",
];
const LIBS_LABEL = "Libraries & Toolkits";

// ── Colors for the libraries cluster ────────────────────────────
const LIBS_CLUSTER_COLOR = {
  stroke: "rgba(6, 182, 212, 0.35)",
  fill: "rgba(6, 182, 212, 0.04)",
};

// ── Group services by projectType ───────────────────────────────
function computeTypeGroups(
  services: PortalService[],
): { type: string; members: PortalService[] }[] {
  const groupMap = new Map<string, PortalService[]>();
  for (const svc of services) {
    const projectType = svc.projectType || "Other";
    if (!groupMap.has(projectType)) groupMap.set(projectType, []);
    groupMap.get(projectType)!.push(svc);
  }
  // Sort each group alphabetically
  for (const members of groupMap.values())
    members.sort((a, b) => a.name.localeCompare(b.name));
  // Return in canonical order, then any extras
  const result: { type: string; members: PortalService[] }[] = [];
  for (const typeName of TYPE_ORDER) {
    if (groupMap.has(typeName)) {
      result.push({ type: typeName, members: groupMap.get(typeName)! });
      groupMap.delete(typeName);
    }
  }
  for (const [typeName, members] of groupMap)
    result.push({ type: typeName, members });
  return result;
}

// ── Layout for type-grouped view (2-column grid of clusters) ────
function layoutTypeNodes(groups: { type: string; members: PortalService[] }[]) {
  const LABEL_H = 28;
  const positions: Record<string, NodePosition> = {};

  // Pre-compute cluster sizes
  const sizes = groups.map((g) => clusterSize(g.members.length, TYPE_MAX_COLS));

  // Arrange into a 2-column grid, tracking max height per row
  const colWidths = [0, 0];
  for (let i = 0; i < groups.length; i++) {
    const col = i % TYPE_COLS;
    colWidths[col] = Math.max(colWidths[col], sizes[i].w);
  }

  let rowY = 0;
  for (let i = 0; i < groups.length; i += TYPE_COLS) {
    let rowMaxH = 0;
    for (let c = 0; c < TYPE_COLS && i + c < groups.length; c++) {
      const gi = i + c;
      const { cols, h } = sizes[gi];
      const colX = c === 0 ? 0 : colWidths[0] + TYPE_GROUP_GAP_X;
      const clusterX = colX + (colWidths[c] - sizes[gi].w) / 2;
      const clusterY = rowY + LABEL_H;

      groups[gi].members.forEach((svc, si) => {
        const col2 = si % cols;
        const row2 = Math.floor(si / cols);
        positions[svc.id] = {
          x: clusterX + CLUSTER_PAD + col2 * (NODE_W + CLUSTER_GAP_X),
          y: clusterY + CLUSTER_PAD + row2 * (NODE_H + CLUSTER_GAP_Y),
        };
      });

      rowMaxH = Math.max(rowMaxH, LABEL_H + h);
    }
    rowY += rowMaxH + TYPE_GROUP_GAP_Y;
  }

  return positions;
}

// ── Fixed tier layering (uses deployTier from project registry) ──
function computeLayers(services: PortalService[]) {
  // Group by deployTier, excluding non-tiered project types
  const tiers: PortalService[][] = [[], [], []];

  for (const svc of services) {
    if (NON_TIERED_TYPES.has(svc.projectType || "")) continue;
    const tier = Math.min(Math.max(svc.deployTier ?? 2, 0), 2);
    tiers[tier].push(svc);
  }

  // Sort each tier alphabetically for consistent ordering
  for (const tier of tiers)
    tier.sort((a, b) => a.name.localeCompare(b.name));

  return tiers;
}

// ── Extract non-tiered projects (Library, Kit, Tool) ────────────
function computeLibraries(services: PortalService[]) {
  return (
    services
      .filter((svc) => NON_TIERED_TYPES.has(svc.projectType || ""))
      .sort((a, b) => a.name.localeCompare(b.name))
  );
}

// ── Compute cluster dimensions for a given layer ────────────────
function clusterSize(count: number, maxCols = MAX_COLS) {
  if (count === 0) return { cols: 0, rows: 0, w: 0, h: 0 };
  const cols = Math.min(count, maxCols);
  const rows = Math.ceil(count / cols);
  const w = cols * (NODE_W + CLUSTER_GAP_X) - CLUSTER_GAP_X + CLUSTER_PAD * 2;
  const h = rows * (NODE_H + CLUSTER_GAP_Y) - CLUSTER_GAP_Y + CLUSTER_PAD * 2;
  return { cols, rows, w, h };
}

// ── Assign positions from layers (grid clusters) ─────────────────
function layoutNodes(layers: PortalService[][], libs: PortalService[]) {
  const LABEL_H = 28; // height reserved for tier label above cluster
  const positions: Record<string, NodePosition> = {};

  // ── Libraries column (left side) ──────────────────────────
  const libSize = clusterSize(libs.length, LIBS_MAX_COLS);
  let libsColumnW = 0;

  if (libs.length > 0) {
    libsColumnW = libSize.w + LIBS_GAP;

    libs.forEach((svc, si) => {
      const col = si % LIBS_MAX_COLS;
      const row = Math.floor(si / LIBS_MAX_COLS);
      positions[svc.id] = {
        x: CLUSTER_PAD + col * (NODE_W + CLUSTER_GAP_X),
        y: LABEL_H + CLUSTER_PAD + row * (NODE_H + CLUSTER_GAP_Y),
      };
    });
  }

  // ── Tier columns (right side, offset by libs width) ───────
  const sizes = layers.map((l) => clusterSize(l.length));
  const maxW = Math.max(...sizes.map((s) => s.w), 0);

  let curY = 0;

  layers.forEach((layer, li) => {
    if (!layer.length) return;
    const { cols, w, h } = sizes[li];
    const clusterX = libsColumnW + (maxW - w) / 2;
    const clusterY = curY + LABEL_H;

    layer.forEach((svc, si) => {
      const col = si % cols;
      const row = Math.floor(si / cols);
      positions[svc.id] = {
        x: clusterX + CLUSTER_PAD + col * (NODE_W + CLUSTER_GAP_X),
        y: clusterY + CLUSTER_PAD + row * (NODE_H + CLUSTER_GAP_Y),
      };
    });

    curY = clusterY + h + TIER_SPACING;
  });

  return { positions, libsColumnW };
}

// ── Collect edges (with type derived from target's projectType) ──
function collectEdges(services: PortalService[]): TopologyEdge[] {
  const idSet = new Set(services.map((s) => s.id));
  // Build projectType lookup so edge type comes from the canonical registry classification
  const typeMap = new Map<string, string>();
  for (const svc of services) typeMap.set(svc.id, svc.projectType || "");

  const edges: TopologyEdge[] = [];
  for (const svc of services) {
    for (const dep of svc.dependsOn || []) {
      const depId = typeof dep === "string" ? dep : dep.id;
      const criticality =
        typeof dep === "string" ? "required" : (dep as DependencyRef).criticality || "required";
      const targetType = typeMap.get(depId) || "";
      const type: EdgeType = PROJECT_TYPE_TO_EDGE[targetType] || "api";
      if (idSet.has(depId))
        edges.push({ source: depId, target: svc.id, criticality, type });
    }
  }
  return edges;
}

// ── Smart port placement — dynamic edge anchoring ──────────────────────
// Picks the best connection side (top/bottom/left/right) for each node
// based on relative center-to-center position, then generates a
// direction-aware cubic Bézier with control points extending outward.
type PortSide = "top" | "bottom" | "left" | "right";

interface PortResult {
  x1: number;
  y1: number;
  side1: PortSide;
  x2: number;
  y2: number;
  side2: PortSide;
}

function getPortPoint(pos: { x: number; y: number }, side: PortSide) {
  switch (side) {
    case "top":
      return { x: pos.x + NODE_W / 2, y: pos.y };
    case "bottom":
      return { x: pos.x + NODE_W / 2, y: pos.y + NODE_H };
    case "left":
      return { x: pos.x, y: pos.y + NODE_H / 2 };
    case "right":
      return { x: pos.x + NODE_W, y: pos.y + NODE_H / 2 };
  }
}

function computeEdgeAnchors(
  sp: { x: number; y: number },
  tp: { x: number; y: number },
): PortResult {
  // Center-to-center delta
  const cx1 = sp.x + NODE_W / 2,
    cy1 = sp.y + NODE_H / 2;
  const cx2 = tp.x + NODE_W / 2,
    cy2 = tp.y + NODE_H / 2;
  const dx = cx2 - cx1;
  const dy = cy2 - cy1;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let side1: PortSide, side2: PortSide;

  // When the vertical gap between nodes is minimal (they're roughly side-by-side),
  // prefer horizontal ports to avoid edges crossing through node bodies
  const verticalOverlap = !(sp.y + NODE_H < tp.y || tp.y + NODE_H < sp.y);
  const horizontalOverlap = !(sp.x + NODE_W < tp.x || tp.x + NODE_W < sp.x);

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

  const p1 = getPortPoint(sp, side1);
  const p2 = getPortPoint(tp, side2);

  return { x1: p1.x, y1: p1.y, side1, x2: p2.x, y2: p2.y, side2 };
}

// Control point offset — extends outward from the port face
function ctrlOffset(side: PortSide, dist: number): { dx: number; dy: number } {
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

function edgePath(anchor: PortResult): string {
  const { x1, y1, side1, x2, y2, side2 } = anchor;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const c1 = ctrlOffset(side1, dist);
  const c2 = ctrlOffset(side2, dist);
  return `M ${x1} ${y1} C ${x1 + c1.dx} ${y1 + c1.dy}, ${x2 + c2.dx} ${y2 + c2.dy}, ${x2} ${y2}`;
}

// ── Main Component ───────────────────────────────────────────────
export default function TopologyComponent() {
  const [allServices, setAllServices] = useState<PortalService[]>([]);
  const [tierColors, setTierColors] = useState<Record<number, DeployTierColor>>(DEPLOY_TIER_COLORS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analysisData, setAnalysisData] = useState<ProjectAnalysis | null>(null);
  const [repoSizes, setRepoSizes] = useState<
    Record<string, { sizeKB: number; sizeBytes: number }>
  >({});
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [tooltipData, setTooltipData] = useState<PortalService | null>(null);

  // View mode toggle
  const [viewMode, setViewMode] = useState<ViewMode>("tier");

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Edge type visibility toggles
  const [edgeVisibility, setEdgeVisibility] = useState<
    Record<EdgeType, boolean>
  >(() => {
    const init: Record<EdgeType, boolean> = {} as Record<EdgeType, boolean>;
    for (const [key, cfg] of Object.entries(EDGE_TYPE_CONFIG))
      init[key as EdgeType] = cfg.defaultVisible;
    return init;
  });
  const toggleEdgeType = useCallback((type: EdgeType) => {
    setEdgeVisibility((prev) => ({ ...prev, [type]: !prev[type] }));
  }, []);

  // Draggable node positions (overrides layout)
  const [posOverrides, setPosOverrides] = useState<Record<string, NodePosition>>({});

  // Pan / zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [dragging, setDragging] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef(zoom);
  const didFetch = useRef(false);

  // Cluster (group) dragging
  const clusterDragging = useRef<{
    startX: number;
    startY: number;
    memberIds: string[];
    origPositions: Record<string, NodePosition>;
  } | null>(null);

  // Keep zoomRef in sync
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  /**
   * Supplement service dependsOn with analysis-detected dependencies.
   * Keeps ALL original deps (hard-coded in registry) and adds any
   * newly detected imports/API calls that aren't already present.
   * If analysis found nothing for a project, deps are unchanged.
   */
  function mergeAnalysisDeps(services: PortalService[], analysis: ProjectAnalysis | null): PortalService[] {
    if (!analysis?.dependencies) return services;

    return services.map((svc) => {
      const detected = analysis.dependencies[svc.id];
      if (!detected) return svc;

      // If analysis found nothing, keep original deps unchanged
      const hasDetected =
        detected.imports?.length > 0 || detected.apiCalls?.length > 0;
      if (!hasDetected) return svc;

      // Build a set of existing dep IDs for dedup
      const existingIds = new Set(
        (svc.dependsOn || []).map((dep) =>
          typeof dep === "string" ? dep : dep.id,
        ),
      );

      // Add detected deps that aren't already present
      const newDeps: DependencyRef[] = [];
      for (const imp of detected.imports || []) {
        if (!existingIds.has(imp.target)) {
          newDeps.push({
            id: imp.target,
            name: imp.target,
            criticality: "required",
            source: "detected",
          });
          existingIds.add(imp.target);
        }
      }
      for (const api of detected.apiCalls || []) {
        if (!existingIds.has(api.target)) {
          newDeps.push({
            id: api.target,
            name: api.target,
            criticality: "required",
            source: "detected",
          });
          existingIds.add(api.target);
        }
      }

      if (newDeps.length === 0) return svc;
      return { ...svc, dependsOn: [...(svc.dependsOn || []), ...newDeps] };
    });
  }

  async function loadData(refresh = false) {
    try {
      const [servicesRes, analysisRes] = await Promise.all([
        ApiService.getServices(refresh),
        ApiService.getProjectAnalysis(refresh).catch(() => null),
      ]);

      let svcs: PortalService[] = ((servicesRes as Record<string, unknown>).services as PortalService[] || []).map((s) => ({
        ...s,
        isInfrastructure: false,
      }));
      const infra: PortalService[] = ((servicesRes as Record<string, unknown>).infrastructure as PortalService[] || []).map((s) => ({
        ...s,
        isInfrastructure: true,
      }));

      // Merge detected dependencies into service data
      if (analysisRes) {
        svcs = mergeAnalysisDeps(svcs, analysisRes as ProjectAnalysis);
        setAnalysisData(analysisRes as ProjectAnalysis);
        if ((analysisRes as ProjectAnalysis).repoSizes) setRepoSizes((analysisRes as ProjectAnalysis).repoSizes!);
      }

      setAllServices([...svcs, ...infra]);
      if ((servicesRes as Record<string, unknown>).deployTierColors)
        setTierColors((servicesRes as Record<string, unknown>).deployTierColors as Record<number, DeployTierColor>);
    } catch (error) {
      console.error("Topology fetch failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const didCenterRef = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadData(true);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  // ── Computed layout ─────────────────────────────────────────
  const layers = useMemo(() => computeLayers(allServices), [allServices]);
  const libs = useMemo(() => computeLibraries(allServices), [allServices]);
  const { positions: tierBasePositions } = useMemo(
    () => layoutNodes(layers, libs),
    [layers, libs],
  );
  const typeGroups = useMemo(
    () => computeTypeGroups(allServices),
    [allServices],
  );
  const typeBasePositions = useMemo(
    () => layoutTypeNodes(typeGroups),
    [typeGroups],
  );

  // Switch base positions based on view mode
  const basePositions =
    viewMode === "tier" ? tierBasePositions : typeBasePositions;

  const allEdges = useMemo(() => collectEdges(allServices), [allServices]);
  const edges = useMemo(
    () => allEdges.filter((e) => edgeVisibility[e.type]),
    [allEdges, edgeVisibility],
  );

  // Edge type counts for legend badges
  const edgeTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      api: 0,
      import: 0,
      tooling: 0,
      infra: 0,
    };
    for (const e of allEdges) counts[e.type] = (counts[e.type] || 0) + 1;
    return counts;
  }, [allEdges]);

  // Merged positions (base + overrides from dragging)
  const positions = useMemo(() => {
    const merged = { ...basePositions };
    for (const [id, pos] of Object.entries(posOverrides)) {
      if (merged[id]) merged[id] = pos;
    }
    return merged;
  }, [basePositions, posOverrides]);

  // Switch view mode and reset transient state
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setPosOverrides({});
    setSelectedNode(null);
    didCenterRef.current = false;
  }, []);

  // Dynamic cluster rects — computed from actual node positions (follows dragging)
  const dynamicClusterRects = useMemo(() => {
    return layers.map((layer, li) => {
      if (!layer.length) return null;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const svc of layer) {
        const pos = positions[svc.id];
        if (!pos) continue;
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + NODE_W);
        maxY = Math.max(maxY, pos.y + NODE_H);
      }
      if (minX === Infinity) return null;
      return {
        x: minX - CLUSTER_PAD,
        y: minY - CLUSTER_PAD,
        w: maxX - minX + CLUSTER_PAD * 2,
        h: maxY - minY + CLUSTER_PAD * 2,
        tier: li,
      };
    });
  }, [layers, positions]);

  // Dynamic rect for the libraries cluster
  const libsClusterRect = useMemo(() => {
    if (!libs.length) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const svc of libs) {
      const pos = positions[svc.id];
      if (!pos) continue;
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + NODE_W);
      maxY = Math.max(maxY, pos.y + NODE_H);
    }
    if (minX === Infinity) return null;
    return {
      x: minX - CLUSTER_PAD,
      y: minY - CLUSTER_PAD,
      w: maxX - minX + CLUSTER_PAD * 2,
      h: maxY - minY + CLUSTER_PAD * 2,
    };
  }, [libs, positions]);

  const healthyCount = allServices.filter((s) => s.healthy).length;

  // ── Search filtering ────────────────────────────────────────
  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null; // null = no filter active
    const matched = new Set();
    for (const svc of allServices) {
      const haystack = [
        svc.name,
        svc.device,
        svc.projectType,
        svc.environment,
        svc.url,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (haystack.includes(q)) matched.add(svc.id);
    }
    return matched;
  }, [searchQuery, allServices]);

  // Which tier clusters have at least one visible node under search
  const searchVisibleTiers = useMemo(() => {
    if (!searchMatches) return null;
    const visible = new Set();
    layers.forEach((layer, li) => {
      for (const svc of layer) {
        if (searchMatches.has(svc.id)) {
          visible.add(li);
          break;
        }
      }
    });
    return visible;
  }, [searchMatches, layers]);

  // Dynamic cluster rects for type-group view
  const typeClusterRects = useMemo(() => {
    if (viewMode !== "type") return [];
    return typeGroups.map((group) => {
      if (!group.members.length) return null;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const svc of group.members) {
        const pos = positions[svc.id];
        if (!pos) continue;
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + NODE_W);
        maxY = Math.max(maxY, pos.y + NODE_H);
      }
      if (minX === Infinity) return null;
      return {
        x: minX - CLUSTER_PAD,
        y: minY - CLUSTER_PAD,
        w: maxX - minX + CLUSTER_PAD * 2,
        h: maxY - minY + CLUSTER_PAD * 2,
        type: group.type,
      };
    });
  }, [viewMode, typeGroups, positions]);

  // Which type clusters have at least one visible node under search
  const searchVisibleTypes = useMemo(() => {
    if (!searchMatches || viewMode !== "type") return null;
    const visible = new Set<string>();
    for (const group of typeGroups) {
      for (const svc of group.members) {
        if (searchMatches.has(svc.id)) {
          visible.add(group.type);
          break;
        }
      }
    }
    return visible;
  }, [searchMatches, typeGroups, viewMode]);

  // ── Upstream dependency chain + immediate downstream from selected node ──
  // Also classifies edges as "incoming" or "outgoing" relative to the selected node
  const { connectedNodes, edgeDirectionMap } = useMemo(() => {
    if (!selectedNode)
      return { connectedNodes: new Set(), edgeDirectionMap: new Map() };

    const upstream = new Map(); // target → [sources]
    const downstream = new Map(); // source → [targets]
    for (const e of edges) {
      if (!upstream.has(e.target)) upstream.set(e.target, []);
      upstream.get(e.target).push(e.source);
      if (!downstream.has(e.source)) downstream.set(e.source, []);
      downstream.get(e.source).push(e.target);
    }

    // Walk full upstream chain
    const visited = new Set([selectedNode]);
    const queue = [selectedNode];
    while (queue.length > 0) {
      const id = queue.shift();
      for (const dep of upstream.get(id) || []) {
        if (!visited.has(dep)) {
          visited.add(dep);
          queue.push(dep);
        }
      }
    }

    // Add immediate downstream (one level only)
    for (const child of downstream.get(selectedNode) || []) {
      visited.add(child);
    }

    // Build edge direction map: edgeKey → "incoming" | "outgoing" | "network"
    // "incoming" = direct edge INTO the selected node (immediate dependency)
    // "outgoing" = direct edge OUT FROM the selected node (immediate consumer)
    // "network"  = transitive edge between other connected nodes
    const dirMap = new Map<string, "incoming" | "outgoing" | "network">();
    for (const e of edges) {
      const key = `${e.source}-${e.target}`;
      if (!visited.has(e.source) || !visited.has(e.target)) continue;

      if (e.target === selectedNode) {
        dirMap.set(key, "incoming");
      } else if (e.source === selectedNode) {
        dirMap.set(key, "outgoing");
      } else {
        dirMap.set(key, "network");
      }
    }

    return { connectedNodes: visited, edgeDirectionMap: dirMap };
  }, [selectedNode, edges]);

  // ── Coordinate conversion ───────────────────────────────────
  const screenToSvg = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: clientX, y: clientY };
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom],
  );

  // ── Node drag ───────────────────────────────────────────────
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, svc: PortalService) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      setSelectedNode(svc.id);
      const pos = positions[svc.id];
      if (!pos) return;
      const svgPos = screenToSvg(e.clientX, e.clientY);
      setDragging({
        nodeId: svc.id,
        offsetX: svgPos.x - pos.x,
        offsetY: svgPos.y - pos.y,
      });
    },
    [positions, screenToSvg],
  );

  // ── Cluster (group) drag ────────────────────────────────────
  const handleClusterMouseDown = useCallback(
    (e: React.MouseEvent, clusterType: string, clusterIndex: number) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      setSelectedNode(null);

      const svgPos = screenToSvg(e.clientX, e.clientY);
      let memberIds: string[];
      if (clusterType === "libs") {
        memberIds = libs.map((s) => s.id);
      } else if (clusterType === "type") {
        memberIds = (typeGroups[clusterIndex]?.members || []).map(
          (s) => s.id,
        );
      } else {
        memberIds = (layers[clusterIndex] || []).map((s) => s.id);
      }

      // Snapshot current positions of all cluster members
      const origPositions: Record<string, NodePosition> = {};
      for (const id of memberIds) {
        const pos = positions[id];
        if (pos) origPositions[id] = { x: pos.x, y: pos.y };
      }

      clusterDragging.current = {
        startX: svgPos.x,
        startY: svgPos.y,
        memberIds,
        origPositions,
      };
    },
    [screenToSvg, libs, layers, typeGroups, positions],
  );

  // ── Canvas pan ──────────────────────────────────────────────
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const element = e.target as Element;
      if (
        element.closest("[data-topology-node]") ||
        element.closest("[data-topology-cluster]")
      )
        return;
      setSelectedNode(null); // deselect on background click
      setIsPanning(true);
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      // Single node drag
      if (dragging) {
        const svgPos = screenToSvg(e.clientX, e.clientY);
        setPosOverrides((prev) => ({
          ...prev,
          [dragging.nodeId]: {
            x: svgPos.x - dragging.offsetX,
            y: svgPos.y - dragging.offsetY,
          },
        }));
        return;
      }
      // Cluster (group) drag
      if (clusterDragging.current) {
        const svgPos = screenToSvg(e.clientX, e.clientY);
        const { startX, startY, origPositions } = clusterDragging.current;
        const dx = svgPos.x - startX;
        const dy = svgPos.y - startY;
        setPosOverrides((prev) => {
          const next = { ...prev };
          for (const [id, orig] of Object.entries(origPositions)) {
            next[id] = { x: orig.x + dx, y: orig.y + dy };
          }
          return next;
        });
        return;
      }
      // Canvas pan
      if (isPanning) {
        setPan({
          x: panStart.current.panX + (e.clientX - panStart.current.x),
          y: panStart.current.panY + (e.clientY - panStart.current.y),
        });
      }
    },
    [dragging, isPanning, screenToSvg],
  );

  const handleMouseUp = useCallback(() => {
    if (dragging) setDragging(null);
    if (clusterDragging.current) clusterDragging.current = null;
    if (isPanning) setIsPanning(false);
  }, [dragging, isPanning]);

  // ── Zoom toward cursor ──────────────────────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const cur = zoomRef.current;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const next = Math.min(3, Math.max(0.2, cur * delta));
    const ratio = next / cur;
    zoomRef.current = next;
    setPan((p) => ({
      x: mouseX - ratio * (mouseX - p.x),
      y: mouseY - ratio * (mouseY - p.y),
    }));
    setZoom(next);
  }, []);

  // Attach listeners
  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    const element = containerRef.current;
    element?.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      element?.removeEventListener("wheel", handleWheel);
    };
  }, [handleMouseMove, handleMouseUp, handleWheel]);

  const zoomIn = () => {
    const n = Math.min(3, zoom * 1.25);
    setZoom(n);
    zoomRef.current = n;
  };
  const zoomOut = () => {
    const n = Math.max(0.2, zoom * 0.8);
    setZoom(n);
    zoomRef.current = n;
  };

  // ── Center topology in viewport ─────────────────────────────
  const centerOnContent = useCallback(() => {
    const element = containerRef.current;
    if (!element || allServices.length === 0) return;
    const rect = element.getBoundingClientRect();
    // compute bounding box of all nodes
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const pos of Object.values(basePositions)) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + NODE_W);
      maxY = Math.max(maxY, pos.y + NODE_H);
    }
    if (minX === Infinity) return;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const padFraction = 0.08; // 8% padding on each side
    const scaleX = (rect.width * (1 - padFraction * 2)) / contentW;
    const scaleY = (rect.height * (1 - padFraction * 2)) / contentH;
    const fitZoom = Math.min(scaleX, scaleY, 1.4); // cap so it doesn't zoom in too much
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setPan({
      x: rect.width / 2 - cx * fitZoom,
      y: rect.height / 2 - cy * fitZoom,
    });
    setZoom(fitZoom);
    zoomRef.current = fitZoom;
  }, [basePositions, allServices]);

  const zoomFit = () => {
    centerOnContent();
  };

  // Auto-center once data loads
  useEffect(() => {
    if (didCenterRef.current || allServices.length === 0) return;
    // Wait one frame for the container to have dimensions
    requestAnimationFrame(() => {
      centerOnContent();
      didCenterRef.current = true;
    });
  }, [allServices, centerOnContent]);

  // ── Tooltip ─────────────────────────────────────────────────
  const handleNodeEnter = useCallback((e: React.MouseEvent, svc: PortalService) => {
    setHoveredNode(svc.id);
    setTooltipPos({ x: e.clientX, y: e.clientY });
    setTooltipData(svc);
  }, []);

  const handleNodeMove = useCallback(
    (e: React.MouseEvent) => {
      if (hoveredNode) setTooltipPos({ x: e.clientX, y: e.clientY });
    },
    [hoveredNode],
  );
  const handleNodeLeave = useCallback(() => {
    setHoveredNode(null);
    setTooltipData(null);
  }, []);

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className={styles.topology}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>Topology</h1>
            <p className={styles.subtitle}>
              {loading
                ? "Loading…"
                : `${allServices.length} services · ${healthyCount} healthy`}
            </p>
          </div>
          <div className={styles.headerActions}>
            {/* View mode segmented toggle */}
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewToggleButton}${viewMode === "tier" ? ` ${styles.viewToggleActive}` : ""}`}
                onClick={() => handleViewModeChange("tier")}
                title="Group by deploy tier"
              >
                <Layers size={14} strokeWidth={1.8} />
                <span>By Tier</span>
              </button>
              <button
                className={`${styles.viewToggleButton}${viewMode === "type" ? ` ${styles.viewToggleActive}` : ""}`}
                onClick={() => handleViewModeChange("type")}
                title="Group by project type"
              >
                <Grid3X3 size={14} strokeWidth={1.8} />
                <span>By Type</span>
              </button>
            </div>
            <div
              className={`${styles.searchWrapper}${searchFocused || searchQuery ? ` ${styles.searchExpanded}` : ""}`}
            >
              <Search size={14} strokeWidth={2} className={styles.searchIcon} />
              <input
                ref={searchRef}
                type="text"
                className={styles.searchInput}
                placeholder="Filter nodes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Escape") {
                    setSearchQuery("");
                    searchRef.current?.blur();
                  }
                }}
              />
              {searchQuery && (
                <button
                  className={styles.searchClear}
                  onClick={() => {
                    setSearchQuery("");
                    searchRef.current?.focus();
                  }}
                  tabIndex={-1}
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              )}
            </div>
            <ButtonComponent
              variant="secondary"
              icon={RefreshCw}
              loading={refreshing}
              onClick={handleRefresh}
            >
              Refresh
            </ButtonComponent>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingIndicatorComponent
          size="small"
          label="Building topology…"
          className="loading-center"
        />
      ) : (
        <>
          <div
            ref={containerRef}
            className={`${styles.canvasWrapper}${isPanning ? ` ${styles.panning}` : ""}`}
            onMouseDown={handleCanvasMouseDown}
          >
            <svg
              ref={svgRef}
              className={styles.svg}
              style={{ overflow: "visible" }}
            >
              <defs>
                {/* Rainbow flowing gradient — same as Prism Client workflows */}
                <linearGradient
                  id="prism-gradient"
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
                {/* Directional edge arrowhead markers */}
                <marker
                  id="arrow-incoming"
                  viewBox="0 0 10 8"
                  refX="10"
                  refY="4"
                  markerWidth="8"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path
                    d="M 0 0 L 10 4 L 0 8 z"
                    fill={EDGE_DIRECTION_CONFIG.incoming.color}
                    opacity="0.9"
                  />
                </marker>
                <marker
                  id="arrow-outgoing"
                  viewBox="0 0 10 8"
                  refX="10"
                  refY="4"
                  markerWidth="8"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path
                    d="M 0 0 L 10 4 L 0 8 z"
                    fill={EDGE_DIRECTION_CONFIG.outgoing.color}
                    opacity="0.9"
                  />
                </marker>
                <marker
                  id="arrow-network"
                  viewBox="0 0 10 8"
                  refX="10"
                  refY="4"
                  markerWidth="7"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path
                    d="M 0 0 L 10 4 L 0 8 z"
                    fill={EDGE_DIRECTION_CONFIG.network.color}
                    opacity="0.7"
                  />
                </marker>
              </defs>
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* ── Edges ── */}
                {edges.map((edge, i) => {
                  const sp = positions[edge.source];
                  const tp = positions[edge.target];
                  if (!sp || !tp) return null;

                  const anchor = computeEdgeAnchors(sp, tp);

                  const isSelected =
                    connectedNodes.has(edge.source) &&
                    connectedNodes.has(edge.target);
                  const isHovered =
                    hoveredNode === edge.source || hoveredNode === edge.target;
                  const isActive = isSelected || isHovered;
                  const isOptional = edge.criticality === "optional";
                  const isFadedBySelection = selectedNode && !isSelected;
                  const isFadedBySearch =
                    searchMatches &&
                    (!searchMatches.has(edge.source) ||
                      !searchMatches.has(edge.target));
                  const isFaded = isFadedBySelection || isFadedBySearch;
                  const d = edgePath(anchor);

                  // Edge type styling
                  const etc =
                    EDGE_TYPE_CONFIG[edge.type as EdgeType] ||
                    EDGE_TYPE_CONFIG.api;
                  const baseColor = etc.color;
                  const baseDash = etc.dash;
                  const baseWidth = etc.width;
                  const baseOpacity = etc.opacity;

                  // Directional edge classification (when a node is selected)
                  const edgeKey = `${edge.source}-${edge.target}`;
                  const direction = edgeDirectionMap.get(edgeKey);
                  const dirConfig = direction
                    ? EDGE_DIRECTION_CONFIG[
                        direction as keyof typeof EDGE_DIRECTION_CONFIG
                      ]
                    : null;
                  const showDirectional = isSelected && dirConfig;

                  // When selected, use directional color; otherwise use edge type color
                  const strokeColor = showDirectional
                    ? dirConfig.color
                    : baseColor;
                  const markerEnd = showDirectional
                    ? `url(#arrow-${direction})`
                    : undefined;

                  return (
                    <g
                      key={`${edge.source}-${edge.target}-${i}`}
                      className={`${styles.connectionGroup}${isSelected ? ` ${styles.connectionFlowing}` : ""}${isFaded ? ` ${styles.edgeFaded}` : ""}`}
                    >
                      <path
                        d={d}
                        stroke="transparent"
                        strokeWidth={12}
                        fill="none"
                      />
                      {/* Glow layer for directional edges */}
                      {showDirectional && (
                        <path
                          d={d}
                          stroke={dirConfig.color}
                          strokeWidth={6}
                          fill="none"
                          strokeOpacity={0.12}
                          className={styles.connectionGlow}
                        />
                      )}
                      <path
                        d={d}
                        stroke={strokeColor}
                        strokeWidth={
                          isActive
                            ? 2.5
                            : isOptional
                              ? Math.max(baseWidth - 0.5, 0.75)
                              : baseWidth
                        }
                        fill="none"
                        strokeOpacity={
                          isActive
                            ? 0.9
                            : isOptional
                              ? baseOpacity * 0.5
                              : baseOpacity
                        }
                        strokeDasharray={
                          isOptional && !isSelected ? "6 4" : baseDash
                        }
                        markerEnd={markerEnd}
                        className={styles.connectionLine}
                      />
                    </g>
                  );
                })}

                {/* ── Tier-view clusters (libs + tiers) ── */}
                {viewMode === "tier" && (
                  <>
                    {/* Libraries cluster background + label */}
                    {libsClusterRect && (
                      <g
                        className={
                          (selectedNode ? styles.tierLabelFaded : "") +
                            (searchVisibleTiers &&
                            !libs.some((s: { id: string }) => searchMatches?.has(s.id))
                              ? ` ${styles.tierLabelFaded}`
                              : "") || undefined
                        }
                      >
                        <rect
                          x={libsClusterRect.x}
                          y={libsClusterRect.y}
                          width={libsClusterRect.w}
                          height={libsClusterRect.h}
                          rx={10}
                          ry={10}
                          className={`${styles.clusterRect} ${styles.clusterDraggable}`}
                          style={{
                            stroke: LIBS_CLUSTER_COLOR.stroke,
                            fill: LIBS_CLUSTER_COLOR.fill,
                          }}
                          data-topology-cluster
                          onMouseDown={(e) =>
                            handleClusterMouseDown(e, "libs", -1)
                          }
                        />
                        {/* Drag handle icon */}
                        <foreignObject
                          x={libsClusterRect.x + 8}
                          y={libsClusterRect.y + 6}
                          width={16}
                          height={16}
                          className={styles.clusterDragHandle}
                          data-topology-cluster
                          onMouseDown={(e) =>
                            handleClusterMouseDown(e, "libs", -1)
                          }
                        >
                          <Move size={12} strokeWidth={1.5} />
                        </foreignObject>
                        <text
                          x={libsClusterRect.x + libsClusterRect.w / 2}
                          y={libsClusterRect.y - 10}
                          className={styles.tierLabel}
                          textAnchor="middle"
                          dominantBaseline="auto"
                        >
                          {LIBS_LABEL}
                        </text>
                      </g>
                    )}

                    {/* Tier cluster backgrounds + labels */}
                    {dynamicClusterRects.map((cr, li) => {
                      if (!cr) return null;
                      const tc =
                        tierColors[li] ||
                        DEPLOY_TIER_COLORS[li] ||
                        DEPLOY_TIER_COLORS[0];
                      return (
                        <g
                          key={`cluster-${li}`}
                          className={
                            (selectedNode ? styles.tierLabelFaded : "") +
                              (searchVisibleTiers && !searchVisibleTiers.has(li)
                                ? ` ${styles.tierLabelFaded}`
                                : "") || undefined
                          }
                        >
                          <rect
                            x={cr.x}
                            y={cr.y}
                            width={cr.w}
                            height={cr.h}
                            rx={10}
                            ry={10}
                            className={`${styles.clusterRect} ${styles.clusterDraggable}`}
                            style={{ stroke: tc.stroke, fill: tc.fill }}
                            data-topology-cluster
                            onMouseDown={(e) =>
                              handleClusterMouseDown(e, "tier", li)
                            }
                          />
                          {/* Drag handle icon */}
                          <foreignObject
                            x={cr.x + 8}
                            y={cr.y + 6}
                            width={16}
                            height={16}
                            className={styles.clusterDragHandle}
                            data-topology-cluster
                            onMouseDown={(e) =>
                              handleClusterMouseDown(e, "tier", li)
                            }
                          >
                            <Move size={12} strokeWidth={1.5} />
                          </foreignObject>
                          <text
                            x={cr.x + cr.w / 2}
                            y={cr.y - 10}
                            className={styles.tierLabel}
                            textAnchor="middle"
                            dominantBaseline="auto"
                          >
                            {TIER_LABELS[li] || `Tier ${li}`}
                          </text>
                        </g>
                      );
                    })}
                  </>
                )}

                {/* ── Type-view clusters ── */}
                {viewMode === "type" &&
                  typeClusterRects.map((cr, gi) => {
                    if (!cr) return null;
                    const group = typeGroups[gi];
                    const tc =
                      SERVICE_TYPE_COLORS[group.type] ||
                      SERVICE_TYPE_COLORS.Service;
                    const isFadedBySearch =
                      searchVisibleTypes && !searchVisibleTypes.has(group.type);
                    return (
                      <g
                        key={`type-cluster-${group.type}`}
                        className={
                          (selectedNode ? styles.tierLabelFaded : "") +
                            (isFadedBySearch
                              ? ` ${styles.tierLabelFaded}`
                              : "") || undefined
                        }
                      >
                        <rect
                          x={cr.x}
                          y={cr.y}
                          width={cr.w}
                          height={cr.h}
                          rx={10}
                          ry={10}
                          className={`${styles.clusterRect} ${styles.clusterDraggable}`}
                          style={{
                            stroke: `color-mix(in srgb, ${tc.color} 35%, transparent)`,
                            fill: `color-mix(in srgb, ${tc.color} 4%, transparent)`,
                          }}
                          data-topology-cluster
                          onMouseDown={(e) =>
                            handleClusterMouseDown(e, "type", gi)
                          }
                        />
                        <foreignObject
                          x={cr.x + 8}
                          y={cr.y + 6}
                          width={16}
                          height={16}
                          className={styles.clusterDragHandle}
                          data-topology-cluster
                          onMouseDown={(e) =>
                            handleClusterMouseDown(e, "type", gi)
                          }
                        >
                          <Move size={12} strokeWidth={1.5} />
                        </foreignObject>
                        <text
                          x={cr.x + cr.w / 2}
                          y={cr.y - 10}
                          className={styles.tierLabel}
                          textAnchor="middle"
                          dominantBaseline="auto"
                          style={{ fill: tc.color }}
                        >
                          {group.type === "Kit"
                            ? "Toolkits"
                            : group.type === "Store"
                              ? "Stores"
                              : `${group.type}s`}
                        </text>
                      </g>
                    );
                  })}

                {/* ── Nodes ── */}
                {allServices.map((svc: PortalService) => {
                  const pos = positions[svc.id];
                  if (!pos) return null;
                  const Icon = getIcon(svc);
                  const isHov = hoveredNode === svc.id;
                  const isDragging = dragging?.nodeId === svc.id;
                  const isFadedBySelection =
                    selectedNode && !connectedNodes.has(svc.id);
                  const isFadedBySearch =
                    searchMatches && !searchMatches.has(svc.id);
                  const isFaded = isFadedBySelection || isFadedBySearch;

                  const ptc =
                    SERVICE_TYPE_COLORS[svc.projectType as string] ||
                    SERVICE_TYPE_COLORS.Service;
                  const healthClass = svc.healthy
                    ? styles.nodeHealthy
                    : styles.nodeDown;
                  const nodeColor = svc.healthy ? ptc.color : undefined;

                  return (
                    <foreignObject
                      key={svc.id}
                      x={pos.x}
                      y={pos.y}
                      width={NODE_W}
                      height={NODE_H}
                      data-topology-node
                      style={{ overflow: "visible" }}
                    >
                      <div
                        className={`${styles.nodeCard} ${healthClass} ${isHov ? styles.nodeHovered : ""} ${isDragging ? styles.nodeDragging : ""} ${selectedNode === svc.id ? styles.nodeSelected : ""}${isFaded ? ` ${styles.nodeFaded}` : ""}`}
                        onMouseDown={(e) => handleNodeMouseDown(e, svc)}
                        onMouseEnter={(e) => handleNodeEnter(e, svc)}
                        onMouseMove={handleNodeMove}
                        onMouseLeave={handleNodeLeave}
                        style={
                          svc.healthy
                            ? {
                                borderColor: `color-mix(in srgb, ${ptc.color} 15%, transparent)`,
                              }
                            : undefined
                        }
                      >
                        <div
                          className={styles.nodeGlow}
                          style={
                            nodeColor
                              ? { boxShadow: `0 0 20px ${ptc.subtle}` }
                              : undefined
                          }
                        />
                        {!NON_TIERED_TYPES.has(svc.projectType as string) && (
                          <div
                            className={`${styles.statusDot} ${svc.healthy ? styles.statusHealthy : styles.statusDown}`}
                          />
                        )}
                        <div
                          className={styles.nodeIconWrap}
                          style={nodeColor ? { color: nodeColor } : undefined}
                        >
                          <Icon size={18} strokeWidth={1.5} />
                        </div>
                        <span className={styles.nodeName}>{svc.name}</span>
                        {repoSizes[svc.id] ? (
                          <span className={styles.nodeSize}>
                            <HardDrive size={9} strokeWidth={1.5} />
                            {formatSize(repoSizes[svc.id].sizeKB)}
                          </span>
                        ) : svc.device ? (
                          <span className={styles.nodeHost}>{svc.device}</span>
                        ) : null}
                      </div>
                    </foreignObject>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* Legend */}
          <div className={styles.legend}>
            <div className={styles.legendTitle}>Nodes</div>
            <div className={styles.legendItem}>
              <div
                className={styles.legendDot}
                style={{
                  background: "var(--color-success)",
                  boxShadow: "0 0 6px var(--success-subtle)",
                }}
              />
              <span>Healthy</span>
            </div>
            <div className={styles.legendItem}>
              <div
                className={styles.legendDot}
                style={{
                  background: "var(--color-danger)",
                  boxShadow: "0 0 6px var(--danger-subtle)",
                }}
              />
              <span>Down</span>
            </div>
            <div className={styles.legendSep} />
            {Object.entries(SERVICE_TYPE_COLORS).map(([type, colors]) => (
              <div key={type} className={styles.legendItem}>
                <div
                  className={styles.legendDot}
                  style={{
                    background: colors.color,
                    boxShadow: `0 0 6px ${colors.subtle}`,
                  }}
                />
                <span>{type}</span>
              </div>
            ))}
            <div className={styles.legendSep} />
            <div className={styles.legendTitle}>Connections</div>
            {(
              Object.entries(EDGE_TYPE_CONFIG) as [
                EdgeType,
                (typeof EDGE_TYPE_CONFIG)[EdgeType],
              ][]
            ).map(([type, cfg]) => {
              const visible = edgeVisibility[type];
              const count = edgeTypeCounts[type] || 0;
              return (
                <div
                  key={type}
                  className={`${styles.legendItem} ${styles.legendToggle}${!visible ? ` ${styles.legendToggleOff}` : ""}`}
                  onClick={() => toggleEdgeType(type)}
                  title={`${visible ? "Hide" : "Show"} ${cfg.label} (${count})`}
                >
                  <div
                    className={styles.legendEdgeLine}
                    style={{
                      borderTopColor: cfg.color,
                      borderTopStyle: cfg.dash === "none" ? "solid" : "dashed",
                      borderTopWidth: `${Math.max(cfg.width, 1.5)}px`,
                      opacity: visible ? 1 : 0.3,
                    }}
                  />
                  <span>{cfg.label}</span>
                  <span className={styles.legendCount}>{count}</span>
                  {visible ? (
                    <Eye
                      size={11}
                      strokeWidth={1.5}
                      className={styles.legendEyeIcon}
                    />
                  ) : (
                    <EyeOff
                      size={11}
                      strokeWidth={1.5}
                      className={styles.legendEyeIcon}
                    />
                  )}
                </div>
              );
            })}
            <div className={styles.legendSep} />
            <div className={styles.legendItem}>
              <div className={styles.legendLine} />
              <span>Required</span>
            </div>
            <div className={styles.legendItem}>
              <div
                className={styles.legendLine}
                style={{ borderTopStyle: "dashed", opacity: 0.5 }}
              />
              <span>Optional</span>
            </div>
            {selectedNode && (
              <>
                <div className={styles.legendSep} />
                <div className={styles.legendTitle}>Selected</div>
                <div className={styles.legendItem}>
                  <div
                    className={styles.legendEdgeLine}
                    style={{
                      borderTopColor: EDGE_DIRECTION_CONFIG.incoming.color,
                      borderTopStyle: "solid",
                      borderTopWidth: "2.5px",
                    }}
                  />
                  <ArrowDown
                    size={11}
                    strokeWidth={2}
                    style={{ color: EDGE_DIRECTION_CONFIG.incoming.color }}
                  />
                  <span>{EDGE_DIRECTION_CONFIG.incoming.label}</span>
                </div>
                <div className={styles.legendItem}>
                  <div
                    className={styles.legendEdgeLine}
                    style={{
                      borderTopColor: EDGE_DIRECTION_CONFIG.outgoing.color,
                      borderTopStyle: "solid",
                      borderTopWidth: "2.5px",
                    }}
                  />
                  <ArrowUp
                    size={11}
                    strokeWidth={2}
                    style={{ color: EDGE_DIRECTION_CONFIG.outgoing.color }}
                  />
                  <span>{EDGE_DIRECTION_CONFIG.outgoing.label}</span>
                </div>
                <div className={styles.legendItem}>
                  <div
                    className={styles.legendEdgeLine}
                    style={{
                      borderTopColor: EDGE_DIRECTION_CONFIG.network.color,
                      borderTopStyle: "solid",
                      borderTopWidth: "2px",
                      opacity: 0.7,
                    }}
                  />
                  <GitBranch
                    size={11}
                    strokeWidth={2}
                    style={{ color: EDGE_DIRECTION_CONFIG.network.color }}
                  />
                  <span>{EDGE_DIRECTION_CONFIG.network.label}</span>
                </div>
              </>
            )}
          </div>

          {/* Zoom */}
          <div className={styles.zoomControls}>
            <button className={styles.zoomButton} onClick={zoomIn} title="Zoom in">
              <ZoomIn size={15} strokeWidth={1.8} />
            </button>
            <button
              className={styles.zoomButton}
              onClick={zoomOut}
              title="Zoom out"
            >
              <ZoomOut size={15} strokeWidth={1.8} />
            </button>
            <button
              className={styles.zoomButton}
              onClick={zoomFit}
              title="Fit to view"
            >
              <Maximize2 size={14} strokeWidth={1.8} />
            </button>
          </div>

          {/* Tooltip */}
          {tooltipData && (
            <div
              className={styles.tooltip}
              style={{
                left: Math.min(
                  tooltipPos.x + 16,
                  (typeof window !== "undefined" ? window.innerWidth : 1000) -
                    300,
                ),
                top: tooltipPos.y - 10,
              }}
            >
              <div className={styles.tooltipName}>{tooltipData.name}</div>
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipLabel}>Status</span>
                <span
                  className={`${styles.tooltipValue} ${tooltipData.healthy ? styles.tooltipHealthy : styles.tooltipUnhealthy}`}
                >
                  {tooltipData.healthy ? "Healthy" : "Down"}
                </span>
              </div>
              {tooltipData.device && (
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>Device</span>
                  <span className={styles.tooltipValue}>
                    {tooltipData.device}
                  </span>
                </div>
              )}
              {tooltipData.url && (
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>URL</span>
                  <span className={styles.tooltipValue}>{tooltipData.url}</span>
                </div>
              )}
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipLabel}>Environment</span>
                <span className={styles.tooltipValue}>
                  {tooltipData.environment}
                </span>
              </div>
              {tooltipData.visibility && (
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>Visibility</span>
                  <span className={styles.tooltipValue}>
                    {tooltipData.visibility}
                  </span>
                </div>
              )}
              {repoSizes[tooltipData.id] && (
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>Repo Size</span>
                  <span className={styles.tooltipValue}>
                    {formatSize(repoSizes[tooltipData.id].sizeKB)}
                  </span>
                </div>
              )}
              {analysisData?.owners?.[tooltipData.id] && (
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>Owner</span>
                  <span className={styles.tooltipValue}>
                    {analysisData.owners[tooltipData.id]}
                  </span>
                </div>
              )}
              {tooltipData.responseTimeMs != null && (
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>Latency</span>
                  <span className={styles.tooltipValue}>
                    {tooltipData.responseTimeMs}ms
                  </span>
                </div>
              )}
              {tooltipData.error && !tooltipData.healthy && (
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>Error</span>
                  <span
                    className={`${styles.tooltipValue} ${styles.tooltipUnhealthy}`}
                  >
                    {tooltipData.error}
                  </span>
                </div>
              )}
              {/* Detected dependencies from code analysis */}
              {analysisData?.dependencies?.[tooltipData.id] &&
                (() => {
                  const detected = analysisData.dependencies[tooltipData.id];
                  const hasImports = detected.imports?.length > 0;
                  const hasApiCalls = detected.apiCalls?.length > 0;
                  if (!hasImports && !hasApiCalls) return null;
                  return (
                    <div className={styles.tooltipDeps}>
                      {hasImports && (
                        <>
                          <span className={styles.tooltipDepLabel}>
                            📦 Imports
                          </span>
                          <span className={styles.tooltipDepList}>
                            {detected.imports
                              .map((i: { target: string }) => i.target)
                              .join(", ")}
                          </span>
                        </>
                      )}
                      {hasApiCalls && (
                        <>
                          <span className={styles.tooltipDepLabel}>
                            🔗 API Calls
                          </span>
                          <span className={styles.tooltipDepList}>
                            {detected.apiCalls
                              .map((a: { target: string }) => a.target)
                              .join(", ")}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })()}
              {(tooltipData.dependsOn?.length ?? 0) > 0 &&
                (() => {
                  const deps = tooltipData.dependsOn!;
                  const required = deps.filter((d) =>
                    typeof d === "string" ? true : d.criticality !== "optional",
                  );
                  const optional = deps.filter((d) =>
                    typeof d === "string"
                      ? false
                      : d.criticality === "optional",
                  );
                  return (
                    <div className={styles.tooltipDeps}>
                      {required.length > 0 && (
                        <>
                          <span className={styles.tooltipDepLabel}>
                            ↑ Requires
                          </span>
                          <span className={styles.tooltipDepList}>
                            {required
                              .map((d) =>
                                typeof d === "string" ? d : d.name,
                              )
                              .join(", ")}
                          </span>
                        </>
                      )}
                      {optional.length > 0 && (
                        <>
                          <span
                            className={`${styles.tooltipDepLabel} ${styles.tooltipDepLabelOptional}`}
                          >
                            ↑ Optional
                          </span>
                          <span
                            className={`${styles.tooltipDepList} ${styles.tooltipDepListOptional}`}
                          >
                            {optional
                              .map((d) =>
                                typeof d === "string" ? d : d.name,
                              )
                              .join(", ")}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
