"use client";

import { memo } from "react";
import type { NodePosition } from "../../types/portal";
import { EDGE_DIRECTION_CONFIG, type EdgeTypeStyle } from "./topologyConfig";
import { computeEdgeAnchors, edgePath, type EdgeDirection } from "./topologyLayout";
import styles from "../TopologyComponent.module.css";

/** Arrowhead markers for directional (selected) edges. */
export function EdgeMarkers() {
  return (
    <defs>
      {(Object.keys(EDGE_DIRECTION_CONFIG) as EdgeDirection[]).map((direction) => {
        const { color, markerSize, markerOpacity } = EDGE_DIRECTION_CONFIG[direction];
        return (
          <marker
            key={direction}
            id={`arrow-${direction}`}
            viewBox="0 0 10 8"
            refX="10"
            refY="4"
            markerWidth={markerSize[0]}
            markerHeight={markerSize[1]}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 4 L 0 8 z" fill={color} opacity={markerOpacity} />
          </marker>
        );
      })}
    </defs>
  );
}

interface TopologyEdgePathProps {
  source: NodePosition;
  target: NodePosition;
  edgeStyle: EdgeTypeStyle;
  isOptional: boolean;
  /** Both ends belong to the current selection's connected set. */
  isSelected: boolean;
  isHovered: boolean;
  isFaded: boolean;
  direction: EdgeDirection | undefined;
}

/**
 * One dependency edge. Memoized on its endpoints and flags, so dragging a
 * node only re-renders the edges attached to it.
 */
export const TopologyEdgePath = memo(function TopologyEdgePath({
  source,
  target,
  edgeStyle,
  isOptional,
  isSelected,
  isHovered,
  isFaded,
  direction,
}: TopologyEdgePathProps) {
  const pathData = edgePath(computeEdgeAnchors(source, target));
  const directional = isSelected && direction ? EDGE_DIRECTION_CONFIG[direction] : null;
  const isActive = isSelected || isHovered;

  const className = [
    styles["connection-group"],
    isSelected && styles["connection-flowing"],
    isFaded && styles["edge-faded"],
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <g className={className}>
      {/* Wide invisible hit area for the hover highlight */}
      <path d={pathData} stroke="transparent" strokeWidth={12} fill="none" />
      {directional && (
        <path
          d={pathData}
          stroke={directional.color}
          strokeWidth={6}
          fill="none"
          strokeOpacity={0.12}
          className={styles["connection-glow"]}
        />
      )}
      <path
        d={pathData}
        stroke={directional ? directional.color : edgeStyle.color}
        strokeWidth={
          isActive ? 2.5 : isOptional ? Math.max(edgeStyle.width - 0.5, 0.75) : edgeStyle.width
        }
        fill="none"
        strokeOpacity={isActive ? 0.9 : isOptional ? edgeStyle.opacity * 0.5 : edgeStyle.opacity}
        strokeDasharray={isOptional && !isSelected ? "6 4" : edgeStyle.dash}
        markerEnd={directional ? `url(#arrow-${direction})` : undefined}
        className={styles["connection-line"]}
      />
    </g>
  );
});
