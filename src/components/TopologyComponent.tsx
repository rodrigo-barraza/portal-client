"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
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
  SearchInputComponent,
  SegmentedControlComponent,
  IconButtonComponent,
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
function getIcon(service: Pick<PortalService, "projectType">) {
  return (
    SERVICE_TYPE_ICONS[service.projectType || ""] || DEFAULT_SERVICE_TYPE_ICON
  );
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
  for (const service of services) {
    const projectType = service.projectType || "Other";
    if (!groupMap.has(projectType)) groupMap.set(projectType, []);
    groupMap.get(projectType)!.push(service);
  }
  // Sort each group alphabetically
  for (const members of groupMap.values())
    members.sort((firstService, secondService) => firstService.name.localeCompare(secondService.name));
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
  const sizes = groups.map((group) => clusterSize(group.members.length, TYPE_MAX_COLS));

  // Arrange into a 2-column grid, tracking max height per row
  const columnWidths = [0, 0];
  for (let i = 0; i < groups.length; i++) {
    const column = i % TYPE_COLS;
    columnWidths[column] = Math.max(columnWidths[column], sizes[i].width);
  }

  let rowY = 0;
  for (let i = 0; i < groups.length; i += TYPE_COLS) {
    let rowMaxH = 0;
    for (let columnIndex = 0; columnIndex < TYPE_COLS && i + columnIndex < groups.length; columnIndex++) {
      const groupIndex = i + columnIndex;
      const { columnCount, height } = sizes[groupIndex];
      const columnX = columnIndex === 0 ? 0 : columnWidths[0] + TYPE_GROUP_GAP_X;
      const clusterX = columnX + (columnWidths[columnIndex] - sizes[groupIndex].width) / 2;
      const clusterY = rowY + LABEL_H;

      groups[groupIndex].members.forEach((service, serviceIndex) => {
        const column2 = serviceIndex % columnCount;
        const row2 = Math.floor(serviceIndex / columnCount);
        positions[service.id] = {
          x: clusterX + CLUSTER_PAD + column2 * (NODE_W + CLUSTER_GAP_X),
          y: clusterY + CLUSTER_PAD + row2 * (NODE_H + CLUSTER_GAP_Y),
        };
      });

      rowMaxH = Math.max(rowMaxH, LABEL_H + height);
    }
    rowY += rowMaxH + TYPE_GROUP_GAP_Y;
  }

  return positions;
}

// ── Fixed tier layering (uses deployTier from project registry) ──
function computeLayers(services: PortalService[]) {
  // Group by deployTier, excluding non-tiered project types
  const tiers: PortalService[][] = [[], [], []];

  for (const service of services) {
    if (NON_TIERED_TYPES.has(service.projectType || "")) continue;
    const tier = Math.min(Math.max(service.deployTier ?? 2, 0), 2);
    tiers[tier].push(service);
  }

  // Sort each tier alphabetically for consistent ordering
  for (const tier of tiers) tier.sort((firstService, secondService) => firstService.name.localeCompare(secondService.name));

  return tiers;
}

// ── Extract non-tiered projects (Library, Kit, Tool) ────────────
function computeLibraries(services: PortalService[]) {
  return services
    .filter((service) => NON_TIERED_TYPES.has(service.projectType || ""))
    .sort((firstService, secondService) => firstService.name.localeCompare(secondService.name));
}

// ── Compute cluster dimensions for a given layer ────────────────
function clusterSize(count: number, maxCols = MAX_COLS) {
  if (count === 0) return { columnCount: 0, rows: 0, width: 0, height: 0 };
  const columnCount = Math.min(count, maxCols);
  const rows = Math.ceil(count / columnCount);
  const clusterWidth =
    columnCount * (NODE_W + CLUSTER_GAP_X) - CLUSTER_GAP_X + CLUSTER_PAD * 2;
  const clusterHeight =
    rows * (NODE_H + CLUSTER_GAP_Y) - CLUSTER_GAP_Y + CLUSTER_PAD * 2;
  return { columnCount, rows, width: clusterWidth, height: clusterHeight };
}

// ── Assign positions from layers (grid clusters) ─────────────────
function layoutNodes(layers: PortalService[][], libraries: PortalService[]) {
  const LABEL_H = 28; // height reserved for tier label above cluster
  const positions: Record<string, NodePosition> = {};

  // ── Libraries column (left side) ──────────────────────────
  const libraryClusterSize = clusterSize(libraries.length, LIBS_MAX_COLS);
  let librariesColumnWidth = 0;

  if (libraries.length > 0) {
    librariesColumnWidth = libraryClusterSize.width + LIBS_GAP;

    libraries.forEach((service, serviceIndex) => {
      const column = serviceIndex % LIBS_MAX_COLS;
      const row = Math.floor(serviceIndex / LIBS_MAX_COLS);
      positions[service.id] = {
        x: CLUSTER_PAD + column * (NODE_W + CLUSTER_GAP_X),
        y: LABEL_H + CLUSTER_PAD + row * (NODE_H + CLUSTER_GAP_Y),
      };
    });
  }

  // ── Tier columns (right side, offset by libs width) ───────
  const sizes = layers.map((layer) => clusterSize(layer.length));
  const maximumClusterWidth = Math.max(...sizes.map((size) => size.width), 0);

  let currentY = 0;

  layers.forEach((layer, layerIndex) => {
    if (!layer.length) return;
    const { columnCount, width, height } = sizes[layerIndex];
    const clusterX = librariesColumnWidth + (maximumClusterWidth - width) / 2;
    const clusterY = currentY + LABEL_H;

    layer.forEach((service, serviceIndex) => {
      const column = serviceIndex % columnCount;
      const row = Math.floor(serviceIndex / columnCount);
      positions[service.id] = {
        x: clusterX + CLUSTER_PAD + column * (NODE_W + CLUSTER_GAP_X),
        y: clusterY + CLUSTER_PAD + row * (NODE_H + CLUSTER_GAP_Y),
      };
    });

    currentY = clusterY + height + TIER_SPACING;
  });

  return { positions, libsColumnW: librariesColumnWidth };
}

