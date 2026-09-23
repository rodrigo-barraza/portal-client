/**
 * Topology visual vocabulary — edge styles per relationship type, the
 * directional palette used while a node is selected, and cluster labels.
 */

import type { EdgeType } from "../../types/portal";
import type { EdgeDirection } from "./topologyLayout";

export interface EdgeTypeStyle {
  label: string;
  color: string;
  dash: string;
  width: number;
  opacity: number;
  defaultVisible: boolean;
}

export const EDGE_TYPE_CONFIG: Record<EdgeType, EdgeTypeStyle> = {
  api: {
    label: "API Calls",
    color: "#3b82f6",
    dash: "none",
    width: 1.5,
    opacity: 0.45,
    defaultVisible: true,
  },
  infra: {
    label: "Infrastructure",
    color: "#f97316",
    dash: "none",
    width: 2,
    opacity: 0.5,
    defaultVisible: true,
  },
  import: {
    label: "Library Imports",
    color: "#06b6d4",
    dash: "3 5",
    width: 1,
    opacity: 0.25,
    defaultVisible: true,
  },
  tooling: {
    label: "Deploy Tooling",
    color: "#a855f7",
    dash: "6 4",
    width: 1,
    opacity: 0.15,
    defaultVisible: false,
  },
};

export const EDGE_TYPES = Object.keys(EDGE_TYPE_CONFIG) as EdgeType[];

export function defaultEdgeVisibility(): Record<EdgeType, boolean> {
  return Object.fromEntries(
    EDGE_TYPES.map((type) => [type, EDGE_TYPE_CONFIG[type].defaultVisible]),
  ) as Record<EdgeType, boolean>;
}

/**
 * Edge colors while a node is selected: `incoming` edges are its direct
 * dependencies (upstream), `outgoing` its direct consumers (downstream),
 * `network` the transitive edges between other connected nodes.
 */
export const EDGE_DIRECTION_CONFIG: Record<
  EdgeDirection,
  { color: string; label: string; markerSize: [number, number]; markerOpacity: number }
> = {
  incoming: { color: "#00e5ff", label: "Upstream", markerSize: [8, 6], markerOpacity: 0.9 },
  outgoing: { color: "#ff5722", label: "Downstream", markerSize: [8, 6], markerOpacity: 0.9 },
  network: { color: "#b388ff", label: "Network", markerSize: [7, 5], markerOpacity: 0.7 },
};

export const TIER_LABELS = [
  "Tier 0 — Foundation",
  "Tier 1 — Services & Clients",
  "Tier 2 — Bots",
];

export const LIBS_LABEL = "Libraries & Toolkits";

export const LIBS_CLUSTER_COLOR = {
  stroke: "rgba(6, 182, 212, 0.35)",
  fill: "rgba(6, 182, 212, 0.04)",
};
