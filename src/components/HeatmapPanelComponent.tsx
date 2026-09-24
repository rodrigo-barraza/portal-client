"use client";

// ============================================================
// HeatmapPanelComponent — page click / cursor-movement heatmap
// ============================================================
// Paints the density grid sessions-service /stats/heatmap returns for one
// page path + viewport band (a phone and a desktop layout are never mixed
// into one grid), aggregated across every session in the range.
//
// Points are page-absolute fractions of the full document, so the canvas
// is drawn at the page's own shape: `aspect` (document height / width) is
// the median over the recorded batches. A very long page is capped at
// HEATMAP_MAX_ASPECT and scrolls inside the panel, so it stays usable.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { SegmentedControlComponent } from "@rodrigo-barraza/components-library";
import ApiService from "../services/ApiService";
import type {
  SessionBand,
  SessionHeatmap,
  SessionHeatmapType,
} from "../types/portal";
import useAsyncData, { unwrapData } from "./analytics/useAsyncData";
import {
  HEATMAP_MAX_ASPECT,
  heatmapDisplayAspect,
  toSessionRange,
} from "./analytics/analyticsSeries";
import { formatCount, formatExact } from "./analytics/analyticsFormat";
import styles from "./HeatmapPanelComponent.module.css";

/** Intrinsic canvas width; the height follows the page's aspect. */
const CANVAS_WIDTH = 600;
const DEFAULT_GRID = 50;
/** The stage stays dark in every theme — the hue ramp needs it to read. */
const STAGE_COLOR = "#0a0a0f";

const TYPE_SEGMENTS: { value: SessionHeatmapType; label: string }[] = [
  { value: "click", label: "Clicks" },
  { value: "move", label: "Moves" },
];
const BAND_SEGMENTS: { value: SessionBand; label: string }[] = [
  { value: "mobile", label: "Mobile" },
  { value: "tablet", label: "Tablet" },
  { value: "desktop", label: "Desktop" },
];
const TYPE_NAMES: Record<
  SessionHeatmapType,
  { title: string; unit: [string, string] }
> = {
  click: { title: "Click", unit: ["click", "clicks"] },
  move: { title: "Cursor movement", unit: ["cursor sample", "cursor samples"] },
};

/**
 * Paint the density grid. Blurred rects give a smooth heat gradient; hue
 * runs from blue (cold/low) to red (hot/high) with alpha scaled by
 * intensity. Cells are clamped into the grid so a malformed coordinate
 * can't paint outside the canvas. The server sizes `rows` to the page's
 * shape, so cells are square unless a very long page is compressed.
 */
function paintHeatmap(
  context: CanvasRenderingContext2D,
  data: SessionHeatmap | null,
  width: number,
  height: number,
) {
  context.filter = "none";
  context.clearRect(0, 0, width, height);
  context.fillStyle = STAGE_COLOR;
  context.fillRect(0, 0, width, height);

  if (!data || data.cells.length === 0 || data.max <= 0) return;

  const grid = data.grid > 0 ? data.grid : DEFAULT_GRID;
  const rows = data.rows > 0 ? data.rows : grid;
  const cellWidth = width / grid;
  const cellHeight = height / rows;
  // Sized from both sides: a compressed long page still has cells taller
  // than wide, and a blur fit to the width alone left vertical steps
  const blur = Math.sqrt(cellWidth * cellHeight) * 0.85;
  context.filter = `blur(${Math.max(blur, 2)}px)`;
  for (const cell of data.cells) {
    const column = Math.min(Math.max(Math.floor(cell.gx), 0), grid - 1);
    const row = Math.min(Math.max(Math.floor(cell.gy), 0), rows - 1);
    const intensity = Math.min(cell.count / data.max, 1);
    const hue = (1 - intensity) * 240;
    const alpha = 0.15 + intensity * 0.8;
    context.fillStyle = `hsla(${hue}, 100%, 50%, ${alpha})`;
    context.fillRect(
      column * cellWidth,
      row * cellHeight,
      cellWidth,
      cellHeight,
    );
  }
  context.filter = "none";
}

