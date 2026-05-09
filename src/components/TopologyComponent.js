"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  RefreshCw, ZoomIn, ZoomOut, Maximize2,
} from "lucide-react";
import { ButtonComponent, LoadingIndicatorComponent } from "@rodrigo-barraza/components-library";
import { SERVICE_TYPE_ICONS, DEFAULT_SERVICE_TYPE_ICON, DEPLOY_TIER_COLORS } from "../constants";
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

// ── Icon resolver (by projectType) ──────────────────────────────
function getIcon(svc) {
  return SERVICE_TYPE_ICONS[svc.projectType] || DEFAULT_SERVICE_TYPE_ICON;
}

// ── Tier labels ─────────────────────────────────────────────────
const TIER_LABELS = ["Tier 0 — Foundation", "Tier 1 — Services", "Tier 2 — Clients"];

// ── Fixed tier layering (uses deployTier from project registry) ──
function computeLayers(services) {
  // Group by deployTier, defaulting to tier 2 for unknowns
  const tiers = [[], [], []];

  for (const svc of services) {
    const tier = Math.min(Math.max(svc.deployTier ?? 2, 0), 2);
    tiers[tier].push(svc);
  }

  // Sort each tier alphabetically for consistent ordering
  for (const tier of tiers) tier.sort((a, b) => a.name.localeCompare(b.name));

  return tiers;
}

// ── Compute cluster dimensions for a given layer ────────────────
function clusterSize(count) {
  if (count === 0) return { cols: 0, rows: 0, w: 0, h: 0 };
  const cols = Math.min(count, MAX_COLS);
  const rows = Math.ceil(count / cols);
  const w = cols * (NODE_W + CLUSTER_GAP_X) - CLUSTER_GAP_X + CLUSTER_PAD * 2;
  const h = rows * (NODE_H + CLUSTER_GAP_Y) - CLUSTER_GAP_Y + CLUSTER_PAD * 2;
  return { cols, rows, w, h };
}

// ── Assign positions from layers (grid clusters) ─────────────────
function layoutNodes(layers) {
  const LABEL_H = 28; // height reserved for tier label above cluster
  const positions = {};

  // Compute cluster sizes
  const sizes = layers.map((l) => clusterSize(l.length));

  // Find widest cluster for centering alignment
  const maxW = Math.max(...sizes.map((s) => s.w), 0);

  let curY = 0;

  layers.forEach((layer, li) => {
    if (!layer.length) return;
    const { cols, w, h } = sizes[li];
    const clusterX = (maxW - w) / 2; // center-align cluster
    const clusterY = curY + LABEL_H;

    layer.forEach((svc, si) => {
      const col = si % cols;
      const row = Math.floor(si / cols);
      positions[svc.id] = {
        x: clusterX + CLUSTER_PAD + col * (NODE_W + CLUSTER_GAP_X),
        y: clusterY + CLUSTER_PAD + row * (NODE_H + CLUSTER_GAP_Y),
      };
    });

    curY = clusterY + h + TIER_SPACING;
  });

  return { positions };
}

