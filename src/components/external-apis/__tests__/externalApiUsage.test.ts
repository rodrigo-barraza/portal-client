import { describe, it, expect } from "vitest";
import { buildDateRange, categoryTotals, combineDailySeries, fillDailyValues, formatCostValue, formatPercentValue, periodToDays, successPercent } from "../externalApiUsage";
import type { ExternalApiUsage } from "@/types/portal";

function api(overrides: Partial<ExternalApiUsage>): ExternalApiUsage {
  return {
    serviceIdentifier: "x.googleapis.com",
    displayName: "X",
    category: "Search",
    consumer: "tools-service",
    documentationUrl: "",
    totalRequests: 0,
    successRequests: 0,
    errorRequests: 0,
    errorRate: 0,
    dailySeries: [],
    ...overrides,
  };
}

describe("periods and dates", () => {
  it("parses day periods, defaulting to 30", () => {
    expect(periodToDays("7d")).toBe(7);
    expect(periodToDays("90d")).toBe(90);
    expect(periodToDays("bogus")).toBe(30);
  });

  it("spans every UTC date the rolling window touches, oldest first", () => {
    const now = Date.parse("2026-09-22T15:30:00Z");
    const dates = buildDateRange(7, now);
    expect(dates).toHaveLength(8);
    expect(dates[0]).toBe("2026-09-15");
    expect(dates.at(-1)).toBe("2026-09-22");
  });

  it("zero-fills and sums sparse daily points", () => {
    const dates = ["2026-09-20", "2026-09-21", "2026-09-22"];
    const points = [
      { date: "2026-09-22", requests: 5 },
      { date: "2026-09-20", requests: 1 },
      { date: "2026-09-20", requests: 2 },
      { date: "2026-08-01", requests: 99 },
    ];
    expect(fillDailyValues(points, (point) => point.requests, dates)).toEqual([3, 0, 5]);
  });

  it("combines every API into one daily total", () => {
    const dates = ["2026-09-21", "2026-09-22"];
    const combined = combineDailySeries(
      [
        api({ dailySeries: [{ date: "2026-09-21", requests: 2 }] }),
        api({ dailySeries: [{ date: "2026-09-21", requests: 3 }, { date: "2026-09-22", requests: 1 }] }),
      ],
      dates,
    );
    expect(combined).toEqual([
      { date: "2026-09-21", requests: 5 },
      { date: "2026-09-22", requests: 1 },
    ]);
  });
});

describe("aggregates and formatting", () => {
  it("totals requests per category, largest first", () => {
    expect(
      categoryTotals([
        api({ category: "Search", totalRequests: 5 }),
        api({ category: "AI / LLM", totalRequests: 20 }),
        api({ category: "Search", totalRequests: 7 }),
      ]),
    ).toEqual([
      { category: "AI / LLM", value: 20 },
      { category: "Search", value: 12 },
    ]);
  });

  it("formats ratios, costs and success shares", () => {
    expect(formatPercentValue(0.1234)).toBe("12.3%");
    expect(formatCostValue(3.456)).toBe("$3.46");
    expect(formatCostValue(0.004)).toBe("<$0.01");
    expect(successPercent({ totalRequests: 4, successRequests: 3 })).toBe(75);
    expect(successPercent({ totalRequests: 0, successRequests: 0 })).toBe(100);
  });
});
