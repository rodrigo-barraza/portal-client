/**
 * Pure topology math — grouping, grid layout, edge collection/routing,
 * selection walks, search matching and viewport fitting. Nothing here
 * touches React or the DOM, so every piece is unit-tested directly.
 */

import { clamp } from "@rodrigo-barraza/utilities-library";
import type {
  DependencyRef,
  EdgeType,
  NodePosition,
  PortalService,
  ProjectAnalysis,
  ServicesResponse,
  TopologyEdge,
} from "../../types/portal";

// ── Dimensions ───────────────────────────────────────────────────
export const NODE_W = 130;
export const NODE_H = 64;
const MAX_COLS = 5; // max nodes per row inside a cluster
const CLUSTER_GAP_X = 32; // horizontal gap between nodes inside a cluster
const CLUSTER_GAP_Y = 16; // vertical gap between rows inside a cluster
export const CLUSTER_PAD = 24; // padding inside cluster rect
const LABEL_H = 28; // height reserved for a cluster label above its rect
const TIER_SPACING = 60; // vertical gap between tier clusters
const LIBS_GAP = 80; // horizontal gap between libs column and tier column
const LIBS_MAX_COLS = 2; // max columns in the libraries cluster
const TYPE_MAX_COLS = 4; // max columns per type-group cluster
const TYPE_COLS = 2; // number of columns in the type-group grid
const TYPE_GROUP_GAP_X = 80; // horizontal gap between type-group clusters
const TYPE_GROUP_GAP_Y = 60; // vertical gap between type-group rows

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3;

export type ViewMode = "tier" | "type";

/** Canonical projectType ordering for the "by type" layout. */
export const TYPE_ORDER = [
  "Service",
  "Client",
  "Bot",
  "Library",
  "Kit",
  "Tool",
  "Database",
  "Store",
];

/** Project types rendered in their own column instead of a deploy tier. */
export const NON_TIERED_TYPES = new Set(["Library", "Kit", "Tool"]);

/**
 * projectType of an edge's TARGET → relationship type. Anything the
 * registry files under infrastructure (databases, stores, inference
 * servers) is an infrastructure edge; unknown types are API calls.
 */
const PROJECT_TYPE_TO_EDGE: Record<string, EdgeType> = {
  Library: "import",
  Kit: "tooling",
  Tool: "tooling",
  Database: "infra",
  Store: "infra",
  Inference: "infra",
  Infrastructure: "infra",
};

// Cluster labels in the type view — irregular plurals and mass nouns.
const TYPE_CLUSTER_LABELS: Record<string, string> = {
  Kit: "Toolkits",
  Library: "Libraries",
  Inference: "Inference",
  Infrastructure: "Infrastructure",
};

export function typeClusterLabel(type: string): string {
  return TYPE_CLUSTER_LABELS[type] ?? `${type}s`;
}

const byName = (first: PortalService, second: PortalService) =>
  first.name.localeCompare(second.name);

// ── Grouping ─────────────────────────────────────────────────────

export interface TypeGroup {
  type: string;
  members: PortalService[];
}

/** Group services by projectType — canonical order first, then extras. */
export function computeTypeGroups(services: PortalService[]): TypeGroup[] {
  const groupMap = new Map<string, PortalService[]>();
  for (const service of services) {
    const projectType = service.projectType || "Other";
    const members = groupMap.get(projectType);
    if (members) members.push(service);
    else groupMap.set(projectType, [service]);
  }
  for (const members of groupMap.values()) members.sort(byName);

  const result: TypeGroup[] = [];
  for (const typeName of TYPE_ORDER) {
    const members = groupMap.get(typeName);
    if (!members) continue;
    result.push({ type: typeName, members });
    groupMap.delete(typeName);
  }
  for (const [typeName, members] of groupMap)
    result.push({ type: typeName, members });
  return result;
}

/** Deploy-tier layers (0–2); non-tiered project types are left out. */
export function computeLayers(services: PortalService[]): PortalService[][] {
  const tiers: PortalService[][] = [[], [], []];
  for (const service of services) {
    if (NON_TIERED_TYPES.has(service.projectType || "")) continue;
    tiers[clamp(service.deployTier ?? 2, 0, 2)].push(service);
  }
  for (const tier of tiers) tier.sort(byName);
  return tiers;
}

/** Library / Kit / Tool projects, alphabetically. */
export function computeLibraries(services: PortalService[]): PortalService[] {
  return services
    .filter((service) => NON_TIERED_TYPES.has(service.projectType || ""))
    .sort(byName);
}

// ── Grid layout ──────────────────────────────────────────────────

