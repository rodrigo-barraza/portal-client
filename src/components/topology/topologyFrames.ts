/**
 * Cluster frames — the labelled rounded rects drawn behind each group of
 * nodes. They follow the live node positions, so dragging a node (or a
 * whole cluster) reshapes its frame.
 */

import { DEPLOY_TIER_COLORS, SERVICE_TYPE_COLORS } from "../../constants";
import type { NodePosition, PortalService } from "../../types/portal";
import { LIBS_CLUSTER_COLOR, LIBS_LABEL, TIER_LABELS } from "./topologyConfig";
import {
  clusterRect,
  typeClusterLabel,
  type Rect,
  type TypeGroup,
  type ViewMode,
} from "./topologyLayout";

export interface ClusterFrame {
  key: string;
  label: string;
  /** Explicit label fill; omitted frames use the muted tier-label color. */
  labelColor?: string;
  stroke: string;
  fill: string;
  memberIds: string[];
  rect: Rect;
  /** A search is active and none of this cluster's members match it. */
  isSearchFaded: boolean;
}

export function serviceTypeColor(projectType: string | null | undefined) {
  return SERVICE_TYPE_COLORS[projectType || ""] || SERVICE_TYPE_COLORS.Service;
}

export function buildClusterFrames({
  viewMode,
  layers,
  libraries,
  typeGroups,
  positions,
  searchMatches,
}: {
  viewMode: ViewMode;
  layers: PortalService[][];
  libraries: PortalService[];
  typeGroups: TypeGroup[];
  positions: Record<string, NodePosition>;
  searchMatches: Set<string> | null;
}): ClusterFrame[] {
  const frames: ClusterFrame[] = [];

  const addFrame = (
    key: string,
    members: PortalService[],
    style: Pick<ClusterFrame, "label" | "labelColor" | "stroke" | "fill">,
  ) => {
    const memberIds = members.map((member) => member.id);
    const rect = clusterRect(memberIds, positions);
    if (!rect) return;
    frames.push({
      key,
      ...style,
      memberIds,
      rect,
      isSearchFaded:
        searchMatches !== null &&
        !memberIds.some((id) => searchMatches.has(id)),
    });
  };

  if (viewMode === "tier") {
    addFrame("libraries", libraries, {
      label: LIBS_LABEL,
      ...LIBS_CLUSTER_COLOR,
    });
    layers.forEach((layer, tier) => {
      const tierColor = DEPLOY_TIER_COLORS[tier] || DEPLOY_TIER_COLORS[0];
      addFrame(`tier-${tier}`, layer, {
        label: TIER_LABELS[tier] || `Tier ${tier}`,
        stroke: tierColor.stroke,
        fill: tierColor.fill,
      });
    });
  } else {
    for (const group of typeGroups) {
      const { color } = serviceTypeColor(group.type);
      addFrame(`type-${group.type}`, group.members, {
        label: typeClusterLabel(group.type),
        labelColor: color,
        stroke: `color-mix(in srgb, ${color} 35%, transparent)`,
        fill: `color-mix(in srgb, ${color} 4%, transparent)`,
      });
    }
  }

  return frames;
}
