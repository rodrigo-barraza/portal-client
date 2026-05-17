"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  RefreshCw, ZoomIn, ZoomOut, Maximize2, Search, X, Move,
} from "lucide-react";
import { ButtonComponent, LoadingIndicatorComponent } from "@rodrigo-barraza/components-library";
import { SERVICE_TYPE_ICONS, DEFAULT_SERVICE_TYPE_ICON, DEPLOY_TIER_COLORS, SERVICE_TYPE_COLORS } from "../constants";
import ApiService from "../services/ApiService";
import styles from "./TopologyComponent.module.css";

// ── Dimensions ───────────────────────────────────────────────────
const NODE_W = 130;
const NODE_H = 64;
const MAX_COLS = 5;           // max nodes per row inside a cluster
const CLUSTER_GAP_X = 32;    // horizontal gap between nodes inside a cluster
const CLUSTER_GAP_Y = 16;    // vertical gap between rows inside a cluster
const CLUSTER_PAD = 24;      // padding inside cluster rect
const TIER_SPACING = 60;     // vertical gap between tier clusters
const LIBS_GAP = 80;         // horizontal gap between libs column and tier column
const LIBS_MAX_COLS = 2;     // max columns in the libraries cluster

// ── Non-tiered project types (rendered independently) ────────
const NON_TIERED_TYPES = new Set(["Library", "Kit", "Tool"]);

// ── Icon resolver (by projectType) ──────────────────────────────
function getIcon(svc: any) {
  // @ts-ignore
  return SERVICE_TYPE_ICONS[svc.projectType] || DEFAULT_SERVICE_TYPE_ICON;
}

// ── Tier labels ─────────────────────────────────────────────────
const TIER_LABELS = ["Tier 0 — Foundation", "Tier 1 — Services & Clients", "Tier 2 — Bots"];
const LIBS_LABEL = "Libraries & Toolkits";

// ── Colors for the libraries cluster ────────────────────────────
const LIBS_CLUSTER_COLOR = { stroke: "rgba(6, 182, 212, 0.35)", fill: "rgba(6, 182, 212, 0.04)" };

// ── Fixed tier layering (uses deployTier from project registry) ──
function computeLayers(services: any) {
  // Group by deployTier, excluding non-tiered project types
  const tiers = [[], [], []];

  for (const svc of services) {
    if (NON_TIERED_TYPES.has(svc.projectType)) continue;
    const tier = Math.min(Math.max(svc.deployTier ?? 2, 0), 2);
    // @ts-ignore
    tiers[tier].push(svc);
  }

  // Sort each tier alphabetically for consistent ordering
  for (const tier of tiers) tier.sort((a: any, b: any) => a.name.localeCompare(b.name));

  return tiers;
}

// ── Extract non-tiered projects (Library, Kit, Tool) ────────────
function computeLibraries(services: any) {
  return services
    // @ts-ignore
    .filter((svc: any) => NON_TIERED_TYPES.has(svc.projectType))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
}

// ── Compute cluster dimensions for a given layer ────────────────
// @ts-ignore
function clusterSize(count, maxCols = MAX_COLS) {
  if (count === 0) return { cols: 0, rows: 0, w: 0, h: 0 };
  const cols = Math.min(count, maxCols);
  const rows = Math.ceil(count / cols);
  const w = cols * (NODE_W + CLUSTER_GAP_X) - CLUSTER_GAP_X + CLUSTER_PAD * 2;
  const h = rows * (NODE_H + CLUSTER_GAP_Y) - CLUSTER_GAP_Y + CLUSTER_PAD * 2;
  return { cols, rows, w, h };
}