export function clusterSize(count: number, maxCols = MAX_COLS) {
  if (count === 0) return { columnCount: 0, rows: 0, width: 0, height: 0 };
  const columnCount = Math.min(count, maxCols);
  const rows = Math.ceil(count / columnCount);
  return {
    columnCount,
    rows,
    width:
      columnCount * (NODE_W + CLUSTER_GAP_X) - CLUSTER_GAP_X + CLUSTER_PAD * 2,
    height: rows * (NODE_H + CLUSTER_GAP_Y) - CLUSTER_GAP_Y + CLUSTER_PAD * 2,
  };
}

/** Place `members` on a grid whose cluster rect starts at (originX, originY). */
function placeGrid(
  positions: Record<string, NodePosition>,
  members: PortalService[],
  columnCount: number,
  originX: number,
  originY: number,
) {
  members.forEach((service, index) => {
    positions[service.id] = {
      x:
        originX +
        CLUSTER_PAD +
        (index % columnCount) * (NODE_W + CLUSTER_GAP_X),
      y:
        originY +
        CLUSTER_PAD +
        Math.floor(index / columnCount) * (NODE_H + CLUSTER_GAP_Y),
    };
  });
}

/** "By tier" layout: libraries column on the left, tier clusters stacked on the right. */
export function layoutTierNodes(
  layers: PortalService[][],
  libraries: PortalService[],
): Record<string, NodePosition> {
  const positions: Record<string, NodePosition> = {};

  let librariesColumnWidth = 0;
  if (libraries.length > 0) {
    librariesColumnWidth =
      clusterSize(libraries.length, LIBS_MAX_COLS).width + LIBS_GAP;
    placeGrid(positions, libraries, LIBS_MAX_COLS, 0, LABEL_H);
  }

  const sizes = layers.map((layer) => clusterSize(layer.length));
  const widestCluster = Math.max(...sizes.map((size) => size.width), 0);

  let currentY = 0;
  layers.forEach((layer, layerIndex) => {
    if (!layer.length) return;
    const { columnCount, width, height } = sizes[layerIndex];
    const clusterX = librariesColumnWidth + (widestCluster - width) / 2;
    const clusterY = currentY + LABEL_H;
    placeGrid(positions, layer, columnCount, clusterX, clusterY);
    currentY = clusterY + height + TIER_SPACING;
  });

  return positions;
}

/** "By type" layout: a TYPE_COLS-wide grid of type clusters. */
export function layoutTypeNodes(
  groups: TypeGroup[],
): Record<string, NodePosition> {
  const positions: Record<string, NodePosition> = {};
  const sizes = groups.map((group) =>
    clusterSize(group.members.length, TYPE_MAX_COLS),
  );

  const columnWidths = Array.from({ length: TYPE_COLS }, () => 0);
  sizes.forEach((size, index) => {
    const column = index % TYPE_COLS;
    columnWidths[column] = Math.max(columnWidths[column], size.width);
  });
  const columnOffsets = columnWidths.map((_, column) =>
    columnWidths
      .slice(0, column)
      .reduce((sum, width) => sum + width + TYPE_GROUP_GAP_X, 0),
  );

  let rowY = 0;
  for (let rowStart = 0; rowStart < groups.length; rowStart += TYPE_COLS) {
    let rowHeight = 0;
    for (
      let column = 0;
      column < TYPE_COLS && rowStart + column < groups.length;
      column++
    ) {
      const size = sizes[rowStart + column];
      const clusterX =
        columnOffsets[column] + (columnWidths[column] - size.width) / 2;
      placeGrid(
        positions,
        groups[rowStart + column].members,
        size.columnCount,
        clusterX,
        rowY + LABEL_H,
      );
      rowHeight = Math.max(rowHeight, LABEL_H + size.height);
    }
    rowY += rowHeight + TYPE_GROUP_GAP_Y;
  }

  return positions;
}

// ── Data shaping ─────────────────────────────────────────────────

const dependencyId = (dependency: string | DependencyRef) =>
  typeof dependency === "string" ? dependency : dependency.id;

/**
 * Supplement each service's registry `dependsOn` with dependencies the
 * code analysis detected (imports / API calls) that the registry lacks.
 * Registry edges always win; services with no detections are untouched.
 */
