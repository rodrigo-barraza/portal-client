"use client";

import { Fragment, useMemo } from "react";
import { Layers } from "lucide-react";
import { Panel } from "../AnalyticsPrimitives";
import { buildHourlyGrid, WEEKDAYS } from "./analyticsSeries";
import { formatExact } from "./analyticsFormat";
import { CHART_COLORS } from "./palette";
import styles from "../WebAnalytics.module.css";
import type { GAHeatmapCell } from "../../types/portal";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const HEAT_COLOR = CHART_COLORS[0];

/**
 * GA4 "Traffic by Hour & Day" — a Monday-first 7×24 grid of active users,
 * in the GA property's timezone. Cell opacity scales with the busiest cell.
 */
export default function HourlyHeatmapComponent({
  cells,
}: {
  cells: GAHeatmapCell[];
}) {
  const grid = useMemo(() => buildHourlyGrid(cells), [cells]);

  const description = grid.peak
    ? `${formatExact(grid.total)} active users across the week; busiest ${grid.peak.day} ${grid.peak.hour}:00 with ${formatExact(grid.peak.users)}.`
    : "No hourly traffic recorded.";

  return (
    <Panel icon={Layers} title="Traffic by Hour & Day">
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
              const users = grid.values[dayIndex][hour];
              const intensity = grid.max > 0 ? users / grid.max : 0;
              return (
                <div
                  key={hour}
                  className={styles["heatmap-cell"]}
                  style={{
                    background: `color-mix(in srgb, ${HEAT_COLOR} ${Math.round(6 + intensity * 84)}%, transparent)`,
                  }}
                  title={`${day} ${hour}:00 — ${formatExact(users)} users`}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </Panel>
  );
}
