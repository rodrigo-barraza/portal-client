"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Grid3x3,
  Layers,
  Maximize2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  ButtonComponent,
  EmptyStateComponent,
  IconButtonComponent,
  LoadingIndicatorComponent,
  SearchInputComponent,
  SegmentedControlComponent,
} from "@rodrigo-barraza/components-library";
import { SERVICE_TYPE_COLORS } from "../constants";
import type {
  EdgeType,
  NodePosition,
  PortalService,
  RepoSize,
} from "../types/portal";
import {
  defaultEdgeVisibility,
  EDGE_TYPE_CONFIG,
  EDGE_TYPES,
} from "./topology/topologyConfig";
import {
  buildClusterFrames,
  serviceTypeColor,
  type ClusterFrame,
} from "./topology/topologyFrames";
import {
  collectEdges,
  computeLayers,
  computeLibraries,
  computeSelection,
  computeTypeGroups,
  edgeKey,
  layoutTierNodes,
  layoutTypeNodes,
  matchServices,
  nodeBounds,
  type ViewMode,
} from "./topology/topologyLayout";
import { EdgeMarkers, TopologyEdgePath } from "./topology/TopologyEdges";
import { TopologyClusterFrame } from "./topology/TopologyClusterFrame";
import { TopologyLegend } from "./topology/TopologyLegend";
import { TopologyNodeCard } from "./topology/TopologyNodeCard";
import { TopologyTooltip, tooltipPosition } from "./topology/TopologyTooltip";
import { useTopologyData } from "./topology/useTopologyData";
import { useTopologyViewport } from "./topology/useTopologyViewport";
import styles from "./TopologyComponent.module.css";

const NO_REPO_SIZES: Record<string, RepoSize> = {};

/** Screen pixels an arrow key pans the canvas (four times that with Shift). */
const KEYBOARD_PAN_STEP = 60;

const VIEW_SEGMENTS = [
  {
    value: "tier",
    label: "By Tier",
    icon: <Layers size={14} strokeWidth={1.8} />,
  },
  {
    value: "type",
    label: "By Type",
    icon: <Grid3x3 size={14} strokeWidth={1.8} />,
  },
];

