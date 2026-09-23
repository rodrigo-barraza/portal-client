"use client";

import { memo, type CSSProperties } from "react";
import { HardDrive } from "lucide-react";
import { DEFAULT_SERVICE_TYPE_ICON, SERVICE_TYPE_ICONS } from "../../constants";
import { formatSize } from "@/lib/format";
import type { NodePosition, PortalService, RepoSize } from "../../types/portal";
import { serviceTypeColor } from "./topologyFrames";
import { NODE_H, NODE_W, NON_TIERED_TYPES } from "./topologyLayout";
import styles from "../TopologyComponent.module.css";

interface TopologyNodeCardProps {
  service: PortalService;
  position: NodePosition;
  repoSize: RepoSize | undefined;
  isHovered: boolean;
  isDragging: boolean;
  isSelected: boolean;
  isFaded: boolean;
  onPress: (event: React.MouseEvent, service: PortalService, position: NodePosition) => void;
  onHoverStart: (event: React.MouseEvent, service: PortalService) => void;
  onHoverMove: (event: React.MouseEvent) => void;
  onHoverEnd: () => void;
  /** Keyboard selection: a service id to select, or null to clear. */
  onKeySelect: (serviceId: string | null) => void;
}

/**
 * A service node. Memoized so pans, hovers and drags elsewhere in the
 * graph skip it; its type color reaches the CSS as custom properties
 * instead of per-render inline style objects.
 */
export const TopologyNodeCard = memo(function TopologyNodeCard({
  service,
  position,
  repoSize,
  isHovered,
  isDragging,
  isSelected,
  isFaded,
  onPress,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
  onKeySelect,
}: TopologyNodeCardProps) {
  const Icon = SERVICE_TYPE_ICONS[service.projectType || ""] || DEFAULT_SERVICE_TYPE_ICON;
  const typeColor = serviceTypeColor(service.projectType);

  const className = [
    styles["node-card"],
    service.healthy ? styles["node-healthy"] : styles["node-down"],
    isHovered && styles["node-hovered"],
    isDragging && styles["node-dragging"],
    isSelected && styles["node-selected"],
    isFaded && styles["node-faded"],
  ]
    .filter(Boolean)
    .join(" ");

  const colorVariables = {
    "--node-color": typeColor.color,
    "--node-subtle": typeColor.subtle,
  } as CSSProperties;

  return (
    <foreignObject
      x={position.x}
      y={position.y}
      width={NODE_W}
      height={NODE_H}
      data-topology-node
      className={styles["node-frame"]}
    >
      <div
        className={className}
        style={colorVariables}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        aria-label={`${service.name}, ${service.healthy ? "healthy" : "down"}`}
        onMouseDown={(event) => onPress(event, service, position)}
        onMouseEnter={(event) => onHoverStart(event, service)}
        onMouseMove={onHoverMove}
        onMouseLeave={onHoverEnd}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onKeySelect(isSelected ? null : service.id);
          } else if (event.key === "Escape") {
            onKeySelect(null);
          }
        }}
      >
        <div className={styles["node-glow"]} />
        {!NON_TIERED_TYPES.has(service.projectType || "") && (
          <div
            className={`${styles["status-dot"]} ${service.healthy ? styles["status-healthy"] : styles["status-down"]}`}
          />
        )}
        <div className={styles["node-icon-wrap"]}>
          <Icon size={18} strokeWidth={1.5} />
        </div>
        <span className={styles["node-name"]}>{service.name}</span>
        {repoSize ? (
          <span className={styles["node-size"]}>
            <HardDrive size={9} strokeWidth={1.5} />
            {formatSize(repoSize.sizeKB)}
          </span>
        ) : service.device ? (
          <span className={styles["node-host"]}>{service.device}</span>
        ) : null}
      </div>
    </foreignObject>
  );
});
