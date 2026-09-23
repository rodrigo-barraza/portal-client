"use client";

import { Move } from "lucide-react";
import type { ClusterFrame } from "./topologyFrames";
import styles from "../TopologyComponent.module.css";

/** A draggable cluster background with its label and a drag handle. */
export function TopologyClusterFrame({
  frame,
  isFaded,
  onDragStart,
}: {
  frame: ClusterFrame;
  isFaded: boolean;
  onDragStart: (event: React.MouseEvent, frame: ClusterFrame) => void;
}) {
  const { rect } = frame;
  return (
    <g className={isFaded ? styles["tier-label-faded"] : undefined}>
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        rx={10}
        ry={10}
        className={`${styles["cluster-rect"]} ${styles["cluster-draggable"]}`}
        style={{ stroke: frame.stroke, fill: frame.fill }}
        data-topology-cluster
        onMouseDown={(event) => onDragStart(event, frame)}
      />
      <foreignObject
        x={rect.x + 8}
        y={rect.y + 6}
        width={16}
        height={16}
        className={styles["cluster-drag-handle"]}
        data-topology-cluster
        onMouseDown={(event) => onDragStart(event, frame)}
      >
        <Move size={12} strokeWidth={1.5} />
      </foreignObject>
      <text
        x={rect.x + rect.width / 2}
        y={rect.y - 10}
        className={styles["tier-label"]}
        textAnchor="middle"
        style={frame.labelColor ? { fill: frame.labelColor } : undefined}
      >
        {frame.label}
      </text>
    </g>
  );
}
