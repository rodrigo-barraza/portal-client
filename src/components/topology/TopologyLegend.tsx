"use client";

import { ArrowDown, ArrowUp, GitBranch } from "lucide-react";
import { ToggleComponent } from "@rodrigo-barraza/components-library";
import type { EdgeType, ServiceTypeColor } from "../../types/portal";
import {
  EDGE_DIRECTION_CONFIG,
  EDGE_TYPE_CONFIG,
  EDGE_TYPES,
} from "./topologyConfig";
import { typeClusterLabel, type EdgeDirection } from "./topologyLayout";
import styles from "../TopologyComponent.module.css";

const DIRECTION_ICONS: Record<EdgeDirection, typeof ArrowDown> = {
  incoming: ArrowDown,
  outgoing: ArrowUp,
  network: GitBranch,
};

export function TopologyLegend({
  typeEntries,
  typeVisibility,
  onToggleType,
  edgeVisibility,
  edgeCounts,
  onToggleEdge,
  hasSelection,
}: {
  typeEntries: { type: string; colors: ServiceTypeColor }[];
  typeVisibility: Record<string, boolean>;
  onToggleType: (type: string) => void;
  edgeVisibility: Record<EdgeType, boolean>;
  edgeCounts: Record<EdgeType, number>;
  onToggleEdge: (type: EdgeType) => void;
  hasSelection: boolean;
}) {
  return (
    <div className={styles["legend"]}>
      <div className={styles["legend-title"]}>Nodes</div>
      <div className={styles["legend-item"]}>
        <div
          className={`${styles["legend-dot"]} ${styles["legend-dot-healthy"]}`}
        />
        <span>Healthy</span>
      </div>
      <div className={styles["legend-item"]}>
        <div
          className={`${styles["legend-dot"]} ${styles["legend-dot-down"]}`}
        />
        <span>Down</span>
      </div>
      <div className={styles["legend-sep"]} />

      {typeEntries.map(({ type, colors }) => {
        const visible = typeVisibility[type] ?? true;
        return (
          <ToggleComponent
            key={type}
            size="mini"
            checked={visible}
            onChange={() => onToggleType(type)}
            label={
              <span
                className={styles["legend-toggle-label"]}
                title={`${visible ? "Hide" : "Show"} ${typeClusterLabel(type)}`}
              >
                <span
                  className={styles["legend-dot"]}
                  style={{
                    background: colors.color,
                    boxShadow: `0 0 6px ${colors.subtle}`,
                    opacity: visible ? 1 : 0.3,
                  }}
                />
                <span>{type}</span>
              </span>
            }
          />
        );
      })}

      <div className={styles["legend-sep"]} />
      <div className={styles["legend-title"]}>Connections</div>
      {EDGE_TYPES.map((type) => {
        const config = EDGE_TYPE_CONFIG[type];
        const visible = edgeVisibility[type];
        const count = edgeCounts[type];
        return (
          <ToggleComponent
            key={type}
            size="mini"
            checked={visible}
            onChange={() => onToggleEdge(type)}
            label={
              <span
                className={styles["legend-toggle-label"]}
                title={`${visible ? "Hide" : "Show"} ${config.label} (${count})`}
              >
                <span
                  className={styles["legend-edge-line"]}
                  style={{
                    borderTopColor: config.color,
                    borderTopStyle: config.dash === "none" ? "solid" : "dashed",
                    borderTopWidth: `${Math.max(config.width, 1.5)}px`,
                    opacity: visible ? 1 : 0.3,
                  }}
                />
                <span>{config.label}</span>
                <span className={styles["legend-count"]}>{count}</span>
              </span>
            }
          />
        );
      })}

      <div className={styles["legend-sep"]} />
      <div className={styles["legend-item"]}>
        <div className={styles["legend-line"]} />
        <span>Required</span>
      </div>
      <div className={styles["legend-item"]}>
        <div
          className={`${styles["legend-line"]} ${styles["legend-line-optional"]}`}
        />
        <span>Optional</span>
      </div>

      {hasSelection && (
        <>
          <div className={styles["legend-sep"]} />
          <div className={styles["legend-title"]}>Selected</div>
          {(Object.keys(EDGE_DIRECTION_CONFIG) as EdgeDirection[]).map(
            (direction) => {
              const { color, label } = EDGE_DIRECTION_CONFIG[direction];
              const Icon = DIRECTION_ICONS[direction];
              return (
                <div key={direction} className={styles["legend-item"]}>
                  <div
                    className={styles["legend-edge-line"]}
                    style={{
                      borderTopColor: color,
                      borderTopStyle: "solid",
                      borderTopWidth: direction === "network" ? "2px" : "2.5px",
                      opacity: direction === "network" ? 0.7 : undefined,
                    }}
                  />
                  <Icon size={11} strokeWidth={2} style={{ color }} />
                  <span>{label}</span>
                </div>
              );
            },
          )}
        </>
      )}
    </div>
  );
}