// ── Collect edges (with type derived from target's projectType) ──
function collectEdges(services: PortalService[]): TopologyEdge[] {
  const idSet = new Set(services.map((s) => s.id));
  // Build projectType lookup so edge type comes from the canonical registry classification
  const typeMap = new Map<string, string>();
  for (const service of services)
    typeMap.set(service.id, service.projectType || "");

  const edges: TopologyEdge[] = [];
  for (const service of services) {
    for (const dep of service.dependsOn || []) {
      const depId = typeof dep === "string" ? dep : dep.id;
      const criticality =
        typeof dep === "string"
          ? "required"
          : (dep as DependencyRef).criticality || "required";
      const targetType = typeMap.get(depId) || "";
      const type: EdgeType = PROJECT_TYPE_TO_EDGE[targetType] || "api";
      if (idSet.has(depId))
        edges.push({ source: depId, target: service.id, criticality, type });
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

function getPortPoint(position: { x: number; y: number }, side: PortSide) {
  switch (side) {
    case "top":
      return { x: position.x + NODE_W / 2, y: position.y };
    case "bottom":
      return { x: position.x + NODE_W / 2, y: position.y + NODE_H };
    case "left":
      return { x: position.x, y: position.y + NODE_H / 2 };
    case "right":
      return { x: position.x + NODE_W, y: position.y + NODE_H / 2 };
  }
}

function computeEdgeAnchors(
  sourcePosition: { x: number; y: number },
  targetPosition: { x: number; y: number },
): PortResult {
  // Center-to-center delta
  const centerX1 = sourcePosition.x + NODE_W / 2,
    centerY1 = sourcePosition.y + NODE_H / 2;
  const centerX2 = targetPosition.x + NODE_W / 2,
    centerY2 = targetPosition.y + NODE_H / 2;
  const deltaX = centerX2 - centerX1;
  const deltaY = centerY2 - centerY1;
  const absoluteDeltaX = Math.abs(deltaX);
  const absoluteDeltaY = Math.abs(deltaY);

  let side1: PortSide, side2: PortSide;

  // When the vertical gap between nodes is minimal (they're roughly side-by-side),
  // prefer horizontal ports to avoid edges crossing through node bodies
  const verticalOverlap = !(sourcePosition.y + NODE_H < targetPosition.y || targetPosition.y + NODE_H < sourcePosition.y);
  const horizontalOverlap = !(sourcePosition.x + NODE_W < targetPosition.x || targetPosition.x + NODE_W < sourcePosition.x);

  if (verticalOverlap && !horizontalOverlap) {
    // Nodes are side-by-side vertically — use left/right ports
    side1 = deltaX > 0 ? "right" : "left";
    side2 = deltaX > 0 ? "left" : "right";
  } else if (horizontalOverlap && !verticalOverlap) {
    // Nodes are stacked vertically — use top/bottom ports
    side1 = deltaY > 0 ? "bottom" : "top";
    side2 = deltaY > 0 ? "top" : "bottom";
  } else if (absoluteDeltaY >= absoluteDeltaX) {
    // Predominantly vertical relationship
    side1 = deltaY > 0 ? "bottom" : "top";
    side2 = deltaY > 0 ? "top" : "bottom";
  } else {
    // Predominantly horizontal relationship
    side1 = deltaX > 0 ? "right" : "left";
    side2 = deltaX > 0 ? "left" : "right";
  }

  const point1 = getPortPoint(sourcePosition, side1);
  const point2 = getPortPoint(targetPosition, side2);

  return { x1: point1.x, y1: point1.y, side1, x2: point2.x, y2: point2.y, side2 };
}

// Control point offset — extends outward from the port face
function ctrlOffset(side: PortSide, distance: number): { deltaX: number; deltaY: number } {
  const magnitude = Math.max(distance * 0.4, 40);
  switch (side) {
    case "top":
      return { deltaX: 0, deltaY: -magnitude };
    case "bottom":
      return { deltaX: 0, deltaY: magnitude };
    case "left":
      return { deltaX: -magnitude, deltaY: 0 };
    case "right":
      return { deltaX: magnitude, deltaY: 0 };
  }
}

function edgePath(anchor: PortResult): string {
  const { x1, y1, side1, x2, y2, side2 } = anchor;
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const controlPoint1 = ctrlOffset(side1, distance);
  const controlPoint2 = ctrlOffset(side2, distance);
  return `M ${x1} ${y1} C ${x1 + controlPoint1.deltaX} ${y1 + controlPoint1.deltaY}, ${x2 + controlPoint2.deltaX} ${y2 + controlPoint2.deltaY}, ${x2} ${y2}`;
}

// ── Main Component ───────────────────────────────────────────────
export default function TopologyComponent() {
  const [allServices, setAllServices] = useState<PortalService[]>([]);
  const [tierColors, setTierColors] =
    useState<Record<number, DeployTierColor>>(DEPLOY_TIER_COLORS);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [analysisData, setAnalysisData] = useState<ProjectAnalysis | null>(
    null,
  );
  const [repoSizes, setRepoSizes] = useState<
    Record<string, { sizeKB: number; sizeBytes: number }>
  >({});
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tooltipData, setTooltipData] = useState<PortalService | null>(null);

  // View mode toggle
  const [viewMode, setViewMode] = useState<ViewMode>("tier");

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Edge type visibility toggles
  const [edgeVisibility, setEdgeVisibility] = useState<
    Record<EdgeType, boolean>
  >(() => {
    const initialEdgeVisibility: Record<EdgeType, boolean> = {} as Record<EdgeType, boolean>;
    for (const [key, config] of Object.entries(EDGE_TYPE_CONFIG))
      initialEdgeVisibility[key as EdgeType] = config.defaultVisible;
    return initialEdgeVisibility;
  });
  const toggleEdgeType = useCallback((type: EdgeType) => {
    setEdgeVisibility((previousEdgeVisibility) => ({ ...previousEdgeVisibility, [type]: !previousEdgeVisibility[type] }));
  }, []);

  // Project type visibility toggles
  const [typeVisibility, setTypeVisibility] = useState<Record<string, boolean>>(() => {
    const initialTypeVisibility: Record<string, boolean> = {};
    for (const key of Object.keys(SERVICE_TYPE_COLORS)) initialTypeVisibility[key] = true;
    return initialTypeVisibility;
  });
  const toggleTypeVisibility = useCallback((type: string) => {
    setTypeVisibility((previousTypeVisibility) => ({ ...previousTypeVisibility, [type]: !previousTypeVisibility[type] }));
  }, []);

  // Draggable node positions (overrides layout)
  const [positionOverrides, setPositionOverrides] = useState<
    Record<string, NodePosition>
  >({});

  // Pan / zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [draggingNodeState, setDraggingNodeState] = useState<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef(zoom);
  const hasFetchedDataRef = useRef(false);

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
  function mergeAnalysisDeps(
    services: PortalService[],
    analysis: ProjectAnalysis | null,
  ): PortalService[] {
    if (!analysis?.dependencies) return services;

    return services.map((service) => {
      const detected = analysis.dependencies[service.id];
      if (!detected) return service;

      // If analysis found nothing, keep original deps unchanged
      const hasDetected =
        detected.imports?.length > 0 || detected.apiCalls?.length > 0;
      if (!hasDetected) return service;

      // Build a set of existing dep IDs for dedup
      const existingIds = new Set(
        (service.dependsOn || []).map((dep) =>
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

      if (newDeps.length === 0) return service;
      return {
        ...service,
        dependsOn: [...(service.dependsOn || []), ...newDeps],
      };
    });
  }

  async function loadData(refresh = false) {
    try {
      const [servicesRes, analysisRes] = await Promise.all([
        ApiService.getServices(refresh),
        ApiService.getProjectAnalysis(refresh).catch(() => null),
      ]);

      let servicesList: PortalService[] = (
        ((servicesRes as Record<string, unknown>)
          .services as PortalService[]) || []
      ).map((service) => ({
        ...service,
        isInfrastructure: false,
      }));
      const infrastructureServices: PortalService[] = (
        ((servicesRes as Record<string, unknown>)
          .infrastructure as PortalService[]) || []
      ).map((service) => ({
        ...service,
        isInfrastructure: true,
      }));

      // Merge detected dependencies into service data
      if (analysisRes) {
        servicesList = mergeAnalysisDeps(servicesList, analysisRes as ProjectAnalysis);
        setAnalysisData(analysisRes as ProjectAnalysis);
        if ((analysisRes as ProjectAnalysis).repoSizes)
          setRepoSizes((analysisRes as ProjectAnalysis).repoSizes!);
      }

      setAllServices([...servicesList, ...infrastructureServices]);
      if ((servicesRes as Record<string, unknown>).deployTierColors)
        setTierColors(
          (servicesRes as Record<string, unknown>).deployTierColors as Record<
            number,
            DeployTierColor
          >,
        );
    } catch (error) {
      console.error("Topology fetch failed:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  const didCenterRef = useRef(false);

  useEffect(() => {
    if (hasFetchedDataRef.current) return;
    hasFetchedDataRef.current = true;
    loadData(true);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData(true);
  };

  // ── Computed layout ─────────────────────────────────────────
  const filteredServices = useMemo(
    () =>
      allServices.filter(
        (s) => typeVisibility[s.projectType || "Other"] ?? true,
      ),
    [allServices, typeVisibility],
  );

  const layers = useMemo(() => computeLayers(filteredServices), [filteredServices]);
  const libraries = useMemo(() => computeLibraries(filteredServices), [filteredServices]);
  const { positions: tierBasePositions } = useMemo(
    () => layoutNodes(layers, libraries),
    [layers, libraries],
  );
  const typeGroups = useMemo(
    () => computeTypeGroups(filteredServices),
    [filteredServices],
  );
  const typeBasePositions = useMemo(
    () => layoutTypeNodes(typeGroups),
    [typeGroups],
  );

  // Switch base positions based on view mode
  const basePositions =
    viewMode === "tier" ? tierBasePositions : typeBasePositions;

  const allEdges = useMemo(() => collectEdges(filteredServices), [filteredServices]);
  const edges = useMemo(
    () => allEdges.filter((edge) => edgeVisibility[edge.type]),
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
    for (const edge of allEdges) counts[edge.type] = (counts[edge.type] || 0) + 1;
    return counts;
  }, [allEdges]);

  // Merged positions (base + overrides from dragging)
  const positions = useMemo(() => {
    const mergedPositions = { ...basePositions };
    for (const [nodeId, position] of Object.entries(positionOverrides)) {
      if (mergedPositions[nodeId]) mergedPositions[nodeId] = position;
    }
    return mergedPositions;
  }, [basePositions, positionOverrides]);

  // Switch view mode and reset transient state
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setPositionOverrides({});
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
      for (const service of layer) {
        const position = positions[service.id];
        if (!position) continue;
        minX = Math.min(minX, position.x);
        minY = Math.min(minY, position.y);
        maxX = Math.max(maxX, position.x + NODE_W);
        maxY = Math.max(maxY, position.y + NODE_H);
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
  const librariesClusterRect = useMemo(() => {
    if (!libraries.length) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const service of libraries) {
      const position = positions[service.id];
      if (!position) continue;
      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + NODE_W);
      maxY = Math.max(maxY, position.y + NODE_H);
    }
    if (minX === Infinity) return null;
    return {
      x: minX - CLUSTER_PAD,
      y: minY - CLUSTER_PAD,
      width: maxX - minX + CLUSTER_PAD * 2,
      height: maxY - minY + CLUSTER_PAD * 2,
    };
  }, [libraries, positions]);

  const healthyCount = filteredServices.filter((s) => s.healthy).length;

  // ── Search filtering ────────────────────────────────────────
  const searchMatches = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) return null; // null = no filter active
    const matched = new Set();
    for (const service of filteredServices) {
      const haystack = [
        service.name,
        service.device,
        service.projectType,
        service.environment,
        service.url,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (haystack.includes(normalizedSearch)) matched.add(service.id);
    }
    return matched;
  }, [searchQuery, allServices]);

  // Which tier clusters have at least one visible node under search
  const searchVisibleTiers = useMemo(() => {
    if (!searchMatches) return null;
    const visible = new Set();
    layers.forEach((layer, li) => {
      for (const service of layer) {
        if (searchMatches.has(service.id)) {
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
      for (const service of group.members) {
        const position = positions[service.id];
        if (!position) continue;
        minX = Math.min(minX, position.x);
        minY = Math.min(minY, position.y);
        maxX = Math.max(maxX, position.x + NODE_W);
        maxY = Math.max(maxY, position.y + NODE_H);
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
      for (const service of group.members) {
        if (searchMatches.has(service.id)) {
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
    for (const edge of edges) {
      if (!upstream.has(edge.target)) upstream.set(edge.target, []);
      upstream.get(edge.target).push(edge.source);
      if (!downstream.has(edge.source)) downstream.set(edge.source, []);
      downstream.get(edge.source).push(edge.target);
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
    for (const edge of edges) {
      const key = `${edge.source}-${edge.target}`;
      if (!visited.has(edge.source) || !visited.has(edge.target)) continue;

      if (edge.target === selectedNode) {
        dirMap.set(key, "incoming");
      } else if (edge.source === selectedNode) {
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
    (event: React.MouseEvent, service: PortalService) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      setSelectedNode(service.id);
      const position = positions[service.id];
      if (!position) return;
      const svgPos = screenToSvg(event.clientX, event.clientY);
      setDraggingNodeState({
        nodeId: service.id,
        offsetX: svgPos.x - position.x,
        offsetY: svgPos.y - position.y,
      });
    },
    [positions, screenToSvg],
  );

  // ── Cluster (group) drag ────────────────────────────────────
  const handleClusterMouseDown = useCallback(
    (event: React.MouseEvent, clusterType: string, clusterIndex: number) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      setSelectedNode(null);

      const svgPos = screenToSvg(event.clientX, event.clientY);
      let memberIds: string[];
      if (clusterType === "libraries") {
        memberIds = libraries.map((service) => service.id);
      } else if (clusterType === "type") {
        memberIds = (typeGroups[clusterIndex]?.members || []).map((service) => service.id);
      } else {
        memberIds = (layers[clusterIndex] || []).map((service) => service.id);
      }

      // Snapshot current positions of all cluster members
      const originalPositions: Record<string, NodePosition> = {};
      for (const id of memberIds) {
        const position = positions[id];
        if (position) originalPositions[id] = { x: position.x, y: position.y };
      }

      clusterDragging.current = {
        startX: svgPos.x,
        startY: svgPos.y,
        memberIds,
        origPositions: originalPositions,
      };
    },
    [screenToSvg, libraries, layers, typeGroups, positions],
  );

  // ── Canvas pan ──────────────────────────────────────────────
  const handleCanvasMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return;
      const element = event.target as Element;
      if (
        element.closest("[data-topology-node]") ||
        element.closest("[data-topology-cluster]")
      )
        return;
      setSelectedNode(null); // deselect on background click
      setIsPanning(true);
      panStart.current = {
        x: event.clientX,
        y: event.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      // Single node drag
      if (draggingNodeState) {
        const svgPos = screenToSvg(event.clientX, event.clientY);
        setPositionOverrides((previousOverrides) => ({
          ...previousOverrides,
          [draggingNodeState.nodeId]: {
            x: svgPos.x - draggingNodeState.offsetX,
            y: svgPos.y - draggingNodeState.offsetY,
          },
        }));
        return;
      }
      // Cluster (group) drag
      if (clusterDragging.current) {
        const svgPos = screenToSvg(event.clientX, event.clientY);
        const { startX, startY, origPositions } = clusterDragging.current;
        const deltaX = svgPos.x - startX;
        const deltaY = svgPos.y - startY;
        setPositionOverrides((previousOverrides) => {
          const nextOverrides = { ...previousOverrides };
          for (const [nodeId, originalPosition] of Object.entries(origPositions)) {
            nextOverrides[nodeId] = { x: originalPosition.x + deltaX, y: originalPosition.y + deltaY };
          }
          return nextOverrides;
        });
        return;
      }
      // Canvas pan
      if (isPanning) {
        setPan({
          x: panStart.current.panX + (event.clientX - panStart.current.x),
          y: panStart.current.panY + (event.clientY - panStart.current.y),
        });
      }
    },
    [draggingNodeState, isPanning, screenToSvg],
  );

  const handleMouseUp = useCallback(() => {
    if (draggingNodeState) setDraggingNodeState(null);
    if (clusterDragging.current) clusterDragging.current = null;
    if (isPanning) setIsPanning(false);
  }, [draggingNodeState, isPanning]);

  // ── Zoom toward cursor ──────────────────────────────────────
  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const currentZoom = zoomRef.current;
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const next = Math.min(3, Math.max(0.2, currentZoom * delta));
    const ratio = next / currentZoom;
    zoomRef.current = next;
    setPan((previousPan) => ({
      x: mouseX - ratio * (mouseX - previousPan.x),
      y: mouseY - ratio * (mouseY - previousPan.y),
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
    const newZoom = Math.min(3, zoom * 1.25);
    setZoom(newZoom);
    zoomRef.current = newZoom;
  };
  const zoomOut = () => {
    const newZoom = Math.max(0.2, zoom * 0.8);
    setZoom(newZoom);
    zoomRef.current = newZoom;
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
    for (const position of Object.values(basePositions)) {
      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + NODE_W);
      maxY = Math.max(maxY, position.y + NODE_H);
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
  const handleNodeEnter = useCallback(
    (event: React.MouseEvent, service: PortalService) => {
      setHoveredNode(service.id);
      setTooltipPosition({ x: event.clientX, y: event.clientY });
      setTooltipData(service);
    },
    [],
  );

  const handleNodeMove = useCallback(
    (event: React.MouseEvent) => {
      if (hoveredNode) setTooltipPosition({ x: event.clientX, y: event.clientY });
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
        <div className={styles['header-inner']}>
          <div className={styles['header-text']}>
            <h1 className={styles.title}>Topology</h1>
            <p className={styles.subtitle}>
              {isLoading
                ? "Loading…"
                : `${filteredServices.length} services · ${healthyCount} healthy`}
            </p>
          </div>
          <div className={styles['header-actions']}>
            {/* View mode segmented toggle */}
            <SegmentedControlComponent
               value={viewMode}
              onChange={(value: string) => handleViewModeChange(value as "tier" | "type")}
              segments={[
                { value: "tier", label: "By Tier", icon: <Layers size={14} strokeWidth={1.8} /> },
                { value: "type", label: "By Type", icon: <Grid3X3 size={14} strokeWidth={1.8} /> },
              ]}
            />
            <SearchInputComponent
              value={searchQuery}
              onChange={(value: string) => setSearchQuery(value)}
              placeholder="Filter nodes…"
              compact
            />
            <ButtonComponent
              variant="secondary"
              icon={RefreshCw}
              loading={isRefreshing}
              onClick={handleRefresh}
            >
              Refresh
            </ButtonComponent>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingIndicatorComponent
          size="small"
          label="Building topology…"
          className="is-loading-centered-state"
        />
      ) : (
        <>
          <div
            ref={containerRef}
            className={`${styles['canvas-wrapper']}${isPanning ? ` ${styles.panning}` : ""}`}
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
                  const edgePathData = edgePath(anchor);

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
                      className={`${styles['connection-group']}${isSelected ? ` ${styles['connection-flowing']}` : ""}${isFaded ? ` ${styles['edge-faded']}` : ""}`}
                    >
                      <path
                        d={edgePathData}
                        stroke="transparent"
                        strokeWidth={12}
                        fill="none"
                      />
                      {/* Glow layer for directional edges */}
                      {showDirectional && (
                        <path
                          d={edgePathData}
                          stroke={dirConfig.color}
                          strokeWidth={6}
                          fill="none"
                          strokeOpacity={0.12}
                          className={styles['connection-glow']}
                        />
                      )}
                      <path
                        d={edgePathData}
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
                        className={styles['connection-line']}
                      />
                    </g>
                  );
                })}

                {/* ── Tier-view clusters (libs + tiers) ── */}
                {viewMode === "tier" && (
                  <>
                    {/* Libraries cluster background + label */}
                    {librariesClusterRect && (
                      <g
                        className={
                          (selectedNode ? styles['tier-label-faded'] : "") +
                            (searchVisibleTiers &&
                            !libraries.some((service: { id: string }) =>
                              searchMatches?.has(service.id),
                            )
                              ? ` ${styles['tier-label-faded']}`
                              : "") || undefined
                        }
                      >
                        <rect
                          x={librariesClusterRect.x}
                          y={librariesClusterRect.y}
                          width={librariesClusterRect.width}
                          height={librariesClusterRect.height}
                          rx={10}
                          ry={10}
                          className={`${styles['cluster-rect']} ${styles['cluster-draggable']}`}
                          style={{
                            stroke: LIBS_CLUSTER_COLOR.stroke,
                            fill: LIBS_CLUSTER_COLOR.fill,
                          }}
                          data-topology-cluster
                          onMouseDown={(event) =>
                            handleClusterMouseDown(event, "libraries", -1)
                          }
                        />
                        {/* Drag handle icon */}
                        <foreignObject
                          x={librariesClusterRect.x + 8}
                          y={librariesClusterRect.y + 6}
                          width={16}
                          height={16}
                          className={styles['cluster-drag-handle']}
                          data-topology-cluster
                          onMouseDown={(event) =>
                            handleClusterMouseDown(event, "libraries", -1)
                          }
                        >
                          <Move size={12} strokeWidth={1.5} />
                        </foreignObject>
                        <text
                          x={librariesClusterRect.x + librariesClusterRect.width / 2}
                          y={librariesClusterRect.y - 10}
                          className={styles['tier-label']}
                          textAnchor="middle"
                          dominantBaseline="auto"
                        >
                          {LIBS_LABEL}
                        </text>
                      </g>
                    )}

                    {/* Tier cluster backgrounds + labels */}
                    {dynamicClusterRects.map((clusterRect, tierIndex) => {
                      if (!clusterRect) return null;
                      const typeConfig =
                        tierColors[tierIndex] ||
                        DEPLOY_TIER_COLORS[tierIndex] ||
                        DEPLOY_TIER_COLORS[0];
                      return (
                        <g
                          key={`cluster-${tierIndex}`}
                          className={
                            (selectedNode ? styles['tier-label-faded'] : "") +
                              (searchVisibleTiers && !searchVisibleTiers.has(tierIndex)
                                ? ` ${styles['tier-label-faded']}`
                                : "") || undefined
                          }
                        >
                          <rect
                            x={clusterRect.x}
                            y={clusterRect.y}
                            width={clusterRect.w}
                            height={clusterRect.h}
                            rx={10}
                            ry={10}
                            className={`${styles['cluster-rect']} ${styles['cluster-draggable']}`}
                            style={{
                              stroke: typeConfig.stroke,
                              fill: typeConfig.fill,
                            }}
                            data-topology-cluster
                            onMouseDown={(event) =>
                              handleClusterMouseDown(event, "tier", tierIndex)
                            }
                          />
                          {/* Drag handle icon */}
                          <foreignObject
                            x={clusterRect.x + 8}
                            y={clusterRect.y + 6}
                            width={16}
                            height={16}
                            className={styles['cluster-drag-handle']}
                            data-topology-cluster
                            onMouseDown={(event) =>
                              handleClusterMouseDown(event, "tier", tierIndex)
                            }
                          >
                            <Move size={12} strokeWidth={1.5} />
                          </foreignObject>
                          <text
                            x={clusterRect.x + clusterRect.w / 2}
                            y={clusterRect.y - 10}
                            className={styles['tier-label']}
                            textAnchor="middle"
                            dominantBaseline="auto"
                          >
                            {TIER_LABELS[tierIndex] || `Tier ${tierIndex}`}
                          </text>
                        </g>
                      );
                    })}
                  </>
                )}

                {/* ── Type-view clusters ── */}
                {viewMode === "type" &&
                  typeClusterRects.map((clusterRect, groupIndex) => {
                    if (!clusterRect) return null;
                    const group = typeGroups[groupIndex];
                    const typeConfig =
                      SERVICE_TYPE_COLORS[group.type] ||
                      SERVICE_TYPE_COLORS.Service;
                    const isFadedBySearch =
                      searchVisibleTypes && !searchVisibleTypes.has(group.type);
                    return (
                      <g
                        key={`type-cluster-${group.type}`}
                        className={
                          (selectedNode ? styles['tier-label-faded'] : "") +
                            (isFadedBySearch
                              ? ` ${styles['tier-label-faded']}`
                              : "") || undefined
                        }
                      >
                        <rect
                          x={clusterRect.x}
                          y={clusterRect.y}
                          width={clusterRect.w}
                          height={clusterRect.h}
                          rx={10}
                          ry={10}
                          className={`${styles['cluster-rect']} ${styles['cluster-draggable']}`}
                          style={{
                            stroke: `color-mix(in srgb, ${typeConfig.color} 35%, transparent)`,
                            fill: `color-mix(in srgb, ${typeConfig.color} 4%, transparent)`,
                          }}
                          data-topology-cluster
                          onMouseDown={(event) =>
                            handleClusterMouseDown(event, "type", groupIndex)
                          }
                        />
                        <foreignObject
                          x={clusterRect.x + 8}
                          y={clusterRect.y + 6}
                          width={16}
                          height={16}
                          className={styles['cluster-drag-handle']}
                          data-topology-cluster
                          onMouseDown={(event) =>
                            handleClusterMouseDown(event, "type", groupIndex)
                          }
                        >
                          <Move size={12} strokeWidth={1.5} />
                        </foreignObject>
                        <text
                          x={clusterRect.x + clusterRect.w / 2}
                          y={clusterRect.y - 10}
                          className={styles['tier-label']}
                          textAnchor="middle"
                          dominantBaseline="auto"
                          style={{ fill: typeConfig.color }}
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
                {filteredServices.map((service: PortalService) => {
                  const position = positions[service.id];
                  if (!position) return null;
                  const Icon = getIcon(service);
                  const isHov = hoveredNode === service.id;
                  const isDragging = draggingNodeState?.nodeId === service.id;
                  const isFadedBySelection =
                    selectedNode && !connectedNodes.has(service.id);
                  const isFadedBySearch =
                    searchMatches && !searchMatches.has(service.id);
                  const isFaded = isFadedBySelection || isFadedBySearch;

                  const ptc =
                    SERVICE_TYPE_COLORS[service.projectType as string] ||
                    SERVICE_TYPE_COLORS.Service;
                  const healthClass = service.healthy
                    ? styles['node-healthy']
                    : styles['node-down'];
                  const nodeColor = service.healthy ? ptc.color : undefined;

                  return (
                    <foreignObject
                      key={service.id}
                      x={position.x}
                      y={position.y}
                      width={NODE_W}
                      height={NODE_H}
                      data-topology-node
                      style={{ overflow: "visible" }}
                    >
                      <div
                        className={`${styles['node-card']} ${healthClass} ${isHov ? styles['node-hovered'] : ""} ${isDragging ? styles['node-dragging'] : ""} ${selectedNode === service.id ? styles['node-selected'] : ""}${isFaded ? ` ${styles['node-faded']}` : ""}`}
                        onMouseDown={(event) => handleNodeMouseDown(event, service)}
                        onMouseEnter={(event) => handleNodeEnter(event, service)}
                        onMouseMove={handleNodeMove}
                        onMouseLeave={handleNodeLeave}
                        style={
                          service.healthy
                            ? {
                                borderColor: `color-mix(in srgb, ${ptc.color} 15%, transparent)`,
                              }
                            : undefined
                        }
                      >
                        <div
                          className={styles['node-glow']}
                          style={
                            nodeColor
                              ? { boxShadow: `0 0 20px ${ptc.subtle}` }
                              : undefined
                          }
                        />
                        {!NON_TIERED_TYPES.has(
                          service.projectType as string,
                        ) && (
                          <div
                            className={`${styles['status-dot']} ${service.healthy ? styles['status-healthy'] : styles['status-down']}`}
                          />
                        )}
                        <div
                          className={styles['node-icon-wrap']}
                          style={nodeColor ? { color: nodeColor } : undefined}
                        >
                          <Icon size={18} strokeWidth={1.5} />
                        </div>
                        <span className={styles['node-name']}>{service.name}</span>
                        {repoSizes[service.id] ? (
                          <span className={styles['node-size']}>
                            <HardDrive size={9} strokeWidth={1.5} />
                            {formatSize(repoSizes[service.id].sizeKB)}
                          </span>
                        ) : service.device ? (
                          <span className={styles['node-host']}>
                            {service.device}
                          </span>
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
            <div className={styles['legend-title']}>Nodes</div>
            <div className={styles['legend-item']}>
              <div
                className={styles['legend-dot']}
                style={{
                  background: "var(--color-success)",
                  boxShadow: "0 0 6px var(--success-subtle)",
                }}
              />
              <span>Healthy</span>
            </div>
            <div className={styles['legend-item']}>
              <div
                className={styles['legend-dot']}
                style={{
                  background: "var(--color-danger)",
                  boxShadow: "0 0 6px var(--danger-subtle)",
                }}
              />
              <span>Down</span>
            </div>
            <div className={styles['legend-sep']} />
            {Object.entries(SERVICE_TYPE_COLORS).map(([type, colors]) => {
              const visible = typeVisibility[type] ?? true;
              return (
                <div
                  key={type}
                  className={`${styles['legend-item']} ${styles['legend-toggle']}${!visible ? ` ${styles['legend-toggle-off']}` : ""}`}
                  onClick={() => toggleTypeVisibility(type)}
                  title={`${visible ? "Hide" : "Show"} ${type}s`}
                >
                  <div
                    className={styles['legend-dot']}
                    style={{
                      background: colors.color,
                      boxShadow: `0 0 6px ${colors.subtle}`,
                      opacity: visible ? 1 : 0.3,
                    }}
                  />
                  <span>{type}</span>
                  {visible ? (
                    <Eye
                      size={11}
                      strokeWidth={1.5}
                      className={styles['legend-eye-icon']}
                    />
                  ) : (
                    <EyeOff
                      size={11}
                      strokeWidth={1.5}
                      className={styles['legend-eye-icon']}
                    />
                  )}
                </div>
              );
            })}
            <div className={styles['legend-sep']} />
            <div className={styles['legend-title']}>Connections</div>
            {(
              Object.entries(EDGE_TYPE_CONFIG) as [
                EdgeType,
                (typeof EDGE_TYPE_CONFIG)[EdgeType],
              ][]
            ).map(([type, config]) => {
              const visible = edgeVisibility[type];
              const count = edgeTypeCounts[type] || 0;
              return (
                <div
                  key={type}
                  className={`${styles['legend-item']} ${styles['legend-toggle']}${!visible ? ` ${styles['legend-toggle-off']}` : ""}`}
                  onClick={() => toggleEdgeType(type)}
                  title={`${visible ? "Hide" : "Show"} ${config.label} (${count})`}
                >
                  <div
                    className={styles['legend-edge-line']}
                    style={{
                      borderTopColor: config.color,
                      borderTopStyle: config.dash === "none" ? "solid" : "dashed",
                      borderTopWidth: `${Math.max(config.width, 1.5)}px`,
                      opacity: visible ? 1 : 0.3,
                    }}
                  />
                  <span>{config.label}</span>
                  <span className={styles['legend-count']}>{count}</span>
                  {visible ? (
                    <Eye
                      size={11}
                      strokeWidth={1.5}
                      className={styles['legend-eye-icon']}
                    />
                  ) : (
                    <EyeOff
                      size={11}
                      strokeWidth={1.5}
                      className={styles['legend-eye-icon']}
                    />
                  )}
                </div>
              );
            })}
            <div className={styles['legend-sep']} />
            <div className={styles['legend-item']}>
              <div className={styles['legend-line']} />
              <span>Required</span>
            </div>
            <div className={styles['legend-item']}>
              <div
                className={styles['legend-line']}
                style={{ borderTopStyle: "dashed", opacity: 0.5 }}
              />
              <span>Optional</span>
            </div>
            {selectedNode && (
              <>
                <div className={styles['legend-sep']} />
                <div className={styles['legend-title']}>Selected</div>
                <div className={styles['legend-item']}>
                  <div
                    className={styles['legend-edge-line']}
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
                <div className={styles['legend-item']}>
                  <div
                    className={styles['legend-edge-line']}
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
                <div className={styles['legend-item']}>
                  <div
                    className={styles['legend-edge-line']}
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
          <div className={styles['zoom-controls']}>
            <IconButtonComponent
              icon={<ZoomIn size={15} strokeWidth={1.8} />}
              onClick={zoomIn}
              tooltip="Zoom in"
              className={styles['zoom-button']}
            />
            <IconButtonComponent
              icon={<ZoomOut size={15} strokeWidth={1.8} />}
              onClick={zoomOut}
              tooltip="Zoom out"
              className={styles['zoom-button']}
            />
            <IconButtonComponent
              icon={<Maximize2 size={14} strokeWidth={1.8} />}
              onClick={zoomFit}
              tooltip="Fit to view"
              className={styles['zoom-button']}
            />
          </div>

          {/* Tooltip */}
          {tooltipData && (
            <div
              className={styles.tooltip}
              style={{
                left: Math.min(
                  tooltipPosition.x + 16,
                  (typeof window !== "undefined" ? window.innerWidth : 1000) -
                    300,
                ),
                top: tooltipPosition.y - 10,
              }}
            >
              <div className={styles['tooltip-name']}>{tooltipData.name}</div>
              <div className={styles['tooltip-row']}>
                <span className={styles['tooltip-label']}>Status</span>
                <span
                  className={`${styles['tooltip-value']} ${tooltipData.healthy ? styles['tooltip-healthy'] : styles['tooltip-unhealthy']}`}
                >
                  {tooltipData.healthy ? "Healthy" : "Down"}
                </span>
              </div>
              {tooltipData.device && (
                <div className={styles['tooltip-row']}>
                  <span className={styles['tooltip-label']}>Device</span>
                  <span className={styles['tooltip-value']}>
                    {tooltipData.device}
                  </span>
                </div>
              )}
              {tooltipData.url && (
                <div className={styles['tooltip-row']}>
                  <span className={styles['tooltip-label']}>URL</span>
                  <span className={styles['tooltip-value']}>{tooltipData.url}</span>
                </div>
              )}
              <div className={styles['tooltip-row']}>
                <span className={styles['tooltip-label']}>Environment</span>
                <span className={styles['tooltip-value']}>
                  {tooltipData.environment}
                </span>
              </div>
              {tooltipData.visibility && (
                <div className={styles['tooltip-row']}>
                  <span className={styles['tooltip-label']}>Visibility</span>
                  <span className={styles['tooltip-value']}>
                    {tooltipData.visibility}
                  </span>
                </div>
              )}
              {repoSizes[tooltipData.id] && (
                <div className={styles['tooltip-row']}>
                  <span className={styles['tooltip-label']}>Repo Size</span>
                  <span className={styles['tooltip-value']}>
                    {formatSize(repoSizes[tooltipData.id].sizeKB)}
                  </span>
                </div>
              )}
              {analysisData?.owners?.[tooltipData.id] && (
                <div className={styles['tooltip-row']}>
                  <span className={styles['tooltip-label']}>Owner</span>
                  <span className={styles['tooltip-value']}>
                    {analysisData.owners[tooltipData.id]}
                  </span>
                </div>
              )}
              {tooltipData.responseTimeMs != null && (
                <div className={styles['tooltip-row']}>
                  <span className={styles['tooltip-label']}>Latency</span>
                  <span className={styles['tooltip-value']}>
                    {tooltipData.responseTimeMs}ms
                  </span>
                </div>
              )}
              {tooltipData.error && !tooltipData.healthy && (
                <div className={styles['tooltip-row']}>
                  <span className={styles['tooltip-label']}>Error</span>
                  <span
                    className={`${styles['tooltip-value']} ${styles['tooltip-unhealthy']}`}
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
                    <div className={styles['tooltip-deps']}>
                      {hasImports && (
                        <>
                          <span className={styles['tooltip-dep-label']}>
                            📦 Imports
                          </span>
                          <span className={styles['tooltip-dep-list']}>
                            {detected.imports
                              .map((i: { target: string }) => i.target)
                              .join(", ")}
                          </span>
                        </>
                      )}
                      {hasApiCalls && (
                        <>
                          <span className={styles['tooltip-dep-label']}>
                            🔗 API Calls
                          </span>
                          <span className={styles['tooltip-dep-list']}>
                             {detected.apiCalls
                               .map((apiCall: { target: string }) => apiCall.target)
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
                  const required = deps.filter((data) =>
                    typeof data === "string" ? true : data.criticality !== "optional",
                  );
                  const optional = deps.filter((data) =>
                    typeof data === "string"
                      ? false
                      : data.criticality === "optional",
                  );
                  return (
                    <div className={styles['tooltip-deps']}>
                      {required.length > 0 && (
                        <>
                          <span className={styles['tooltip-dep-label']}>
                            ↑ Requires
                          </span>
                          <span className={styles['tooltip-dep-list']}>
                            {required
                              .map((data) => (typeof data === "string" ? data : data.name))
                              .join(", ")}
                          </span>
                        </>
                      )}
                      {optional.length > 0 && (
                        <>
                          <span
                            className={`${styles['tooltip-dep-label']} ${styles['tooltip-dep-label-optional']}`}
                          >
                            ↑ Optional
                          </span>
                          <span
                            className={`${styles['tooltip-dep-list']} ${styles['tooltip-dep-list-optional']}`}
                          >
                            {optional
                              .map((data) => (typeof data === "string" ? data : data.name))
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
