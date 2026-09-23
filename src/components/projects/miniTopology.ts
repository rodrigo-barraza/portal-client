import type { PortalService } from "@/types/portal";

/**
 * Layout for the Projects drawer's mini dependency graph: the project, its
 * whole upstream chain and its direct dependents, one row per deploy tier.
 */

export const MINI_NODE_WIDTH = 110;
export const MINI_NODE_HEIGHT = 52;
const GAP_X = 20;
const GAP_Y = 72;
const LABEL_WIDTH = 120;
const TIER_COUNT = 3;

export const TIER_LABELS = [
  "Tier 0 — Foundation",
  "Tier 1 — Services & Clients",
  "Tier 2 — Bots",
];

export interface MiniEdge {
  source: string;
  target: string;
  criticality: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface MiniTopologyLayout {
  nodes: PortalService[];
  edges: MiniEdge[];
  positions: Record<string, Point>;
  /** Label row per non-empty tier (y is the row's vertical centre). */
  tierRows: { tier: number; y: number }[];
  width: number;
  height: number;
}

function clampTier(tier: unknown): number {
  const value =
    typeof tier === "number" && Number.isFinite(tier) ? Math.trunc(tier) : 2;
  return Math.min(Math.max(value, 0), TIER_COUNT - 1);
}

/** Edges between listed projects (dependency → dependent). */
export function collectEdges(services: PortalService[]): MiniEdge[] {
  const ids = new Set(services.map((service) => service.id));
  const edges: MiniEdge[] = [];
  const seen = new Set<string>();
  for (const service of services) {
    for (const dependency of service.dependsOn || []) {
      const id = typeof dependency === "string" ? dependency : dependency.id;
      const criticality =
        typeof dependency === "string"
          ? "required"
          : dependency.criticality || "required";
      const key = `${id}->${service.id}`;
      if (!ids.has(id) || seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: id, target: service.id, criticality });
    }
  }
  return edges;
}

/** The project, everything it (transitively) depends on, and its direct dependents. */
export function connectedIds(
  serviceId: string,
  edges: MiniEdge[],
): Set<string> {
  const upstream = new Map<string, string[]>();
  const downstream = new Map<string, string[]>();
  for (const edge of edges) {
    upstream.set(edge.target, [
      ...(upstream.get(edge.target) ?? []),
      edge.source,
    ]);
    downstream.set(edge.source, [
      ...(downstream.get(edge.source) ?? []),
      edge.target,
    ]);
  }

  const connected = new Set([serviceId]);
  const queue = [serviceId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const dependency of upstream.get(id) ?? []) {
      if (!connected.has(dependency)) {
        connected.add(dependency);
        queue.push(dependency);
      }
    }
  }
  for (const dependent of downstream.get(serviceId) ?? [])
    connected.add(dependent);
  return connected;
}

/** Null when the project has no connections to draw. */
export function layoutMiniTopology(
  service: PortalService,
  allServices: PortalService[],
): MiniTopologyLayout | null {
  const allEdges = collectEdges(allServices);
  const connected = connectedIds(service.id, allEdges);
  const nodes = allServices.filter((candidate) => connected.has(candidate.id));
  if (nodes.length <= 1) return null;
  const edges = allEdges.filter(
    (edge) => connected.has(edge.source) && connected.has(edge.target),
  );

  const tiers: PortalService[][] = Array.from({ length: TIER_COUNT }, () => []);
  for (const node of nodes) tiers[clampTier(node.deployTier)].push(node);
  for (const tier of tiers)
    tier.sort((first, second) => first.name.localeCompare(second.name));

  const rowWidth = (count: number) => count * (MINI_NODE_WIDTH + GAP_X) - GAP_X;
  const maxWidth = Math.max(...tiers.map((tier) => rowWidth(tier.length)), 0);

  const positions: Record<string, Point> = {};
  const tierRows: { tier: number; y: number }[] = [];
  let row = 0;
  tiers.forEach((tier, tierIndex) => {
    if (tier.length === 0) return;
    const offsetX = LABEL_WIDTH + (maxWidth - rowWidth(tier.length)) / 2;
    const y = row * (MINI_NODE_HEIGHT + GAP_Y);
    tier.forEach((node, index) => {
      positions[node.id] = {
        x: offsetX + index * (MINI_NODE_WIDTH + GAP_X),
        y,
      };
    });
    tierRows.push({ tier: tierIndex, y: y + MINI_NODE_HEIGHT / 2 });
    row++;
  });

  return {
    nodes,
    edges,
    positions,
    tierRows,
    width: LABEL_WIDTH + maxWidth + 20,
    height: row * (MINI_NODE_HEIGHT + GAP_Y) - GAP_Y + 10,
  };
}

type PortSide = "top" | "bottom" | "left" | "right";

function portPoint(position: Point, side: PortSide): Point {
  switch (side) {
    case "top":
      return { x: position.x + MINI_NODE_WIDTH / 2, y: position.y };
    case "bottom":
      return {
        x: position.x + MINI_NODE_WIDTH / 2,
        y: position.y + MINI_NODE_HEIGHT,
      };
    case "left":
      return { x: position.x, y: position.y + MINI_NODE_HEIGHT / 2 };
    case "right":
      return {
        x: position.x + MINI_NODE_WIDTH,
        y: position.y + MINI_NODE_HEIGHT / 2,
      };
  }
}

function controlOffset(side: PortSide, distance: number): Point {
  const magnitude = Math.max(distance * 0.4, 40);
  switch (side) {
    case "top":
      return { x: 0, y: -magnitude };
    case "bottom":
      return { x: 0, y: magnitude };
    case "left":
      return { x: -magnitude, y: 0 };
    case "right":
      return { x: magnitude, y: 0 };
  }
}

/**
 * Cubic Bézier between two nodes, leaving and entering through the faces
 * that point at each other: side-by-side nodes use left/right ports,
 * stacked ones top/bottom, otherwise the dominant axis decides.
 */
export function miniEdgePath(source: Point, target: Point): string {
  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;
  const rowsOverlap = !(
    source.y + MINI_NODE_HEIGHT < target.y ||
    target.y + MINI_NODE_HEIGHT < source.y
  );
  const columnsOverlap = !(
    source.x + MINI_NODE_WIDTH < target.x ||
    target.x + MINI_NODE_WIDTH < source.x
  );

  const horizontal =
    (rowsOverlap && !columnsOverlap) ||
    (!(columnsOverlap && !rowsOverlap) && Math.abs(deltaX) > Math.abs(deltaY));
  const [sourceSide, targetSide]: [PortSide, PortSide] = horizontal
    ? deltaX > 0
      ? ["right", "left"]
      : ["left", "right"]
    : deltaY > 0
      ? ["bottom", "top"]
      : ["top", "bottom"];

  const start = portPoint(source, sourceSide);
  const end = portPoint(target, targetSide);
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const startControl = controlOffset(sourceSide, distance);
  const endControl = controlOffset(targetSide, distance);
  return `M ${start.x} ${start.y} C ${start.x + startControl.x} ${start.y + startControl.y}, ${end.x + endControl.x} ${end.y + endControl.y}, ${end.x} ${end.y}`;
}