export function mergeAnalysisDeps(
  services: PortalService[],
  analysis: ProjectAnalysis | null,
): PortalService[] {
  if (!analysis?.dependencies) return services;

  return services.map((service) => {
    const detected = analysis.dependencies[service.id];
    if (!detected) return service;

    const existingIds = new Set((service.dependsOn || []).map(dependencyId));
    const newDependencies: DependencyRef[] = [];
    for (const { target } of [
      ...(detected.imports || []),
      ...(detected.apiCalls || []),
    ]) {
      if (existingIds.has(target)) continue;
      existingIds.add(target);
      newDependencies.push({
        id: target,
        name: target,
        criticality: "required",
        source: "detected",
      });
    }

    if (newDependencies.length === 0) return service;
    return {
      ...service,
      dependsOn: [...(service.dependsOn || []), ...newDependencies],
    };
  });
}

/** Flatten the /services response into one node list, analysis edges merged in. */
export function buildTopologyServices(
  response: Partial<ServicesResponse> | null | undefined,
  analysis: ProjectAnalysis | null,
): PortalService[] {
  const services = (response?.services || []).map((service) => ({
    ...service,
    isInfrastructure: false,
  }));
  const infrastructure = (response?.infrastructure || []).map((service) => ({
    ...service,
    isInfrastructure: true,
  }));
  return [...mergeAnalysisDeps(services, analysis), ...infrastructure];
}

/** Stable identity for a directed edge (ids may themselves contain hyphens). */
export function edgeKey(source: string, target: string): string {
  return `${source}→${target}`;
}

/**
 * Collect dependency edges (dependency → dependent) between services in
 * the set. Edge type comes from the target's registry projectType; self
 * loops and duplicate declarations are dropped (first declaration wins).
 */
export function collectEdges(services: PortalService[]): TopologyEdge[] {
  const typeById = new Map(
    services.map((service) => [service.id, service.projectType || ""]),
  );
  const seen = new Set<string>();
  const edges: TopologyEdge[] = [];

  for (const service of services) {
    for (const dependency of service.dependsOn || []) {
      const source = dependencyId(dependency);
      if (source === service.id || !typeById.has(source)) continue;
      const key = edgeKey(source, service.id);
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        source,
        target: service.id,
        criticality:
          typeof dependency === "string"
            ? "required"
            : dependency.criticality || "required",
        type: PROJECT_TYPE_TO_EDGE[typeById.get(source) || ""] || "api",
      });
    }
  }
  return edges;
}

// ── Edge routing ─────────────────────────────────────────────────
// Picks the best connection side for each end from the relative
// positions, then draws a direction-aware cubic Bézier whose control
// points extend outward from the port faces.

export type PortSide = "top" | "bottom" | "left" | "right";

export interface EdgeAnchor {
  x1: number;
  y1: number;
  side1: PortSide;
  x2: number;
  y2: number;
  side2: PortSide;
}

