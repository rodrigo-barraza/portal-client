"use client";

import { Fragment, useMemo } from "react";
import { Layers } from "lucide-react";
import { Panel } from "../AnalyticsPrimitives";
import { buildHourlyGrid, WEEKDAYS, type HourlyCell } from "./analyticsSeries";
import { formatExact } from "./analyticsFormat";
import { CHART_COLORS } from "./palette";
import styles from "../WebAnalytics.module.css";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const HEAT_COLOR = CHART_COLORS[0];

/**
 * Traffic by hour and weekday — a Monday-first 7×24 grid (GA4 active users
 * in the property's timezone, or first-party sessions started in the
 * report's). Cell opacity scales with the busiest cell.
 */
export default function HourlyHeatmapComponent({
  cells,
  title = "Traffic by Hour & Day",
  noun = "users",
  meta,
}: {
  cells: HourlyCell[];
  title?: string;
  /** What a cell counts, plural ("users", "sessions"). */
  noun?: string;
  meta?: string;
}) {
  const grid = useMemo(() => buildHourlyGrid(cells), [cells]);

  const description = grid.peak
    ? `${formatExact(grid.total)} ${noun} across the week; busiest ${grid.peak.day} ${grid.peak.hour}:00 with ${formatExact(grid.peak.value)}.`
    : `No ${noun} recorded by hour.`;

  return (
    <Panel icon={Layers} title={title} meta={meta}>
      <div
        className={styles["heatmap-container"]}
        role="img"
        aria-label={description}
      >
        <div className={styles["heatmap-corner"]} />
        {HOURS.map((hour) => (
          <div key={hour} className={styles["heatmap-col-label"]}>
            {hour}
          </div>
        ))}
        {WEEKDAYS.map((day, dayIndex) => (
          <Fragment key={day}>
            <div className={styles["heatmap-row-label"]}>{day.slice(0, 3)}</div>
            {HOURS.map((hour) => {
              const value = grid.values[dayIndex][hour];
              const intensity = grid.max > 0 ? value / grid.max : 0;
              return (
                <div
                  key={hour}
                  className={styles["heatmap-cell"]}
                  style={{
                    background: `color-mix(in srgb, ${HEAT_COLOR} ${Math.round(6 + intensity * 84)}%, transparent)`,
                  }}
                  title={`${day} ${hour}:00 — ${formatExact(value)} ${noun}`}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </Panel>
  );
}
