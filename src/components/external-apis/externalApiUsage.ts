/**
 * External API usage — response shapes (portal-service /external-apis)
 * and the pure series math behind the dashboard.
 */

import type { DonutSegment } from "../../types/portal";

export interface DailySeries {
  date: string;
  requests: number;
}

export interface ApiUsageSummary {
  serviceIdentifier: string;
  displayName: string;
  category: string;
  consumer: string;
  /** Empty for providers without a known docs page. */
  documentationUrl: string;
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  /** 0–1 */
  errorRate: number;
  /** Only sources that track spend (prism LLM requests). */
  estimatedCost?: number;
  dailySeries: DailySeries[];
}

export interface ExternalApiUsageData {
  services: ApiUsageSummary[];
  totalRequests: number;
  totalErrors: number;
  period: string;
  /** Usage sources that failed — the numbers shown exclude them. */
  unreachableSources?: string[];
  /** GCP projects whose Monitoring query failed. */
  unreachableProjectIds?: string[];
  fetchedAt: string;
}

export interface TimeSeriesPoint {
  date: string;
  requests: number;
  successRequests: number;
  errorRequests: number;
}

export interface TimeSeriesData {
  serviceIdentifier: string;
  displayName: string;
  series: TimeSeriesPoint[];
  period: string;
  fetchedAt: string;
}

export const PERIOD_OPTIONS = [
  { value: "7d", label: "7d" },
  { value: "14d", label: "14d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

const DAY_MS = 86_400_000;

export function periodToDays(period: string): number {
  const match = period.match(/^(\d+)d$/);
  return match ? parseInt(match[1], 10) : 30;
}

/**
 * Every UTC date the period touches, oldest → today. The service counts
 * from exactly `days` ago, so the window spans days + 1 calendar dates
 * (a partial first and last day) — charting all of them keeps the daily
 * points summing to the totals on the cards.
 */
export function buildDateRange(days: number, now = Date.now()): string[] {
  const dates: string[] = [];
  const end = new Date(now).toISOString().slice(0, 10);
  for (let time = now - days * DAY_MS; ; time += DAY_MS) {
    const date = new Date(time).toISOString().slice(0, 10);
    dates.push(date);
    if (date >= end) break;
  }
  return dates;
}

/** One value per date — quiet days are zero instead of silently skipped. */
export function fillDailyValues<Point extends { date: string }>(
  points: Point[],
  extract: (point: Point) => number,
  dates: string[],
): number[] {
  const byDate = new Map<string, number>();
  for (const point of points) byDate.set(point.date, (byDate.get(point.date) ?? 0) + extract(point));
  return dates.map((date) => byDate.get(date) ?? 0);
}

/** Total daily requests across every API. */
export function combineDailySeries(services: ApiUsageSummary[], dates: string[]): DailySeries[] {
  const allPoints = services.flatMap((service) => service.dailySeries);
  const totals = fillDailyValues(allPoints, (point) => point.requests, dates);
  return dates.map((date, index) => ({ date, requests: totals[index] }));
}

/** Requests per category, largest first. */
export function categoryTotals(services: ApiUsageSummary[]): { category: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const service of services) {
    totals.set(service.category, (totals.get(service.category) ?? 0) + service.totalRequests);
  }
  return [...totals]
    .sort((first, second) => second[1] - first[1])
    .map(([category, value]) => ({ category, value }));
}

export function toCategorySegments(
  services: ApiUsageSummary[],
  colorOf: (category: string) => string,
): DonutSegment[] {
  return categoryTotals(services).map(({ category, value }) => ({
    label: category,
    value,
    color: colorOf(category),
  }));
}

export function formatPercentValue(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

export function formatCostValue(value: number): string {
  return value >= 0.01 ? `$${value.toFixed(2)}` : "<$0.01";
}

/** Share of successful requests (0–100); an API with no traffic reads as fully successful. */
export function successPercent(service: Pick<ApiUsageSummary, "totalRequests" | "successRequests">): number {
  return service.totalRequests > 0 ? (service.successRequests / service.totalRequests) * 100 : 100;
}
