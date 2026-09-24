import { describe, it, expect } from "vitest";
import {
  HEATMAP_MAX_ASPECT,
  buildHourlyGrid,
  describePeriod,
  describeSeries,
  fillDailySeries,
  formatBucket,
  gaHourlyCells,
  gaOverviewDelta,
  gaSeriesWindow,
  heatmapDisplayAspect,
  isCustomPeriod,
  isHourBucket,
  newVsReturningSegments,
  parseCustomPeriod,
  parseIsoDay,
  presetDays,
  sessionHourlyCells,
  shiftIsoDay,
  toCustomPeriod,
  toDonutSegments,
  toSessionRange,
} from "../analyticsSeries";
import { CHART_COLORS, SOURCE_COLORS } from "../palette";

interface Point {
  date?: string;
  views: number;
}
const empty = (date: string): Point => ({ date, views: 0 });

describe("calendar days", () => {
  it("rejects malformed and rolled-over dates", () => {
    expect(parseIsoDay("2026-02-31")).toBeNull();
    expect(parseIsoDay("2026-9-1")).toBeNull();
    expect(parseIsoDay(undefined)).toBeNull();
    expect(parseIsoDay("2026-02-28")).not.toBeNull();
  });

  it("steps whole days across DST changes and month/year ends", () => {
    // North-American DST starts 2026-03-08, ends 2026-11-01
    expect(shiftIsoDay("2026-03-07", 1)).toBe("2026-03-08");
    expect(shiftIsoDay("2026-03-08", 1)).toBe("2026-03-09");
    expect(shiftIsoDay("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftIsoDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftIsoDay("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("periods", () => {
  it("parses presets", () => {
    expect(presetDays("7d")).toBe(7);
    expect(presetDays("90d")).toBe(90);
    expect(presetDays("0d")).toBeNull();
    expect(presetDays("2026-09-01_2026-09-10")).toBeNull();
  });

  it("parses only well-formed custom periods", () => {
    expect(parseCustomPeriod("2026-09-01_2026-09-10")).toEqual({
      from: "2026-09-01",
      to: "2026-09-10",
    });
    expect(parseCustomPeriod("2026-09-01T00:00_2026-09-10")).toBeNull();
    expect(parseCustomPeriod("2026-02-30_2026-03-01")).toBeNull();
    expect(isCustomPeriod("30d")).toBe(false);
  });

  it("normalizes DatePicker selections into GA's whole-day period", () => {
    expect(toCustomPeriod("2026-09-01", "2026-09-10")).toBe(
      "2026-09-01_2026-09-10",
    );
    // datetimes are cut to their day
    expect(toCustomPeriod("2026-09-01T08:30", "2026-09-10T17:00")).toBe(
      "2026-09-01_2026-09-10",
    );
    // reversed selections are ordered
    expect(toCustomPeriod("2026-09-10", "2026-09-01")).toBe(
      "2026-09-01_2026-09-10",
    );
  });

  it("rejects empty or partial selections", () => {
    expect(toCustomPeriod("", "")).toBeNull();
    expect(toCustomPeriod("2026-09-01", "")).toBeNull();
    expect(toCustomPeriod("garbage", "2026-09-01")).toBeNull();
  });

  it("hands sessions-service a custom period as its calendar days", () => {
    expect(toSessionRange("2026-09-01_2026-09-10")).toEqual({
      from: "2026-09-01",
      to: "2026-09-10",
    });
    expect(toSessionRange("30d")).toEqual({ period: "30d" });
    expect(toSessionRange("all")).toEqual({ period: "all" });
  });

  it("describes periods for people", () => {
    expect(describePeriod("30d")).toBe("Last 30 days");
    expect(describePeriod("1d")).toBe("Last day");
    expect(describePeriod("all")).toBe("All time");
    expect(describePeriod("2026-09-01_2026-09-10")).toBe(
      "2026-09-01 → 2026-09-10",
    );
    expect(describePeriod("2026-09-22_2026-09-22")).toBe("2026-09-22");
  });
});

describe("series windows", () => {
  it("only pins GA windows for custom ranges", () => {
    expect(gaSeriesWindow("2026-09-01_2026-09-10")).toEqual({
      start: "2026-09-01",
      end: "2026-09-10",
    });
    expect(gaSeriesWindow("30d")).toBeNull();
  });
});

describe("fillDailySeries", () => {
  it("inserts zero days for gaps between points", () => {
    const filled = fillDailySeries(
      [
        { date: "2026-09-01", views: 3 },
        { date: "2026-09-04", views: 5 },
      ],
      empty,
    );
    expect(filled.map((point) => point.date)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
    ]);
    expect(filled.map((point) => point.views)).toEqual([3, 0, 0, 5]);
  });

  it("widens to the window so quiet leading and trailing days show as zero", () => {
    const filled = fillDailySeries([{ date: "2026-09-03", views: 1 }], empty, {
      start: "2026-09-01",
      end: "2026-09-05",
    });
    expect(filled.map((point) => point.views)).toEqual([0, 0, 1, 0, 0]);
  });

  it("keeps points that fall outside the window", () => {
    const filled = fillDailySeries([{ date: "2026-08-31", views: 2 }], empty, {
      start: "2026-09-01",
      end: "2026-09-02",
    });
    expect(filled.map((point) => point.date)).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
  });

  it("builds an all-zero series for an empty window", () => {
    expect(
      fillDailySeries([], empty, { start: "2026-09-01", end: "2026-09-03" }),
    ).toHaveLength(3);
  });

  it("sorts unordered input", () => {
    const filled = fillDailySeries(
      [
        { date: "2026-09-02", views: 2 },
        { date: "2026-09-01", views: 1 },
      ],
      empty,
    );
    expect(filled.map((point) => point.views)).toEqual([1, 2]);
  });

  it("leaves a series with undated points untouched", () => {
    const points = [{ views: 1 }, { date: "2026-09-03", views: 2 }];
    expect(fillDailySeries(points, empty)).toEqual(points);
  });

  it("refuses to expand absurd spans", () => {
    const points = [
      { date: "1970-01-01", views: 1 },
      { date: "2026-09-01", views: 1 },
    ];
    expect(fillDailySeries(points, empty)).toHaveLength(2);
  });
});

describe("describeSeries", () => {
  it("summarizes totals and peaks per metric", () => {
    const text = describeSeries(
      [
        { date: "2026-09-01", pageviews: 10 },
        { date: "2026-09-02", pageviews: 1200 },
      ],
      [{ key: "pageviews", label: "Pageviews" }],
    );
    expect(text).toBe(
      "2 days, 2026-09-01 to 2026-09-02. Pageviews: 1,210 total, peak 1,200 on 2026-09-02.",
    );
  });

  it("handles an empty series", () => {
    expect(describeSeries([], [{ key: "x", label: "X" }])).toBe("No data.");
  });

  it("reads hour buckets as hours", () => {
    const text = describeSeries(
      [
        { date: "2026-09-22T00", sessions: 1 },
        { date: "2026-09-22T01", sessions: 4 },
      ],
      [{ key: "sessions", label: "Sessions" }],
    );
    expect(text).toBe(
      "2 hours, 2026-09-22 00:00 to 2026-09-22 01:00. Sessions: 5 total, peak 4 on 2026-09-22 01:00.",
    );
  });

  it("does not pluralize a single point", () => {
    expect(
      describeSeries(
        [{ date: "2026-09-22", x: 1 }],
        [{ key: "x", label: "X" }],
      ),
    ).toMatch(/^1 day, /);
  });
});

describe("series buckets", () => {
  it("tells hour buckets from day buckets", () => {
    expect(isHourBucket("2026-09-22T14")).toBe(true);
    expect(isHourBucket("2026-09-22")).toBe(false);
    expect(isHourBucket(undefined)).toBe(false);
  });

  it("formats hour buckets as a clock time and leaves days alone", () => {
    expect(formatBucket("2026-09-22T09")).toBe("2026-09-22 09:00");
    expect(formatBucket("2026-09-22")).toBe("2026-09-22");
  });
});

describe("buildHourlyGrid", () => {
  it("folds GA's day-name rows into a Monday-first 7×24 grid and finds the peak", () => {
    const grid = buildHourlyGrid(
      gaHourlyCells([
        { day: "Sunday", hour: 23, users: 4 },
        { day: "Monday", hour: 0, users: 2 },
        { day: "Monday", hour: 0, users: 3 },
      ]),
    );
    expect(grid.values).toHaveLength(7);
    expect(grid.values[0][0]).toBe(5);
    expect(grid.values[6][23]).toBe(4);
    expect(grid.max).toBe(5);
    expect(grid.total).toBe(9);
    expect(grid.peak).toEqual({ day: "Monday", hour: 0, value: 5 });
  });

  it("places sessions-service weekdays (0 = Sunday) on the same grid", () => {
    const grid = buildHourlyGrid(
      sessionHourlyCells([
        { weekday: 0, hour: 9, sessions: 7 },
        { weekday: 1, hour: 9, sessions: 2 },
        { weekday: 6, hour: 22, sessions: 1 },
      ]),
    );
    expect(grid.values[6][9]).toBe(7); // Sunday is the last row
    expect(grid.values[0][9]).toBe(2); // Monday is the first
    expect(grid.values[5][22]).toBe(1); // Saturday
    expect(grid.peak).toEqual({ day: "Sunday", hour: 9, value: 7 });
  });

  it("drops unknown days and out-of-range weekdays or hours", () => {
    expect(gaHourlyCells([{ day: "(other)", hour: 3, users: 9 }])).toEqual([]);
    const grid = buildHourlyGrid([
      { weekday: 5, hour: 24, value: 9 },
      { weekday: 7, hour: 3, value: 9 },
      { weekday: -1, hour: 3, value: 9 },
    ]);
    expect(grid.total).toBe(0);
    expect(grid.peak).toBeNull();
  });
});

describe("heatmapDisplayAspect", () => {
  it("draws a page at its own shape", () => {
    expect(heatmapDisplayAspect(2.5)).toBe(2.5);
  });

  it("caps very long pages and floors very wide ones", () => {
    expect(heatmapDisplayAspect(40)).toBe(HEATMAP_MAX_ASPECT);
    expect(heatmapDisplayAspect(0.01)).toBe(0.25);
  });

  it("is square when the aspect is unknown or junk", () => {
    expect(heatmapDisplayAspect(null)).toBe(1);
    expect(heatmapDisplayAspect(0)).toBe(1);
    expect(heatmapDisplayAspect(Number.NaN)).toBe(1);
  });
});

describe("donut segments", () => {
  it("colors rows from the palette with an offset", () => {
    const segments = toDonutSegments(
      [
        { name: "Chrome", sessions: 5 },
        { name: "Firefox", sessions: 2 },
      ],
      (row) => row.name,
      (row) => row.sessions,
      3,
    );
    expect(segments).toEqual([
      { label: "Chrome", value: 5, color: CHART_COLORS[3] },
      { label: "Firefox", value: 2, color: CHART_COLORS[4] },
    ]);
    expect(toDonutSegments(null, String, Number)).toEqual([]);
  });

  it("colors new/returning by name regardless of GA's row order", () => {
    const returningFirst = newVsReturningSegments([
      { segment: "returning", users: 90 },
      { segment: "new", users: 10 },
      { segment: "(not set)", users: 1 },
    ]);
    expect(returningFirst[0]).toMatchObject({
      label: "Returning Users",
      color: SOURCE_COLORS.sessions,
    });
    expect(returningFirst[1]).toMatchObject({
      label: "New Users",
      color: SOURCE_COLORS.ga,
    });
    expect(returningFirst[2].label).toBe("(not set)");
    expect([SOURCE_COLORS.ga, SOURCE_COLORS.sessions]).not.toContain(
      returningFirst[2].color,
    );
  });

  it("names the segments after the audience it counts", () => {
    expect(
      newVsReturningSegments(
        [
          { segment: "new", users: 3 },
          { segment: "returning", users: 1 },
        ],
        "Visitors",
      ).map((segment) => segment.label),
    ).toEqual(["New Visitors", "Returning Visitors"]);
  });
});

describe("gaOverviewDelta", () => {
  const base = {
    totalUsers: 50,
    pageviews: 0,
    sessions: 80,
    avgSessionDuration: 30,
    engagementRate: 0.5,
  };

  it("computes the change from the previous period's totals", () => {
    const overview = { ...base, previous: { totalUsers: 40, sessions: 100 } };
    expect(gaOverviewDelta(overview, "totalUsers")).toBeCloseTo(0.25);
    expect(gaOverviewDelta(overview, "sessions")).toBeCloseTo(-0.2);
  });

  it("hides the badge for a zero previous period instead of claiming +100%", () => {
    const overview = {
      ...base,
      previous: { totalUsers: 0 },
      deltas: { totalUsers: 1 }, // the service's sentinel for "was zero"
    };
    expect(gaOverviewDelta(overview, "totalUsers")).toBeNull();
  });

  it("falls back to the service deltas when totals are missing", () => {
    expect(
      gaOverviewDelta({ ...base, deltas: { pageviews: 0.1 } }, "pageviews"),
    ).toBe(0.1);
    expect(gaOverviewDelta(base, "pageviews")).toBeNull();
  });
});