// ── Assign positions from layers (grid clusters) ─────────────────
// @ts-ignore
function layoutNodes(layers, libs) {
  const LABEL_H = 28; // height reserved for tier label above cluster
  const positions = {};

  // ── Libraries column (left side) ──────────────────────────
  const libSize = clusterSize(libs.length, LIBS_MAX_COLS);
  let libsColumnW = 0;

  if (libs.length > 0) {
    libsColumnW = libSize.w + LIBS_GAP;

    // @ts-ignore
    libs.forEach((svc, si) => {
      const col = si % LIBS_MAX_COLS;
      const row = Math.floor(si / LIBS_MAX_COLS);
      // @ts-ignore
      positions[svc.id] = {
        x: CLUSTER_PAD + col * (NODE_W + CLUSTER_GAP_X),
        y: LABEL_H + CLUSTER_PAD + row * (NODE_H + CLUSTER_GAP_Y),
      };
    });
  }

  // ── Tier columns (right side, offset by libs width) ───────
  // @ts-ignore
  const sizes = layers.map((l) => clusterSize(l.length));
  // @ts-ignore
  const maxW = Math.max(...sizes.map((s) => s.w), 0);

  let curY = 0;

  // @ts-ignore
  layers.forEach((layer, li) => {
    if (!layer.length) return;
    const { cols, w, h } = sizes[li];
    const clusterX = libsColumnW + (maxW - w) / 2;
    const clusterY = curY + LABEL_H;

    // @ts-ignore
    layer.forEach((svc, si) => {
      const col = si % cols;
      const row = Math.floor(si / cols);
      // @ts-ignore
      positions[svc.id] = {
        x: clusterX + CLUSTER_PAD + col * (NODE_W + CLUSTER_GAP_X),
        y: clusterY + CLUSTER_PAD + row * (NODE_H + CLUSTER_GAP_Y),
      };
    });

    curY = clusterY + h + TIER_SPACING;
  });

  return { positions, libsColumnW };
}

// ── Collect edges ────────────────────────────────────────────────
function collectEdges(services: any) {
  // @ts-ignore
  const idSet = new Set(services.map((s) => s.id));
  const edges = [];
  for (const svc of services) {
    for (const dep of svc.dependsOn || []) {
      const depId = typeof dep === "string" ? dep : dep.id;
      const criticality = typeof dep === "string" ? "required" : dep.criticality || "required";
      if (idSet.has(depId)) edges.push({ source: depId, target: svc.id, criticality });
    }
  }
  return edges;
}

// ── Bézier edge path (same as Prism Client workflows) ──────────────────
// @ts-ignore
function edgePath(x1, y1, x2, y2) {
  const dy = Math.abs(y2 - y1);
  const cp = Math.max(dy * 0.5, 50);
  return `M ${x1} ${y1} C ${x1} ${y1 + cp}, ${x2} ${y2 - cp}, ${x2} ${y2}`;
}

