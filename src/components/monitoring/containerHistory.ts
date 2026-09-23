import type {
  ContainerHistory,
  ContainerMetricsPoint,
  ContainerMetricsSeries,
  ContainerSnapshotSample,
} from "@/types/portal";

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

/** What history reads from one `/stats/containers/metrics` series. */
export type MetricsSeriesSamples = Pick<ContainerMetricsSeries, "container" | "device"> & {
  points: Pick<ContainerMetricsPoint, "cpu" | "mem">[];
};

/**
 * `/stats/containers/metrics` → history (persisted MongoDB samples). The
 * response is keyed "<device>/<container>"; each entry names its
 * container and device.
 */
export function historyFromMetrics(
  containers: Record<string, MetricsSeriesSamples>,
  max = HISTORY_MAX,
): HistoryMap {
  const history: HistoryMap = {};
  for (const data of Object.values(containers)) {
    const points = tail(data.points, max);
    if (points.length === 0) continue;
    history[containerKey(data.device, data.container)] = {
      cpu: points.map((point) => point.cpu),
      mem: points.map((point) => point.mem),
    };
  }
  return history;
}

/** What history reads from one ring-buffer tick. */
export interface RingBufferSnapshot {
  containers: Record<string, Pick<ContainerSnapshotSample, "cpu" | "memoryUsed">>;
}

/** `/stats/containers/history` (in-memory ring buffer, per device) → history. */
export function historyFromRingBuffer(
  history: Record<string, RingBufferSnapshot[]>,
  max = HISTORY_MAX,
): HistoryMap {
  const result: HistoryMap = {};
  for (const [device, snapshots] of Object.entries(history)) {
    for (const snapshot of snapshots) {
      for (const [name, sample] of Object.entries(snapshot.containers)) {
        const key = containerKey(device, name);
        const series = (result[key] ??= { cpu: [], mem: [] });
        series.cpu.push(sample.cpu);
        series.mem.push(sample.memoryUsed);
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