// ── Collect edges ────────────────────────────────────────────────
function collectEdges(services) {
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
function edgePath(x1, y1, x2, y2) {
  const dy = Math.abs(y2 - y1);
  const cp = Math.max(dy * 0.5, 50);
  return `M ${x1} ${y1} C ${x1} ${y1 + cp}, ${x2} ${y2 - cp}, ${x2} ${y2}`;
}

// ── Main Component ───────────────────────────────────────────────
export default function TopologyComponent() {
  const [allServices, setAllServices] = useState([]);
  const [tierColors, setTierColors] = useState(DEPLOY_TIER_COLORS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [tooltipData, setTooltipData] = useState(null);

  // Draggable node positions (overrides layout)
  const [posOverrides, setPosOverrides] = useState({});

  // Pan / zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [dragging, setDragging] = useState(null);

  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const zoomRef = useRef(zoom);
  const didFetch = useRef(false);

  // Keep zoomRef in sync
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // ── Data fetching ───────────────────────────────────────────
  async function loadData(refresh = false) {
    try {
      const res = await ApiService.getServices(refresh);
      const svcs = (res.services || []).map((s) => ({ ...s, isInfrastructure: false }));
      const infra = (res.infrastructure || []).map((s) => ({ ...s, isInfrastructure: true }));
      setAllServices([...svcs, ...infra]);
      if (res.deployTierColors) setTierColors(res.deployTierColors);
    } catch (err) {
      console.error("Topology fetch failed:", err);
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
  const { positions: basePositions } = useMemo(() => layoutNodes(layers), [layers]);
  const edges = useMemo(() => collectEdges(allServices), [allServices]);

  // Merged positions (base + overrides from dragging)
  const positions = useMemo(() => {
    const merged = { ...basePositions };
    for (const [id, pos] of Object.entries(posOverrides)) {
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

  const healthyCount = allServices.filter((s) => s.healthy).length;

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
  const screenToSvg = useCallback((clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // ── Node drag ───────────────────────────────────────────────
  const handleNodeMouseDown = useCallback((e, svc) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedNode(svc.id);
    const pos = positions[svc.id];
    if (!pos) return;
    const svgPos = screenToSvg(e.clientX, e.clientY);
    setDragging({
      nodeId: svc.id,
      offsetX: svgPos.x - pos.x,
      offsetY: svgPos.y - pos.y,
    });
  }, [positions, screenToSvg]);

  // ── Canvas pan ──────────────────────────────────────────────
  const handleCanvasMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const el = e.target;
    if (el.closest("[data-topo-node]")) return;
    setSelectedNode(null); // deselect on background click
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e) => {
    if (dragging) {
      const svgPos = screenToSvg(e.clientX, e.clientY);
      setPosOverrides((prev) => ({
        ...prev,
        [dragging.nodeId]: {
          x: svgPos.x - dragging.offsetX,
          y: svgPos.y - dragging.offsetY,
        },
      }));
      return;
    }
    if (isPanning) {
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      });
    }
  }, [dragging, isPanning, screenToSvg]);

  const handleMouseUp = useCallback(() => {
    if (dragging) setDragging(null);
    if (isPanning) setIsPanning(false);
  }, [dragging, isPanning]);

  // ── Zoom toward cursor ──────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
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
    const el = containerRef.current;
    el?.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      el?.removeEventListener("wheel", handleWheel);
    };
  }, [handleMouseMove, handleMouseUp, handleWheel]);

  const zoomIn = () => { const n = Math.min(3, zoom * 1.25); setZoom(n); zoomRef.current = n; };
  const zoomOut = () => { const n = Math.max(0.2, zoom * 0.8); setZoom(n); zoomRef.current = n; };

  // ── Center topology in viewport ─────────────────────────────
  const centerOnContent = useCallback(() => {
    const el = containerRef.current;
    if (!el || allServices.length === 0) return;
    const rect = el.getBoundingClientRect();
    // compute bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pos of Object.values(basePositions)) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + NODE_W);
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
  const handleNodeEnter = useCallback((e, svc) => {
    setHoveredNode(svc.id);
    setTooltipPos({ x: e.clientX, y: e.clientY });
    setTooltipData(svc);
  }, []);
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
                  const sp = positions[edge.source];
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
                  const isFaded = selectedNode && !isSelected;
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

                {/* ── Cluster backgrounds + tier labels ── */}
                {dynamicClusterRects.map((cr, li) => {
                  if (!cr) return null;
                  const tc = tierColors[li] || DEPLOY_TIER_COLORS[li] || DEPLOY_TIER_COLORS[0];
                  return (
                    <g key={`cluster-${li}`} className={selectedNode ? styles.tierLabelFaded : undefined}>
                      <rect
                        x={cr.x}
                        y={cr.y}
                        width={cr.w}
                        height={cr.h}
                        rx={10}
                        ry={10}
                        className={styles.clusterRect}
                        style={{ stroke: tc.stroke, fill: tc.fill }}
                      />
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
                {allServices.map((svc) => {
                  const pos = positions[svc.id];
                  if (!pos) return null;
                  const Icon = getIcon(svc);
                  const isHov = hoveredNode === svc.id;
                  const isDragging = dragging?.nodeId === svc.id;
                  const isFaded = selectedNode && !connectedNodes.has(svc.id);

                  const tier = Math.min(Math.max(svc.deployTier ?? 2, 0), 2);
                  const tc = tierColors[tier] || DEPLOY_TIER_COLORS[tier] || DEPLOY_TIER_COLORS[0];
                  const healthClass = svc.healthy ? styles.nodeHealthy : styles.nodeDown;
                  const nodeColor = svc.healthy ? tc.color : undefined;

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
                        style={svc.healthy ? { borderColor: `color-mix(in srgb, ${tc.color} 15%, transparent)` } : undefined}
                      >
                        <div className={styles.nodeGlow} style={nodeColor ? { boxShadow: `0 0 20px ${tc.subtle}` } : undefined} />
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
            <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: (tierColors[0] || DEPLOY_TIER_COLORS[0]).color, boxShadow: `0 0 6px ${(tierColors[0] || DEPLOY_TIER_COLORS[0]).subtle}` }} /><span>Tier 0</span></div>
            <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: (tierColors[1] || DEPLOY_TIER_COLORS[1]).color, boxShadow: `0 0 6px ${(tierColors[1] || DEPLOY_TIER_COLORS[1]).subtle}` }} /><span>Tier 1</span></div>
            <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: (tierColors[2] || DEPLOY_TIER_COLORS[2]).color, boxShadow: `0 0 6px ${(tierColors[2] || DEPLOY_TIER_COLORS[2]).subtle}` }} /><span>Tier 2</span></div>
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
                const required = tooltipData.dependsOn.filter((d) => (typeof d === "string" ? true : d.criticality !== "optional"));
                const optional = tooltipData.dependsOn.filter((d) => (typeof d === "string" ? false : d.criticality === "optional"));
                return (
                  <div className={styles.tooltipDeps}>
                    {required.length > 0 && (
                      <>
                        <span className={styles.tooltipDepLabel}>↑ Requires</span>
                        <span className={styles.tooltipDepList}>{required.map((d) => (typeof d === "string" ? d : d.name)).join(", ")}</span>
                      </>
                    )}
                    {optional.length > 0 && (
                      <>
                        <span className={`${styles.tooltipDepLabel} ${styles.tooltipDepLabelOptional}`}>↑ Optional</span>
                        <span className={`${styles.tooltipDepList} ${styles.tooltipDepListOptional}`}>{optional.map((d) => (typeof d === "string" ? d : d.name)).join(", ")}</span>
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
