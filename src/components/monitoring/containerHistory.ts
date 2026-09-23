import type { ContainerHistory } from "@/types/portal";

/**
 * Sparkline history for containers, keyed by device + container name.
 * Container names are only unique per Docker host — two devices can both
 * run a `prism-service` — so a bare name would merge their series.
 */

/** 60 samples ≈ 5 minutes at the default 5 s poll (and 1 h of persisted metrics). */
export const HISTORY_MAX = 60;

export type HistoryMap = Record<string, ContainerHistory>;

export function containerKey(device: string | null | undefined, name: string): string {
  return `${device || "unknown"}::${name}`;
}

export interface HistorySample {
  key: string;
  cpu: number;
  mem: number;
}

function tail<T>(values: T[], max: number): T[] {
  return values.length > max ? values.slice(-max) : values;
}

/**
 * Append one poll's samples. Containers missing from this poll keep their
 * series untouched (a host that failed one poll must not lose its trend).
 */
export function appendHistory(
  previous: HistoryMap,
  samples: HistorySample[],
  max = HISTORY_MAX,
): HistoryMap {
  const next: HistoryMap = { ...previous };
  for (const sample of samples) {
    const existing = previous[sample.key];
    next[sample.key] = {
      cpu: tail([...(existing?.cpu ?? []), sample.cpu], max),
      mem: tail([...(existing?.mem ?? []), sample.mem], max),
    };
  }
  return next;
}

/** Prepend seeded (older) history to whatever live polling already collected. */
export function mergeSeededHistory(
  live: HistoryMap,
  seeded: HistoryMap,
  max = HISTORY_MAX,
): HistoryMap {
  const next: HistoryMap = { ...live };
  for (const [key, seed] of Object.entries(seeded)) {
    const current = live[key];
    next[key] = {
      cpu: tail([...seed.cpu, ...(current?.cpu ?? [])], max),
      mem: tail([...seed.mem, ...(current?.mem ?? [])], max),
    };
  }
  return next;
}

/**
 * `/stats/containers/metrics` → history (persisted MongoDB samples). The
 * response is keyed "<device>/<container>" and each entry names its
 * container and device; the key is only a fallback for the name.
 */
export function historyFromMetrics(
  containers: Record<
    string,
    {
      container?: string;
      device?: string;
      points?: { cpu?: number | null; mem?: number | null }[];
    }
  > | null | undefined,
  max = HISTORY_MAX,
): HistoryMap {
  const history: HistoryMap = {};
  for (const [key, data] of Object.entries(containers ?? {})) {
    const points = tail(data.points ?? [], max);
    if (points.length === 0) continue;
    history[containerKey(data.device, data.container ?? key)] = {
      cpu: points.map((point) => point.cpu ?? 0),
      mem: points.map((point) => point.mem ?? 0),
    };
  }
  return history;
}

interface RingBufferSnapshot {
  containers?: Record<string, { cpu?: number; memoryUsed?: number }>;
}

/** `/stats/containers/history` (in-memory ring buffer, per device) → history. */
export function historyFromRingBuffer(
  history: Record<string, RingBufferSnapshot[] | unknown> | null | undefined,
  max = HISTORY_MAX,
): HistoryMap {
  const result: HistoryMap = {};
  for (const [device, snapshots] of Object.entries(history ?? {})) {
    if (!Array.isArray(snapshots)) continue;
    for (const snapshot of snapshots as RingBufferSnapshot[]) {
      for (const [name, sample] of Object.entries(snapshot?.containers ?? {})) {
        const key = containerKey(device, name);
        const series = (result[key] ??= { cpu: [], mem: [] });
        series.cpu.push(sample.cpu ?? 0);
        series.mem.push(sample.memoryUsed ?? 0);
      }
    }
  }
  for (const series of Object.values(result)) {
    series.cpu = tail(series.cpu, max);
    series.mem = tail(series.mem, max);
  }
  return result;
}

/** Sum series point-by-point, right-aligned (newest samples line up). */
export function sumAligned(series: number[][]): number[] {
  const length = series.reduce((longest, values) => Math.max(longest, values.length), 0);
  const total = new Array<number>(length).fill(0);
  for (const values of series) {
    const offset = length - values.length;
    values.forEach((value, index) => {
      total[offset + index] += value || 0;
    });
  }
  return total;
}

/**
 * Y-axis ceiling for a percentage sparkline. Docker CPU% is per core, so a
 * busy multi-core container (or a fleet total) legitimately exceeds 100.
 */
export function percentCeiling(values: number[], floor = 100): number {
  return values.reduce((highest, value) => Math.max(highest, value), floor);
}