// ── Main Component ───────────────────────────────────────────────
export default function TopologyComponent() {
  const [allServices, setAllServices] = useState<any[]>([]);
  const [tierColors, setTierColors] = useState(DEPLOY_TIER_COLORS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [tooltipData, setTooltipData] = useState<any>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef(null);

  // Draggable node positions (overrides layout)
  const [posOverrides, setPosOverrides] = useState<any>({});

  // Pan / zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [dragging, setDragging] = useState<any>(null);

  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const zoomRef = useRef(zoom);
  const didFetch = useRef(false);

  // Cluster (group) dragging
  const clusterDragging = useRef(null);

  // Keep zoomRef in sync
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // ── Data fetching ───────────────────────────────────────────
  async function loadData(refresh = false) {
    try {
      const res = await ApiService.getServices(refresh);
      // @ts-ignore
      const svcs = (res.services || []).map((s) => ({ ...s, isInfrastructure: false }));
      // @ts-ignore
      const infra = (res.infrastructure || []).map((s) => ({ ...s, isInfrastructure: true }));
      setAllServices([...svcs, ...infra]);
      if (res.deployTierColors) setTierColors(res.deployTierColors);
    } catch (error) {
      console.error("Topology fetch failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const didCenterRef = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadData(true);
  }, []);

  const handleRefresh = () => { setRefreshing(true); loadData(true); };

  // ── Computed layout ─────────────────────────────────────────
  const layers = useMemo(() => computeLayers(allServices), [allServices]);
  const libs = useMemo(() => computeLibraries(allServices), [allServices]);
  const { positions: basePositions } = useMemo(() => layoutNodes(layers, libs), [layers, libs]);
  const edges = useMemo(() => collectEdges(allServices), [allServices]);

  // Merged positions (base + overrides from dragging)
  const positions = useMemo(() => {
    const merged = { ...basePositions };
    for (const [id, pos] of Object.entries(posOverrides)) {
      // @ts-ignore
      if (merged[id]) merged[id] = pos;
    }
    return merged;
  }, [basePositions, posOverrides]);

  // Dynamic cluster rects — computed from actual node positions (follows dragging)
  const dynamicClusterRects = useMemo(() => {
    return layers.map((layer, li) => {
      if (!layer.length) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const svc of layer) {
        // @ts-ignore
        const pos = positions[svc.id];
        if (!pos) continue;
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + NODE_W);
        maxY = Math.max(maxY, pos.y + NODE_H);
      }
      if (minX === Infinity) return null;
      return {
        x: minX - CLUSTER_PAD,
        y: minY - CLUSTER_PAD,
        w: maxX - minX + CLUSTER_PAD * 2,
        h: maxY - minY + CLUSTER_PAD * 2,
        tier: li,
      };
    });
  }, [layers, positions]);

  // Dynamic rect for the libraries cluster
  const libsClusterRect = useMemo(() => {
    if (!libs.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const svc of libs) {
      // @ts-ignore
      const pos = positions[svc.id];
      if (!pos) continue;
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + NODE_W);
      maxY = Math.max(maxY, pos.y + NODE_H);
    }
    if (minX === Infinity) return null;
    return {
      x: minX - CLUSTER_PAD,
      y: minY - CLUSTER_PAD,
      w: maxX - minX + CLUSTER_PAD * 2,
      h: maxY - minY + CLUSTER_PAD * 2,
    };
  }, [libs, positions]);

  const healthyCount = allServices.filter((s) => s.healthy).length;

  // ── Search filtering ────────────────────────────────────────
  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null; // null = no filter active
    const matched = new Set();
    for (const svc of allServices) {
      const haystack = [svc.name, svc.device, svc.projectType, svc.environment, svc.url]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (haystack.includes(q)) matched.add(svc.id);
    }
    return matched;
  }, [searchQuery, allServices]);

  // Which tier clusters have at least one visible node under search
  const searchVisibleTiers = useMemo(() => {
    if (!searchMatches) return null;
    const visible = new Set();
    layers.forEach((layer, li) => {
      for (const svc of layer) {
        // @ts-ignore
        if (searchMatches.has(svc.id)) { visible.add(li); break; }
      }
    });
    return visible;
  }, [searchMatches, layers]);

  // ── Upstream dependency chain + immediate downstream from selected node ──
  const connectedNodes = useMemo(() => {
    if (!selectedNode) return new Set();

    const upstream = new Map();   // target → [sources]
    const downstream = new Map(); // source → [targets]
    for (const e of edges) {
      if (!upstream.has(e.target)) upstream.set(e.target, []);
      upstream.get(e.target).push(e.source);
      if (!downstream.has(e.source)) downstream.set(e.source, []);
      downstream.get(e.source).push(e.target);
    }

    // Walk full upstream chain
    const visited = new Set([selectedNode]);
    const queue = [selectedNode];
    while (queue.length > 0) {
      const id = queue.shift();
      for (const dep of upstream.get(id) || []) {
        if (!visited.has(dep)) { visited.add(dep); queue.push(dep); }
      }
    }

    // Add immediate downstream (one level only)
    for (const child of downstream.get(selectedNode) || []) {
      visited.add(child);
    }

    return visited;
  }, [selectedNode, edges]);


  // ── Coordinate conversion ───────────────────────────────────
  // @ts-ignore
  const screenToSvg = useCallback((clientX, clientY) => {
    // @ts-ignore
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // ── Node drag ───────────────────────────────────────────────
  // @ts-ignore
  const handleNodeMouseDown = useCallback((e, svc) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedNode(svc.id);
    // @ts-ignore
    const pos = positions[svc.id];
    if (!pos) return;
    const svgPos = screenToSvg(e.clientX, e.clientY);
    setDragging({
      nodeId: svc.id,
      offsetX: svgPos.x - pos.x,
      offsetY: svgPos.y - pos.y,
    });
  }, [positions, screenToSvg]);

  // ── Cluster (group) drag ────────────────────────────────────
  // @ts-ignore
  const handleClusterMouseDown = useCallback((e, clusterType, clusterIndex) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedNode(null);

    const svgPos = screenToSvg(e.clientX, e.clientY);
    const memberIds = clusterType === "libs"
      // @ts-ignore
      ? libs.map((s) => s.id)
      // @ts-ignore
      : (layers[clusterIndex] || []).map((s) => s.id);

    // Snapshot current positions of all cluster members
    const origPositions = {};
    for (const id of memberIds) {
      // @ts-ignore
      const pos = positions[id];
      // @ts-ignore
      if (pos) origPositions[id] = { x: pos.x, y: pos.y };
    }

    // @ts-ignore
    clusterDragging.current = {
      startX: svgPos.x,
      startY: svgPos.y,
      memberIds,
      origPositions,
    };
  }, [screenToSvg, libs, layers, positions]);

  // ── Canvas pan ──────────────────────────────────────────────
  // @ts-ignore
  const handleCanvasMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const element = e.target;
    if (element.closest("[data-topo-node]") || element.closest("[data-topo-cluster]")) return;
    setSelectedNode(null); // deselect on background click
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  // @ts-ignore
  const handleMouseMove = useCallback((e) => {
    // Single node drag
    if (dragging) {
      const svgPos = screenToSvg(e.clientX, e.clientY);
      // @ts-ignore
      setPosOverrides((prev) => ({
        ...prev,
        [dragging.nodeId]: {
          x: svgPos.x - dragging.offsetX,
          y: svgPos.y - dragging.offsetY,
        },
      }));
      return;
    }
    // Cluster (group) drag
    if (clusterDragging.current) {
      const svgPos = screenToSvg(e.clientX, e.clientY);
      const { startX, startY, origPositions } = clusterDragging.current;
      const dx = svgPos.x - startX;
      const dy = svgPos.y - startY;
      // @ts-ignore
      setPosOverrides((prev) => {
        const next = { ...prev };
        for (const [id, orig] of Object.entries(origPositions)) {
          // @ts-ignore
          next[id] = { x: orig.x + dx, y: orig.y + dy };
        }
        return next;
      });
      return;
    }
    // Canvas pan
    if (isPanning) {
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      });
    }
  }, [dragging, isPanning, screenToSvg]);

  const handleMouseUp = useCallback(() => {
    if (dragging) setDragging(null);
    if (clusterDragging.current) clusterDragging.current = null;
    if (isPanning) setIsPanning(false);
  }, [dragging, isPanning]);

  // ── Zoom toward cursor ──────────────────────────────────────
  // @ts-ignore
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    // @ts-ignore
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const cur = zoomRef.current;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const next = Math.min(3, Math.max(0.2, cur * delta));
    const ratio = next / cur;
    zoomRef.current = next;
    setPan((p) => ({ x: mouseX - ratio * (mouseX - p.x), y: mouseY - ratio * (mouseY - p.y) }));
    setZoom(next);
  }, []);

  // Attach listeners
  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    const element = containerRef.current;
    // @ts-ignore
    element?.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      // @ts-ignore
      element?.removeEventListener("wheel", handleWheel);
    };
  }, [handleMouseMove, handleMouseUp, handleWheel]);

  const zoomIn = () => { const n = Math.min(3, zoom * 1.25); setZoom(n); zoomRef.current = n; };
  const zoomOut = () => { const n = Math.max(0.2, zoom * 0.8); setZoom(n); zoomRef.current = n; };

  // ── Center topology in viewport ─────────────────────────────
  const centerOnContent = useCallback(() => {
    const element = containerRef.current;
    if (!element || allServices.length === 0) return;
    // @ts-ignore
    const rect = element.getBoundingClientRect();
    // compute bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pos of Object.values(basePositions)) {
      // @ts-ignore
      minX = Math.min(minX, pos.x);
      // @ts-ignore
      minY = Math.min(minY, pos.y);
      // @ts-ignore
      maxX = Math.max(maxX, pos.x + NODE_W);
      // @ts-ignore
      maxY = Math.max(maxY, pos.y + NODE_H);
    }
    if (minX === Infinity) return;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const padFraction = 0.08; // 8% padding on each side
    const scaleX = rect.width * (1 - padFraction * 2) / contentW;
    const scaleY = rect.height * (1 - padFraction * 2) / contentH;
    const fitZoom = Math.min(scaleX, scaleY, 1.4); // cap so it doesn't zoom in too much
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setPan({
      x: rect.width / 2 - cx * fitZoom,
      y: rect.height / 2 - cy * fitZoom,
    });
    setZoom(fitZoom);
    zoomRef.current = fitZoom;
  }, [basePositions, allServices]);

  const zoomFit = () => { centerOnContent(); };

  // Auto-center once data loads
  useEffect(() => {
    if (didCenterRef.current || allServices.length === 0) return;
    // Wait one frame for the container to have dimensions
    requestAnimationFrame(() => {
      centerOnContent();
      didCenterRef.current = true;
    });
  }, [allServices, centerOnContent]);

  // ── Tooltip ─────────────────────────────────────────────────
  // @ts-ignore
  const handleNodeEnter = useCallback((e, svc) => {
    setHoveredNode(svc.id);
    setTooltipPos({ x: e.clientX, y: e.clientY });
    setTooltipData(svc);
  }, []);
  // @ts-ignore
  const handleNodeMove = useCallback((e) => {
    if (hoveredNode) setTooltipPos({ x: e.clientX, y: e.clientY });
  }, [hoveredNode]);
  const handleNodeLeave = useCallback(() => {
    setHoveredNode(null); setTooltipData(null);
  }, []);

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className={styles.topology}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>Topology</h1>
            <p className={styles.subtitle}>
              {loading ? "Loading…" : `${allServices.length} services · ${healthyCount} healthy`}
            </p>
          </div>
          <div className={styles.headerActions}>
            <div className={`${styles.searchWrapper}${searchFocused || searchQuery ? ` ${styles.searchExpanded}` : ""}`}>
              <Search size={14} strokeWidth={2} className={styles.searchIcon} />
              <input
                ref={searchRef}
                type="text"
                className={styles.searchInput}
                placeholder="Filter nodes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                // @ts-ignore
                onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); searchRef.current?.blur(); } }}
              />
              {searchQuery && (
                <button
                  className={styles.searchClear}
                  // @ts-ignore
                  onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }}
                  tabIndex={-1}
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              )}
            </div>
            <ButtonComponent
              variant="secondary"
              icon={RefreshCw}
              loading={refreshing}
              onClick={handleRefresh}
            >
              Refresh
            </ButtonComponent>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingIndicatorComponent size="small" label="Building topology…" className="loading-center" />
      ) : (
        <>
          <div
            ref={containerRef}
            className={`${styles.canvasWrapper}${isPanning ? ` ${styles.panning}` : ""}`}
            onMouseDown={handleCanvasMouseDown}
          >
            <svg ref={svgRef} className={styles.svg} style={{ overflow: "visible" }}>
              <defs>
                {/* Rainbow flowing gradient — same as Prism Client workflows */}
                <linearGradient id="prism-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="300">
                  <stop offset="0%" stopColor="#ff0000" />
                  <stop offset="16%" stopColor="#ff8800" />
                  <stop offset="33%" stopColor="#ffff00" />
                  <stop offset="50%" stopColor="#00ff88" />
                  <stop offset="66%" stopColor="#0088ff" />
                  <stop offset="83%" stopColor="#8800ff" />
                  <stop offset="100%" stopColor="#ff0088" />
                  <animateTransform attributeName="gradientTransform" type="rotate" from="0 150 150" to="360 150 150" dur="2s" repeatCount="indefinite" />
                </linearGradient>
              </defs>
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* ── Edges ── */}
                {edges.map((edge, i) => {
                  // @ts-ignore
                  const sp = positions[edge.source];
                  // @ts-ignore
                  const tp = positions[edge.target];
                  if (!sp || !tp) return null;

                  const x1 = sp.x + NODE_W / 2;
                  const y1 = sp.y + NODE_H;
                  const x2 = tp.x + NODE_W / 2;
                  const y2 = tp.y;

                  const isSelected = connectedNodes.has(edge.source) && connectedNodes.has(edge.target);
                  const isHovered = hoveredNode === edge.source || hoveredNode === edge.target;
                  const isActive = isSelected || isHovered;
                  const isOptional = edge.criticality === "optional";
                  const isFadedBySelection = selectedNode && !isSelected;
                  const isFadedBySearch = searchMatches && (!searchMatches.has(edge.source) || !searchMatches.has(edge.target));
                  const isFaded = isFadedBySelection || isFadedBySearch;
                  const d = edgePath(x1, y1, x2, y2);

                  return (
                    <g key={`${edge.source}-${edge.target}-${i}`} className={`${styles.connectionGroup}${isSelected ? ` ${styles.connectionFlowing}` : ""}${isFaded ? ` ${styles.edgeFaded}` : ""}`}>
                      <path d={d} stroke="transparent" strokeWidth={12} fill="none" />
                      <path
                        d={d}
                        stroke={isSelected ? "url(#prism-gradient)" : "var(--border-color)"}
                        strokeWidth={isActive ? 2.5 : isOptional ? 1 : 1.5}
                        fill="none"
                        strokeOpacity={isActive ? 0.9 : isOptional ? 0.2 : 0.35}
                        strokeDasharray={isOptional && !isSelected ? "6 4" : "none"}
                        className={styles.connectionLine}
                      />
                    </g>
                  );
                })}

                {/* ── Libraries cluster background + label ── */}
                {libsClusterRect && (
<g className={(selectedNode ? styles.tierLabelFaded : "") + (searchVisibleTiers && !libs.some((s: any) => searchMatches?.has(s.id)) ? ` ${styles.tierLabelFaded}` : "") || undefined}>
                    <rect
                      x={libsClusterRect.x}
                      y={libsClusterRect.y}
                      width={libsClusterRect.w}
                      height={libsClusterRect.h}
                      rx={10}
                      ry={10}
                      className={`${styles.clusterRect} ${styles.clusterDraggable}`}
                      style={{ stroke: LIBS_CLUSTER_COLOR.stroke, fill: LIBS_CLUSTER_COLOR.fill }}
                      data-topo-cluster
                      onMouseDown={(e) => handleClusterMouseDown(e, "libs", -1)}
                    />
                    {/* Drag handle icon */}
                    <foreignObject
                      x={libsClusterRect.x + 8}
                      y={libsClusterRect.y + 6}
                      width={16}
                      height={16}
                      className={styles.clusterDragHandle}
                      data-topo-cluster
                      onMouseDown={(e) => handleClusterMouseDown(e, "libs", -1)}
                    >
                      <Move size={12} strokeWidth={1.5} />
                    </foreignObject>
                    <text
                      x={libsClusterRect.x + libsClusterRect.w / 2}
                      y={libsClusterRect.y - 10}
                      className={styles.tierLabel}
                      textAnchor="middle"
                      dominantBaseline="auto"
                    >
                      {LIBS_LABEL}
                    </text>
                  </g>
                )}

                {/* ── Cluster backgrounds + tier labels ── */}
                {dynamicClusterRects.map((cr, li) => {
                  if (!cr) return null;
                  // @ts-ignore
                  const tc = tierColors[li] || DEPLOY_TIER_COLORS[li] || DEPLOY_TIER_COLORS[0];
                  return (
                    <g key={`cluster-${li}`} className={(selectedNode ? styles.tierLabelFaded : "") + (searchVisibleTiers && !searchVisibleTiers.has(li) ? ` ${styles.tierLabelFaded}` : "") || undefined}>
                      <rect
                        x={cr.x}
                        y={cr.y}
                        width={cr.w}
                        height={cr.h}
                        rx={10}
                        ry={10}
                        className={`${styles.clusterRect} ${styles.clusterDraggable}`}
                        style={{ stroke: tc.stroke, fill: tc.fill }}
                        data-topo-cluster
                        onMouseDown={(e) => handleClusterMouseDown(e, "tier", li)}
                      />
                      {/* Drag handle icon */}
                      <foreignObject
                        x={cr.x + 8}
                        y={cr.y + 6}
                        width={16}
                        height={16}
                        className={styles.clusterDragHandle}
                        data-topo-cluster
                        onMouseDown={(e) => handleClusterMouseDown(e, "tier", li)}
                      >
                        <Move size={12} strokeWidth={1.5} />
                      </foreignObject>
                      <text
                        x={cr.x + cr.w / 2}
                        y={cr.y - 10}
                        className={styles.tierLabel}
                        textAnchor="middle"
                        dominantBaseline="auto"
                      >
                        {TIER_LABELS[li] || `Tier ${li}`}
                      </text>
                    </g>
                  );
                })}

                {/* ── Nodes ── */}
                {allServices.map((svc: any) => {
                  // @ts-ignore
                  const pos = positions[svc.id];
                  if (!pos) return null;
                  const Icon = getIcon(svc);
                  const isHov = hoveredNode === svc.id;
                  const isDragging = dragging?.nodeId === svc.id;
                  const isFadedBySelection = selectedNode && !connectedNodes.has(svc.id);
                  const isFadedBySearch = searchMatches && !searchMatches.has(svc.id);
                  const isFaded = isFadedBySelection || isFadedBySearch;

                  // @ts-ignore
                  const ptc = SERVICE_TYPE_COLORS[svc.projectType] || SERVICE_TYPE_COLORS.Service;
                  const healthClass = svc.healthy ? styles.nodeHealthy : styles.nodeDown;
                  const nodeColor = svc.healthy ? ptc.color : undefined;

                  return (
                    <foreignObject
                      key={svc.id}
                      x={pos.x}
                      y={pos.y}
                      width={NODE_W}
                      height={NODE_H}
                      data-topo-node
                      style={{ overflow: "visible" }}
                    >
                      <div
                        className={`${styles.nodeCard} ${healthClass} ${isHov ? styles.nodeHovered : ""} ${isDragging ? styles.nodeDragging : ""} ${selectedNode === svc.id ? styles.nodeSelected : ""}${isFaded ? ` ${styles.nodeFaded}` : ""}`}
                        onMouseDown={(e) => handleNodeMouseDown(e, svc)}
                        onMouseEnter={(e) => handleNodeEnter(e, svc)}
                        onMouseMove={handleNodeMove}
                        onMouseLeave={handleNodeLeave}
                        style={svc.healthy ? { borderColor: `color-mix(in srgb, ${ptc.color} 15%, transparent)` } : undefined}
                      >
                        <div className={styles.nodeGlow} style={nodeColor ? { boxShadow: `0 0 20px ${ptc.subtle}` } : undefined} />
                        <div className={`${styles.statusDot} ${svc.healthy ? styles.statusHealthy : styles.statusDown}`} />
                        <div className={styles.nodeIconWrap} style={nodeColor ? { color: nodeColor } : undefined}><Icon size={18} strokeWidth={1.5} /></div>
                        <span className={styles.nodeName}>{svc.name}</span>
                        {svc.device && <span className={styles.nodeHost}>{svc.device}</span>}
                      </div>
                    </foreignObject>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* Legend */}
          <div className={styles.legend}>
            <div className={styles.legendTitle}>Legend</div>
            <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: "var(--success)", boxShadow: "0 0 6px var(--success-subtle)" }} /><span>Healthy</span></div>
            <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: "var(--danger)", boxShadow: "0 0 6px var(--danger-subtle)" }} /><span>Down</span></div>
            <div className={styles.legendSep} />
            {Object.entries(SERVICE_TYPE_COLORS).map(([type, colors]) => (
              <div key={type} className={styles.legendItem}><div className={styles.legendDot} style={{ background: colors.color, boxShadow: `0 0 6px ${colors.subtle}` }} /><span>{type}</span></div>
            ))}
            <div className={styles.legendSep} />
            <div className={styles.legendItem}><div className={styles.legendLine} /><span>Required</span></div>
            <div className={styles.legendItem}><div className={styles.legendLine} style={{ borderTopStyle: "dashed", opacity: 0.5 }} /><span>Optional</span></div>
          </div>

          {/* Zoom */}
          <div className={styles.zoomControls}>
            <button className={styles.zoomBtn} onClick={zoomIn} title="Zoom in"><ZoomIn size={15} strokeWidth={1.8} /></button>
            <button className={styles.zoomBtn} onClick={zoomOut} title="Zoom out"><ZoomOut size={15} strokeWidth={1.8} /></button>
            <button className={styles.zoomBtn} onClick={zoomFit} title="Fit to view"><Maximize2 size={14} strokeWidth={1.8} /></button>
          </div>

          {/* Tooltip */}
          {tooltipData && (
            <div className={styles.tooltip} style={{
              left: Math.min(tooltipPos.x + 16, (typeof window !== "undefined" ? window.innerWidth : 1000) - 300),
              top: tooltipPos.y - 10,
            }}>
              <div className={styles.tooltipName}>{tooltipData.name}</div>
              <div className={styles.tooltipRow}><span className={styles.tooltipLabel}>Status</span><span className={`${styles.tooltipValue} ${tooltipData.healthy ? styles.tooltipHealthy : styles.tooltipUnhealthy}`}>{tooltipData.healthy ? "Healthy" : "Down"}</span></div>
              {tooltipData.device && <div className={styles.tooltipRow}><span className={styles.tooltipLabel}>Device</span><span className={styles.tooltipValue}>{tooltipData.device}</span></div>}
              {tooltipData.url && <div className={styles.tooltipRow}><span className={styles.tooltipLabel}>URL</span><span className={styles.tooltipValue}>{tooltipData.url}</span></div>}
              <div className={styles.tooltipRow}><span className={styles.tooltipLabel}>Environment</span><span className={styles.tooltipValue}>{tooltipData.environment}</span></div>
              {tooltipData.visibility && <div className={styles.tooltipRow}><span className={styles.tooltipLabel}>Visibility</span><span className={styles.tooltipValue}>{tooltipData.visibility}</span></div>}
              {tooltipData.responseTimeMs != null && <div className={styles.tooltipRow}><span className={styles.tooltipLabel}>Latency</span><span className={styles.tooltipValue}>{tooltipData.responseTimeMs}ms</span></div>}
              {tooltipData.error && !tooltipData.healthy && <div className={styles.tooltipRow}><span className={styles.tooltipLabel}>Error</span><span className={`${styles.tooltipValue} ${styles.tooltipUnhealthy}`}>{tooltipData.error}</span></div>}
              {tooltipData.dependsOn?.length > 0 && (() => {
                // @ts-ignore
                const required = tooltipData.dependsOn.filter((d: any) => (typeof d === "string" ? true : d.criticality !== "optional"));
                // @ts-ignore
                const optional = tooltipData.dependsOn.filter((d: any) => (typeof d === "string" ? false : d.criticality === "optional"));
                return (
                  <div className={styles.tooltipDeps}>
                    {required.length > 0 && (
                      <>
                        <span className={styles.tooltipDepLabel}>↑ Requires</span>
<span className={styles.tooltipDepList}>{required.map((d: any) => (typeof d === "string" ? d : d.name)).join(", ")}</span>
                      </>
                    )}
                    {optional.length > 0 && (
                      <>
                        <span className={`${styles.tooltipDepLabel} ${styles.tooltipDepLabelOptional}`}>↑ Optional</span>
<span className={`${styles.tooltipDepList} ${styles.tooltipDepListOptional}`}>{optional.map((d: any) => (typeof d === "string" ? d : d.name)).join(", ")}</span>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
