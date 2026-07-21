"use client";

// ============================================================
// HeatmapPanelComponent — page interaction heatmap
// ============================================================
// Renders a canvas density map from the normalized cursor/click/scroll grid
// returned by sessions-service /stats/heatmap. Aggregates across many sessions
// for one page path + viewport band (a phone and a desktop layout are never
// mixed into the same grid).
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Flame } from "lucide-react";
import ApiService from "../services/ApiService";
import styles from "./HeatmapPanelComponent.module.css";

interface HeatmapCell {
  gx: number;
  gy: number;
  count: number;
}
interface HeatmapData {
  path: string;
  band: string | null;
  type: string;
  grid: number;
  max: number;
  total: number;
  cells: HeatmapCell[];
}
interface HeatmapResponse {
  success?: boolean;
  data?: HeatmapData;
}

type InteractionType = "move" | "click" | "scroll";
type Band = "mobile" | "tablet" | "desktop";
type PanelStatus = "loading" | "ready" | "empty" | "error";

const CANVAS_RESOLUTION = 600;
const TYPES: { key: InteractionType; label: string }[] = [
  { key: "move", label: "Moves" },
  { key: "click", label: "Clicks" },
  { key: "scroll", label: "Scroll" },
];
const BANDS: Band[] = ["mobile", "tablet", "desktop"];

export default function HeatmapPanelComponent({
  projectId,
  period,
  paths,
}: {
  projectId: string;
  period: string;
  paths: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Store only the user's explicit choice; derive the effective path so it
  // stays valid as the page list loads in — no setState-in-effect syncing.
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [type, setType] = useState<InteractionType>("move");
  const [band, setBand] = useState<Band>("desktop");
  const [data, setData] = useState<HeatmapData | null>(null);
  const [status, setStatus] = useState<PanelStatus>("loading");

  const path = selectedPath && paths.includes(selectedPath) ? selectedPath : paths[0] ?? "/";

  // Fetch the density grid whenever a control changes.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      try {
        const response = (await ApiService.getSessionHeatmap(
          projectId,
          path,
          period,
          type,
          band,
        )) as HeatmapResponse;
        if (cancelled) return;
        const payload = response?.data ?? null;
        setData(payload);
        setStatus(payload && payload.cells.length > 0 ? "ready" : "empty");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    if (path) void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, path, period, type, band]);

  // Paint the grid. Blurred rects give a smooth heat gradient; hue runs from
  // blue (cold/low) to red (hot/high) with alpha scaled by intensity.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const size = CANVAS_RESOLUTION;
    context.clearRect(0, 0, size, size);
    context.fillStyle = "#0a0a0f";
    context.fillRect(0, 0, size, size);

    if (!data || data.cells.length === 0 || data.max <= 0) return;

    const grid = data.grid || 50;
    const cellSize = size / grid;
    context.filter = `blur(${Math.max(cellSize * 0.75, 2)}px)`;
    for (const cell of data.cells) {
      const intensity = Math.min(cell.count / data.max, 1);
      const hue = (1 - intensity) * 240;
      const alpha = 0.15 + intensity * 0.8;
      context.fillStyle = `hsla(${hue}, 100%, 50%, ${alpha})`;
      context.fillRect(cell.gx * cellSize, cell.gy * cellSize, cellSize, cellSize);
    }
    context.filter = "none";
  }, [data]);

  const hasPaths = paths.length > 0;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Flame size={14} strokeWidth={2.2} />
        <span>Page Heatmap</span>
        {status === "ready" && data && (
          <span className={styles.count}>{data.total.toLocaleString()} points</span>
        )}
      </div>

      <div className={styles.controls}>
        <select
          className={styles.select}
          value={path}
          onChange={(event) => setSelectedPath(event.target.value)}
          disabled={!hasPaths}
          aria-label="Page path"
        >
          {hasPaths ? (
            paths.map((pagePath) => (
              <option key={pagePath} value={pagePath}>
                {pagePath}
              </option>
            ))
          ) : (
            <option value="/">/</option>
          )}
        </select>

        <div className={styles.toggle}>
          {TYPES.map((typeOption) => (
            <button
              key={typeOption.key}
              className={`${styles.toggleButton} ${type === typeOption.key ? styles.toggleActive : ""}`}
              onClick={() => setType(typeOption.key)}
            >
              {typeOption.label}
            </button>
          ))}
        </div>

        <div className={styles.toggle}>
          {BANDS.map((bandOption) => (
            <button
              key={bandOption}
              className={`${styles.toggleButton} ${band === bandOption ? styles.toggleActive : ""}`}
              onClick={() => setBand(bandOption)}
            >
              {bandOption[0].toUpperCase() + bandOption.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.stage}>
        <canvas
          ref={canvasRef}
          width={CANVAS_RESOLUTION}
          height={CANVAS_RESOLUTION}
          className={styles.canvas}
        />
        {status === "loading" && <div className={styles.overlay}>Loading…</div>}
        {status === "empty" && (
          <div className={styles.overlay}>No {type} data for this page + band yet.</div>
        )}
        {status === "error" && <div className={styles.overlay}>Could not load heatmap.</div>}
        {status === "ready" && (
          <div className={styles.legend}>
            <span>Low</span>
            <span className={styles.legendBar} />
            <span>High</span>
          </div>
        )}
      </div>
    </div>
  );
}