function portPoint(position: NodePosition, side: PortSide): NodePosition {
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

export function computeEdgeAnchors(
  source: NodePosition,
  target: NodePosition,
): EdgeAnchor {
  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;

  const verticalOverlap = !(
    source.y + NODE_H < target.y || target.y + NODE_H < source.y
  );
  const horizontalOverlap = !(
    source.x + NODE_W < target.x || target.x + NODE_W < source.x
  );

  // Side-by-side nodes use left/right ports, stacked nodes top/bottom —
  // otherwise whichever axis dominates the center-to-center delta.
  const useHorizontal =
    verticalOverlap && !horizontalOverlap
      ? true
      : horizontalOverlap && !verticalOverlap
        ? false
        : Math.abs(deltaX) > Math.abs(deltaY);

  const side1: PortSide = useHorizontal
    ? deltaX > 0
      ? "right"
      : "left"
    : deltaY > 0
      ? "bottom"
      : "top";
  const side2: PortSide = useHorizontal
    ? deltaX > 0
      ? "left"
      : "right"
    : deltaY > 0
      ? "top"
      : "bottom";

  const point1 = portPoint(source, side1);
  const point2 = portPoint(target, side2);
  return {
    x1: point1.x,
    y1: point1.y,
    side1,
    x2: point2.x,
    y2: point2.y,
    side2,
  };
}

function controlOffset(side: PortSide, distance: number) {
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

export function edgePath({ x1, y1, side1, x2, y2, side2 }: EdgeAnchor): string {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const control1 = controlOffset(side1, distance);
  const control2 = controlOffset(side2, distance);
  return `M ${x1} ${y1} C ${x1 + control1.deltaX} ${y1 + control1.deltaY}, ${x2 + control2.deltaX} ${y2 + control2.deltaY}, ${x2} ${y2}`;
}

// ── Selection / search ───────────────────────────────────────────

export type EdgeDirection = "incoming" | "outgoing" | "network";

export interface Selection {
  connectedNodes: Set<string>;
  edgeDirections: Map<string, EdgeDirection>;
}

/**
 * The selected node's full upstream dependency chain plus its immediate
 * consumers. Edges between connected nodes are classified: `incoming`
 * flows into the selection, `outgoing` flows out of it, `network` is a
 * transitive edge between two other connected nodes.
 */
export function computeSelection(
  selectedId: string | null,
  edges: TopologyEdge[],
): Selection {
  const connectedNodes = new Set<string>();
  const edgeDirections = new Map<string, EdgeDirection>();
  if (!selectedId) return { connectedNodes, edgeDirections };

  const dependenciesOf = new Map<string, string[]>();
  const consumersOf = new Map<string, string[]>();
  const append = (map: Map<string, string[]>, key: string, value: string) => {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  };
  for (const edge of edges) {
    append(dependenciesOf, edge.target, edge.source);
    append(consumersOf, edge.source, edge.target);
  }

  connectedNodes.add(selectedId);
  const queue = [selectedId];
  for (let index = 0; index < queue.length; index++) {
    for (const dependency of dependenciesOf.get(queue[index]) || []) {
      if (connectedNodes.has(dependency)) continue;
      connectedNodes.add(dependency);
      queue.push(dependency);
    }
  }
  for (const consumer of consumersOf.get(selectedId) || [])
    connectedNodes.add(consumer);

  for (const edge of edges) {
    if (!connectedNodes.has(edge.source) || !connectedNodes.has(edge.target))
      continue;
    edgeDirections.set(
      edgeKey(edge.source, edge.target),
      edge.target === selectedId
        ? "incoming"
        : edge.source === selectedId
          ? "outgoing"
          : "network",
    );
  }
  return { connectedNodes, edgeDirections };
}

/** Ids of services matching the query (name/device/type/env/url), or null when no query. */
export function matchServices(
  services: PortalService[],
  query: string,
): Set<string> | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  const matches = new Set<string>();
  for (const service of services) {
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
    if (haystack.includes(needle)) matches.add(service.id);
  }
  return matches;
}

// ── Geometry / viewport ──────────────────────────────────────────

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bounding box of the given nodes (node footprint, no padding), or null if none are placed. */
export function nodeBounds(
  ids: Iterable<string>,
  positions: Record<string, NodePosition>,
): Rect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of ids) {
    const position = positions[id];
    if (!position) continue;
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + NODE_W);
    maxY = Math.max(maxY, position.y + NODE_H);
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Cluster frame around the given nodes — their bounds plus CLUSTER_PAD. */
export function clusterRect(
  ids: Iterable<string>,
  positions: Record<string, NodePosition>,
): Rect | null {
  const bounds = nodeBounds(ids, positions);
  if (!bounds) return null;
  return {
    x: bounds.x - CLUSTER_PAD,
    y: bounds.y - CLUSTER_PAD,
    width: bounds.width + CLUSTER_PAD * 2,
    height: bounds.height + CLUSTER_PAD * 2,
  };
}

export interface Viewport {
  pan: NodePosition;
  zoom: number;
}

/** Pan/zoom that centers `bounds` in a viewport, leaving `padFraction` on each side. */
export function fitViewport(
  bounds: Rect,
  viewportWidth: number,
  viewportHeight: number,
  { padFraction = 0.08, maxZoom = 1.4 } = {},
): Viewport | null {
  if (viewportWidth <= 0 || viewportHeight <= 0) return null;
  // No lower clamp: a large graph in a small viewport must still fit.
  const zoom = Math.min(
    (viewportWidth * (1 - padFraction * 2)) / bounds.width,
    (viewportHeight * (1 - padFraction * 2)) / bounds.height,
    maxZoom,
  );
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  return {
    pan: {
      x: viewportWidth / 2 - centerX * zoom,
      y: viewportHeight / 2 - centerY * zoom,
    },
    zoom,
  };
}

/**
 * Scale the zoom by `factor`, keeping the content under `point` (viewport
 * px) fixed. A fit below MIN_ZOOM is never pushed further out, nor snapped.
 */
export function zoomAtPoint(
  viewport: Viewport,
  point: NodePosition,
  factor: number,
): Viewport {
  const zoom = clamp(
    viewport.zoom * factor,
    Math.min(MIN_ZOOM, viewport.zoom),
    MAX_ZOOM,
  );
  const ratio = zoom / viewport.zoom;
  return {
    pan: {
      x: point.x - ratio * (point.x - viewport.pan.x),
      y: point.y - ratio * (point.y - viewport.pan.y),
    },
    zoom,
  };
}
