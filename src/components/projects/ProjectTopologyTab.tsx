import { useId, useMemo } from "react";
import { Network } from "lucide-react";
import { DEFAULT_SERVICE_TYPE_ICON, SERVICE_TYPE_ICONS } from "@/constants";
import type { PortalService } from "@/types/portal";
import {
  MINI_NODE_HEIGHT,
  MINI_NODE_WIDTH,
  TIER_LABELS,
  layoutMiniTopology,
  miniEdgePath,
} from "./miniTopology";
import { projectHealth } from "./projectModel";
import panelStyles from "../ExpandedProjectPanelComponent.module.css";
import styles from "./ProjectTopologyTab.module.css";

/** Mini dependency graph for one project (drawer's Topology tab). */
export default function ProjectTopologyTab({
  service,
  allServices,
}: {
  service: PortalService;
  allServices: PortalService[];
}) {
  // Per-instance id: the gradient must not clash with another open graph.
  const gradientId = `mini-prism-gradient-${useId().replace(/:/g, "")}`;
  const layout = useMemo(
    () => layoutMiniTopology(service, allServices),
    [service, allServices],
  );

  if (!layout) {
    return (
      <div className={panelStyles["empty-tab"]}>
        <Network
          size={24}
          strokeWidth={1.5}
          className={panelStyles["empty-tab-icon"]}
        />
        <span>No connections found</span>
      </div>
    );
  }

  return (
    <div className={styles["mini-topology"]}>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className={styles["mini-topology-svg"]}
        role="img"
        aria-label={`Dependencies of ${service.name}`}
      >
        <defs>
          <linearGradient
            id={gradientId}
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
        </defs>

        {layout.edges.map((edge) => {
          const source = layout.positions[edge.source];
          const target = layout.positions[edge.target];
          if (!source || !target) return null;
          const isOptional = edge.criticality === "optional";
          const touchesSelf =
            edge.source === service.id || edge.target === service.id;
          return (
            <g
              key={`${edge.source}->${edge.target}`}
              className={touchesSelf ? styles["mini-edge-flowing"] : undefined}
            >
              <path
                d={miniEdgePath(source, target)}
                stroke={
                  touchesSelf ? `url(#${gradientId})` : "var(--text-muted)"
                }
                strokeWidth={touchesSelf ? 2 : 1.2}
                fill="none"
                strokeOpacity={touchesSelf ? 0.9 : isOptional ? 0.25 : 0.4}
                strokeDasharray={isOptional && !touchesSelf ? "4 3" : "none"}
                className={styles["mini-edge-line"]}
              />
            </g>
          );
        })}

        {layout.tierRows.map(({ tier, y }) => (
          <text
            key={`tier-${tier}`}
            x={0}
            y={y}
            className={styles["mini-tier-label"]}
            dominantBaseline="middle"
          >
            {TIER_LABELS[tier] ?? `Tier ${tier}`}
          </text>
        ))}

        {layout.nodes.map((node) => {
          const position = layout.positions[node.id];
          if (!position) return null;
          const Icon =
            (node.projectType && SERVICE_TYPE_ICONS[node.projectType]) ||
            DEFAULT_SERVICE_TYPE_ICON;
          const kindClass = node.isInfrastructure
            ? styles["mini-node-infra"]
            : node.visibility === "external"
              ? styles["mini-node-external"]
              : styles["mini-node-internal"];
          const health = projectHealth(node);
          const statusClass =
            health === "healthy"
              ? styles["mini-status-healthy"]
              : health === "down"
                ? styles["mini-status-down"]
                : styles["mini-status-neutral"];
          return (
            <foreignObject
              key={node.id}
              x={position.x}
              y={position.y}
              width={MINI_NODE_WIDTH}
              height={MINI_NODE_HEIGHT}
              style={{ overflow: "visible" }}
            >
              <div
                className={`${styles["mini-node-card"]} ${kindClass} ${node.id === service.id ? styles["mini-node-self"] : ""}`}
              >
                <div
                  className={`${styles["mini-status-dot"]} ${statusClass}`}
                />
                <div className={styles["mini-node-icon-wrap"]}>
                  <Icon size={14} strokeWidth={1.5} />
                </div>
                <span className={styles["mini-node-name"]}>{node.name}</span>
              </div>
            </foreignObject>
          );
        })}
      </svg>
    </div>
  );
}