export default function TopologyComponent() {
  const {
    services: allServices,
    analysis,
    hasLoaded,
    error,
    isRefreshing,
    refresh,
  } = useTopologyData();
  const {
    viewport,
    positionOverrides,
    isPanning,
    draggingNodeId,
    canvasElement,
    canvasRef,
    beginPan,
    beginNodeDrag,
    beginClusterDrag,
    panBy,
    zoomBy,
    fitTo,
    resetOverrides,
  } = useTopologyViewport();

  const [viewMode, setViewMode] = useState<ViewMode>("tier");
  const [searchQuery, setSearchQuery] = useState("");
  const [edgeVisibility, setEdgeVisibility] = useState(defaultEdgeVisibility);
  // Missing key = visible, so types the constants don't know still render
  const [typeVisibility, setTypeVisibility] = useState<Record<string, boolean>>(
    {},
  );
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hover, setHover] = useState<{
    service: PortalService;
    x: number;
    y: number;
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const needsCenterRef = useRef(true);

  const repoSizes = analysis?.repoSizes ?? NO_REPO_SIZES;

  // ── Derived graph ───────────────────────────────────────────
  const filteredServices = useMemo(
    () =>
      allServices.filter(
        (service) => typeVisibility[service.projectType || "Other"] ?? true,
      ),
    [allServices, typeVisibility],
  );
  const layers = useMemo(
    () => computeLayers(filteredServices),
    [filteredServices],
  );
  const libraries = useMemo(
    () => computeLibraries(filteredServices),
    [filteredServices],
  );
  const typeGroups = useMemo(
    () => computeTypeGroups(filteredServices),
    [filteredServices],
  );

  const basePositions = useMemo(
    () =>
      viewMode === "tier"
        ? layoutTierNodes(layers, libraries)
        : layoutTypeNodes(typeGroups),
    [viewMode, layers, libraries, typeGroups],
  );

  // Drag overrides replace base positions; untouched nodes keep their
  // object identity so their memoized cards and edges skip re-rendering.
  const positions = useMemo(() => {
    const merged = { ...basePositions };
    for (const [nodeId, position] of Object.entries(positionOverrides)) {
      if (merged[nodeId]) merged[nodeId] = position;
    }
    return merged;
  }, [basePositions, positionOverrides]);

  const allEdges = useMemo(
    () => collectEdges(filteredServices),
    [filteredServices],
  );
  const edges = useMemo(
    () => allEdges.filter((edge) => edgeVisibility[edge.type]),
    [allEdges, edgeVisibility],
  );
  const edgeCounts = useMemo(() => {
    const counts = Object.fromEntries(
      EDGE_TYPES.map((type) => [type, 0]),
    ) as Record<EdgeType, number>;
    for (const edge of allEdges) counts[edge.type]++;
    return counts;
  }, [allEdges]);

  const searchMatches = useMemo(
    () => matchServices(filteredServices, searchQuery),
    [filteredServices, searchQuery],
  );
  // A selection hidden by the type filter no longer dims the graph
  const activeSelection =
    selectedNode && positions[selectedNode] ? selectedNode : null;
  const { connectedNodes, edgeDirections } = useMemo(
    () => computeSelection(activeSelection, edges),
    [activeSelection, edges],
  );

  const clusterFrames = useMemo(
    () =>
      buildClusterFrames({
        viewMode,
        layers,
        libraries,
        typeGroups,
        positions,
        searchMatches,
      }),
    [viewMode, layers, libraries, typeGroups, positions, searchMatches],
  );
  const contentBounds = useMemo(
    () => nodeBounds(Object.keys(positions), positions),
    [positions],
  );

  // Legend: every registry type color, plus any type present in the data
  // that has no color yet (e.g. Inference) so it can still be toggled.
  const typeEntries = useMemo(() => {
    const types = new Set(Object.keys(SERVICE_TYPE_COLORS));
    for (const service of allServices)
      if (service.projectType) types.add(service.projectType);
    return [...types].map((type) => ({ type, colors: serviceTypeColor(type) }));
  }, [allServices]);

  const healthyCount = filteredServices.filter(
    (service) => service.healthy,
  ).length;

  // ── Viewport ────────────────────────────────────────────────
  // Center once when the graph first appears and after each view switch;
  // wait a frame so the freshly mounted canvas has its size.
  useEffect(() => {
    if (!needsCenterRef.current || !canvasElement || !contentBounds) return;
    const frame = requestAnimationFrame(() => {
      if (fitTo(contentBounds)) needsCenterRef.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [canvasElement, contentBounds, fitTo]);

  const handleViewModeChange = useCallback(
    (mode: string) => {
      setViewMode(mode as ViewMode);
      resetOverrides();
      setSelectedNode(null);
      needsCenterRef.current = true;
    },
    [resetOverrides],
  );

  // ── Pointer handlers ────────────────────────────────────────
  const handleCanvasMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return;
      const element = event.target as Element;
      if (
        element.closest("[data-topology-node]") ||
        element.closest("[data-topology-cluster]")
      ) {
        return;
      }
      setSelectedNode(null);
      beginPan(event);
    },
    [beginPan],
  );

  // The keyboard twin of dragging the canvas and clicking its background.
  // Keys a focused node handled itself (Enter/Space) are left alone.
  const handleCanvasKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      const step = event.shiftKey ? KEYBOARD_PAN_STEP * 4 : KEYBOARD_PAN_STEP;
      switch (event.key) {
        case "ArrowLeft":
          panBy(step, 0);
          break;
        case "ArrowRight":
          panBy(-step, 0);
          break;
        case "ArrowUp":
          panBy(0, step);
          break;
        case "ArrowDown":
          panBy(0, -step);
          break;
        case "+":
        case "=":
          zoomBy(1);
          break;
        case "-":
        case "_":
          zoomBy(-1);
          break;
        case "0":
          fitTo(contentBounds);
          break;
        case "Escape":
          setSelectedNode(null);
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    [panBy, zoomBy, fitTo, contentBounds],
  );

  const handleNodePress = useCallback(
    (
      event: React.MouseEvent,
      service: PortalService,
      position: NodePosition,
    ) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      setSelectedNode(service.id);
      beginNodeDrag(event, service.id, position);
    },
    [beginNodeDrag],
  );

  const handleClusterDragStart = useCallback(
    (event: React.MouseEvent, frame: ClusterFrame) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      setSelectedNode(null);
      const origins: Record<string, NodePosition> = {};
      for (const id of frame.memberIds)
        if (positions[id]) origins[id] = positions[id];
      beginClusterDrag(event, origins);
    },
    [beginClusterDrag, positions],
  );

  const handleHoverStart = useCallback(
    (event: React.MouseEvent, service: PortalService) => {
      setHover({ service, x: event.clientX, y: event.clientY });
    },
    [],
  );

  const handleHoverMove = useCallback((event: React.MouseEvent) => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    const { left, top } = tooltipPosition(event.clientX, event.clientY);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }, []);

  const handleHoverEnd = useCallback(() => setHover(null), []);

  const toggleEdgeType = useCallback((type: EdgeType) => {
    setEdgeVisibility((previous) => ({ ...previous, [type]: !previous[type] }));
  }, []);

  const toggleTypeVisibility = useCallback((type: string) => {
    setTypeVisibility((previous) => ({
      ...previous,
      [type]: !(previous[type] ?? true),
    }));
  }, []);

  // ── Render ──────────────────────────────────────────────────
  const hoveredId = hover?.service.id ?? null;
  const github = analysis?.github;

  let subtitle: React.ReactNode = "Loading…";
  if (hasLoaded) {
    subtitle =
      allServices.length === 0 && error
        ? "Couldn't load services"
        : `${filteredServices.length} services · ${healthyCount} healthy`;
  }

  return (
    <div className={`topology-component ${styles["topology"]}`}>
      <div className={styles["header"]}>
        <div className={styles["header-inner"]}>
          <div className={styles["header-text"]}>
            <h1 className={styles["title"]}>Topology</h1>
            <p className={styles["subtitle"]}>
              {subtitle}
              {hasLoaded && github && github.status !== "ok" && (
                <span
                  className={styles["subtitle-warning"]}
                  title={
                    github.tokenConfigured
                      ? "GitHub requests are failing — detected connections may be incomplete"
                      : "GITHUB_PAT is not configured on portal-service, so code-analysis connections (imports & API calls) can't be detected for private repos"
                  }
                >
                  {" "}
                  · code analysis{" "}
                  {github.status === "unavailable" ? "offline" : "degraded"}
                </span>
              )}
              {allServices.length > 0 && error && (
                <span className={styles["subtitle-warning"]} title={error}>
                  {" "}
                  · refresh failed
                </span>
              )}
            </p>
          </div>
          <div className={styles["header-actions"]}>
            <SegmentedControlComponent
              value={viewMode}
              onChange={handleViewModeChange}
              segments={VIEW_SEGMENTS}
              className={styles["view-toggle"]}
            />
            <SearchInputComponent
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Filter nodes…"
              compact
            />
            <ButtonComponent
              variant="secondary"
              icon={RefreshCw}
              loading={isRefreshing}
              onClick={refresh}
            >
              Refresh
            </ButtonComponent>
          </div>
        </div>
      </div>

      {!hasLoaded ? (
        <LoadingIndicatorComponent
          size="small"
          label="Building topology…"
          className="is-loading-centered-state"
        />
      ) : allServices.length === 0 && error ? (
        <EmptyStateComponent
          icon={<AlertTriangle size={40} strokeWidth={1.5} />}
          title="Couldn't load the topology"
          subtitle={error}
        >
          <ButtonComponent
            variant="secondary"
            icon={RefreshCw}
            loading={isRefreshing}
            onClick={refresh}
          >
            Retry
          </ButtonComponent>
        </EmptyStateComponent>
      ) : (
        <>
          <div
            ref={canvasRef}
            className={`${styles["canvas-wrapper"]}${isPanning ? ` ${styles["panning"]}` : ""}`}
            role="region"
            aria-label="Service topology. Arrow keys pan, plus and minus zoom, 0 fits the graph, Escape clears the selection."
            tabIndex={0}
            onMouseDown={handleCanvasMouseDown}
            onKeyDown={handleCanvasKeyDown}
          >
            <svg className={styles["svg"]}>
              <EdgeMarkers />
              <g
                transform={`translate(${viewport.pan.x}, ${viewport.pan.y}) scale(${viewport.zoom})`}
              >
                {edges.map((edge) => {
                  const source = positions[edge.source];
                  const target = positions[edge.target];
                  if (!source || !target) return null;
                  const key = edgeKey(edge.source, edge.target);
                  const isSelected =
                    connectedNodes.has(edge.source) &&
                    connectedNodes.has(edge.target);
                  const isFaded =
                    (activeSelection !== null && !isSelected) ||
                    (searchMatches !== null &&
                      (!searchMatches.has(edge.source) ||
                        !searchMatches.has(edge.target)));
                  return (
                    <TopologyEdgePath
                      key={key}
                      source={source}
                      target={target}
                      edgeStyle={
                        EDGE_TYPE_CONFIG[edge.type] || EDGE_TYPE_CONFIG.api
                      }
                      isOptional={edge.criticality === "optional"}
                      isSelected={isSelected}
                      isHovered={
                        hoveredId === edge.source || hoveredId === edge.target
                      }
                      isFaded={isFaded}
                      direction={edgeDirections.get(key)}
                    />
                  );
                })}

                {clusterFrames.map((frame) => (
                  <TopologyClusterFrame
                    key={frame.key}
                    frame={frame}
                    isFaded={activeSelection !== null || frame.isSearchFaded}
                    onDragStart={handleClusterDragStart}
                  />
                ))}

                {filteredServices.map((service) => {
                  const position = positions[service.id];
                  if (!position) return null;
                  return (
                    <TopologyNodeCard
                      key={service.id}
                      service={service}
                      position={position}
                      repoSize={repoSizes[service.id]}
                      isHovered={hoveredId === service.id}
                      isDragging={draggingNodeId === service.id}
                      isSelected={activeSelection === service.id}
                      isFaded={
                        (activeSelection !== null &&
                          !connectedNodes.has(service.id)) ||
                        (searchMatches !== null &&
                          !searchMatches.has(service.id))
                      }
                      onPress={handleNodePress}
                      onHoverStart={handleHoverStart}
                      onHoverMove={handleHoverMove}
                      onHoverEnd={handleHoverEnd}
                      onKeySelect={setSelectedNode}
                    />
                  );
                })}
              </g>
            </svg>
          </div>

          <TopologyLegend
            typeEntries={typeEntries}
            typeVisibility={typeVisibility}
            onToggleType={toggleTypeVisibility}
            edgeVisibility={edgeVisibility}
            edgeCounts={edgeCounts}
            onToggleEdge={toggleEdgeType}
            hasSelection={activeSelection !== null}
          />

          <div className={styles["zoom-controls"]}>
            <IconButtonComponent
              icon={<ZoomIn size={15} strokeWidth={1.8} />}
              onClick={() => zoomBy(1)}
              tooltip="Zoom in"
              aria-label="Zoom in"
              className={styles["zoom-button"]}
            />
            <IconButtonComponent
              icon={<ZoomOut size={15} strokeWidth={1.8} />}
              onClick={() => zoomBy(-1)}
              tooltip="Zoom out"
              aria-label="Zoom out"
              className={styles["zoom-button"]}
            />
            <IconButtonComponent
              icon={<Maximize2 size={14} strokeWidth={1.8} />}
              onClick={() => fitTo(contentBounds)}
              tooltip="Fit to view"
              aria-label="Fit to view"
              className={styles["zoom-button"]}
            />
          </div>

          {hover && (
            <TopologyTooltip
              ref={tooltipRef}
              service={hover.service}
              clientX={hover.x}
              clientY={hover.y}
              analysis={analysis}
              repoSize={repoSizes[hover.service.id]}
            />
          )}
        </>
      )}
    </div>
  );
}
