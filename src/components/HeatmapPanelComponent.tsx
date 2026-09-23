"use client";

// ============================================================
// HeatmapPanelComponent — page interaction heatmap
// ============================================================
// Renders a canvas density map from the normalized cursor/click/scroll grid
// returned by sessions-service /stats/heatmap. Aggregates across many sessions
// for one page path + viewport band (a phone and a desktop layout are never
// mixed into the same grid).
//
// Coordinates are page-absolute fractions (0..1 of the page's width and
// height), so the square canvas is a normalized map of the page, not a
// to-scale screenshot — a tall page is compressed vertically.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { SegmentedControlComponent } from "@rodrigo-barraza/components-library";
import ApiService from "../services/ApiService";
import type { SessionHeatmap } from "../types/portal";
import useAsyncData, { unwrapData } from "./analytics/useAsyncData";
import { formatExact } from "./analytics/analyticsFormat";
import styles from "./HeatmapPanelComponent.module.css";

type InteractionType = "move" | "click" | "scroll";
type Band = "mobile" | "tablet" | "desktop";

const CANVAS_RESOLUTION = 600;
const DEFAULT_GRID = 50;
/** The stage stays dark in every theme — the hue ramp needs it to read. */
const STAGE_COLOR = "#0a0a0f";
const TYPE_SEGMENTS: { value: InteractionType; label: string }[] = [
  { value: "move", label: "Moves" },
  { value: "click", label: "Clicks" },
  { value: "scroll", label: "Scroll" },
];
const BAND_SEGMENTS: { value: Band; label: string }[] = [
  { value: "mobile", label: "Mobile" },
  { value: "tablet", label: "Tablet" },
  { value: "desktop", label: "Desktop" },
];
const TYPE_NOUNS: Record<InteractionType, string> = {
  move: "cursor movement",
  click: "click",
  scroll: "scroll depth",
};

/**
 * Paint the density grid. Blurred rects give a smooth heat gradient; hue runs
 * from blue (cold/low) to red (hot/high) with alpha scaled by intensity.
 * Cells are clamped into the grid so a malformed coordinate can't paint
 * outside the canvas.
 */
function paintHeatmap(context: CanvasRenderingContext2D, data: SessionHeatmap | null) {
  const size = CANVAS_RESOLUTION;
  context.filter = "none";
  context.clearRect(0, 0, size, size);
  context.fillStyle = STAGE_COLOR;
  context.fillRect(0, 0, size, size);

  if (!data || data.cells.length === 0 || data.max <= 0) return;

  const grid = data.grid > 0 ? data.grid : DEFAULT_GRID;
  const cellSize = size / grid;
  context.filter = `blur(${Math.max(cellSize * 0.75, 2)}px)`;
  for (const cell of data.cells) {
    const column = Math.min(Math.max(Math.floor(cell.gx), 0), grid - 1);
    const row = Math.min(Math.max(Math.floor(cell.gy), 0), grid - 1);
    const intensity = Math.min(cell.count / data.max, 1);
    const hue = (1 - intensity) * 240;
    const alpha = 0.15 + intensity * 0.8;
    context.fillStyle = `hsla(${hue}, 100%, 50%, ${alpha})`;
    context.fillRect(column * cellSize, row * cellSize, cellSize, cellSize);
  }
  context.filter = "none";
}

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

  const path = selectedPath && paths.includes(selectedPath) ? selectedPath : (paths[0] ?? "/");

  const heatmap = useAsyncData(
    JSON.stringify([projectId, path, period, type, band]),
    (signal) =>
      ApiService.getSessionHeatmap(projectId, path, period, type, band, undefined, { signal }).then(
        unwrapData,
      ),
  );
  const data = heatmap.data;
  const status = heatmap.loading
    ? "loading"
    : heatmap.error
      ? "error"
      : data && data.cells.length > 0
        ? "ready"
        : "empty";

  // Repaint on every result — `data` is null while a new grid loads and on
  // failure, so a stale heatmap never sits under the "Loading…"/error text.
  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (context) paintHeatmap(context, data);
  }, [data]);

  const hasPaths = paths.length > 0;
  const description =
    status === "ready" && data
      ? `${TYPE_NOUNS[type]} heatmap of ${path} on ${band}: ${formatExact(data.total)} points.`
      : `${TYPE_NOUNS[type]} heatmap of ${path} on ${band}.`;

  return (
    <section className={styles["panel"]} aria-label="Page heatmap">
      <div className={styles["header"]}>
        <Flame size={14} strokeWidth={2.2} aria-hidden />
        <span>Page Heatmap</span>
        {status === "ready" && data && (
          <span className={styles["count"]}>{formatExact(data.total)} points</span>
        )}
      </div>

      <div className={styles["controls"]}>
        <select
          className={styles["select"]}
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

        <SegmentedControlComponent
          value={type}
          onChange={(value: string) => setType(value as InteractionType)}
          segments={TYPE_SEGMENTS}
          compact
        />
        <SegmentedControlComponent
          value={band}
          onChange={(value: string) => setBand(value as Band)}
          segments={BAND_SEGMENTS}
          compact
        />
      </div>

      <div className={styles["stage"]}>
        <canvas
          ref={canvasRef}
          width={CANVAS_RESOLUTION}
          height={CANVAS_RESOLUTION}
          className={styles["canvas"]}
          role="img"
          aria-label={description}
        />
        {status === "loading" && <div className={styles["overlay"]}>Loading…</div>}
        {status === "empty" && (
          <div className={styles["overlay"]}>No {type} data for this page + band yet.</div>
        )}
        {status === "error" && (
          <div className={styles["overlay"]} role="alert">
            Could not load heatmap.
          </div>
        )}
        {status === "ready" && (
          <div className={styles["legend"]} aria-hidden>
            <span>Low</span>
            <span className={styles["legend-bar"]} />
            <span>High</span>
          </div>
        )}
      </div>
    </section>
  );
}