export default function HeatmapPanelComponent({
  projectId,
  period,
  paths,
}: {
  projectId: string;
  /** The dashboard's period (preset or custom range). */
  period: string;
  /** Pages offered in the picker, busiest first. */
  paths: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Store only the user's explicit choice; derive the effective path so it
  // stays valid as the page list changes — no setState-in-effect syncing.
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [type, setType] = useState<SessionHeatmapType>("click");
  const [band, setBand] = useState<SessionBand>("desktop");

  const path =
    selectedPath && paths.includes(selectedPath)
      ? selectedPath
      : (paths[0] ?? "/");

  // Keep the last grid while the next loads, so the stage keeps its shape
  // instead of collapsing to a square between pages
  const heatmap = useAsyncData(
    JSON.stringify([projectId, path, period, type, band]),
    (signal) =>
      ApiService.getSessionHeatmap(
        projectId,
        path,
        toSessionRange(period),
        band,
        type,
        { signal },
      ).then(unwrapData),
    { keepPreviousData: true },
  );
  const data = heatmap.loading ? null : heatmap.data;
  const status = heatmap.loading
    ? "loading"
    : heatmap.error
      ? "error"
      : data && data.cells.length > 0
        ? "ready"
        : "empty";

  const aspect = heatmapDisplayAspect(heatmap.data?.aspect);
  const compressed = (heatmap.data?.aspect ?? 0) > HEATMAP_MAX_ASPECT;
  const canvasHeight = Math.round(CANVAS_WIDTH * aspect);

  // Repaint on every result and resize — nothing is painted while a new
  // grid loads or after a failure, so a stale heatmap never sits under
  // the "Loading…"/error text.
  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (context) paintHeatmap(context, data, CANVAS_WIDTH, canvasHeight);
  }, [data, canvasHeight]);

  const hasPaths = paths.length > 0;
  const {
    title,
    unit: [singular, plural],
  } = TYPE_NAMES[type];
  const description =
    status === "ready" && data
      ? `${title} heatmap of ${path} on ${band}: ${formatCount(data.total, singular, plural)} from ${formatCount(data.sessions, "session")}.`
      : `${title} heatmap of ${path} on ${band}.`;

  return (
    <section className={styles["panel"]} aria-label="Page heatmap">
      <div className={styles["header"]}>
        <Flame size={14} strokeWidth={2.2} aria-hidden />
        <span>Page Heatmap</span>
        {status === "ready" && data && (
          <span className={styles["count"]}>
            {formatExact(data.total)} {plural} ·{" "}
            {formatCount(data.sessions, "session")}
          </span>
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
          onChange={(value: string) => setType(value as SessionHeatmapType)}
          segments={TYPE_SEGMENTS}
          compact
        />
        <SegmentedControlComponent
          value={band}
          onChange={(value: string) => setBand(value as SessionBand)}
          segments={BAND_SEGMENTS}
          compact
        />

        {status === "ready" && (
          <div className={styles["legend"]} aria-hidden>
            <span>Low</span>
            <span className={styles["legend-bar"]} />
            <span>High</span>
          </div>
        )}
      </div>

      <div className={styles["frame"]} data-band={band}>
        <div className={styles["viewport"]}>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={canvasHeight}
            className={styles["canvas"]}
            role="img"
            aria-label={description}
          />
        </div>
        {status === "loading" && (
          <div className={styles["overlay"]}>Loading…</div>
        )}
        {status === "empty" && (
          <div className={styles["overlay"]}>
            No {plural} recorded on {path} for {band} yet. Heatmaps record only
            on sites that turn them on in the tracker.
          </div>
        )}
        {status === "error" && (
          <div className={styles["overlay"]} role="alert">
            Could not load heatmap.
          </div>
        )}
      </div>

      {status === "ready" && heatmap.data && aspect > 1 && (
        <p className={styles["note"]}>
          {compressed
            ? `A very long page (${heatmap.data.aspect.toFixed(1)}× taller than wide), compressed to ${HEATMAP_MAX_ASPECT}× to stay usable — scroll the map to see all of it.`
            : `The whole page, ${heatmap.data.aspect.toFixed(1)}× taller than wide — scroll the map to see all of it.`}
        </p>
      )}
    </section>
  );
}
