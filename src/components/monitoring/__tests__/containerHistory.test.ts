import { describe, expect, it } from "vitest";
import {
  appendHistory,
  containerKey,
  historyFromMetrics,
  historyFromRingBuffer,
  mergeSeededHistory,
  percentCeiling,
  sumAligned,
} from "../containerHistory";

describe("containerKey", () => {
  it("keeps same-named containers on different hosts apart", () => {
    expect(containerKey("synology", "prism-service")).not.toBe(
      containerKey("workstation", "prism-service"),
    );
    expect(containerKey(null, "x")).toBe("unknown::x");
  });
});

describe("appendHistory", () => {
  it("appends one sample per container and caps the series", () => {
    let history = {};
    for (let index = 0; index < 5; index++) {
      history = appendHistory(history, [{ key: "a", cpu: index, mem: index * 10 }], 3);
    }
    expect(history).toEqual({ a: { cpu: [2, 3, 4], mem: [20, 30, 40] } });
  });

  it("leaves containers missing from a poll untouched", () => {
    const previous = { a: { cpu: [1], mem: [1] }, b: { cpu: [2], mem: [2] } };
    const next = appendHistory(previous, [{ key: "a", cpu: 5, mem: 5 }]);
    expect(next.b).toBe(previous.b);
    expect(next.a).toEqual({ cpu: [1, 5], mem: [1, 5] });
  });
});

describe("mergeSeededHistory", () => {
  it("puts seeded (older) points before live ones, capped", () => {
    const merged = mergeSeededHistory(
      { a: { cpu: [9], mem: [90] } },
      { a: { cpu: [1, 2, 3], mem: [10, 20, 30] }, b: { cpu: [4], mem: [40] } },
      3,
    );
    expect(merged.a).toEqual({ cpu: [2, 3, 9], mem: [20, 30, 90] });
    expect(merged.b).toEqual({ cpu: [4], mem: [40] });
  });
});

describe("historyFromMetrics", () => {
  it("keeps same-named containers on two hosts apart (device/container keys)", () => {
    const history = historyFromMetrics({
      "synology/prism-service": {
        container: "prism-service",
        device: "synology",
        points: [{ cpu: 1, mem: 10 }],
      },
      "workstation/prism-service": {
        container: "prism-service",
        device: "workstation",
        points: [{ cpu: 9, mem: 90 }],
      },
    });
    expect(history).toEqual({
      "synology::prism-service": { cpu: [1], mem: [10] },
      "workstation::prism-service": { cpu: [9], mem: [90] },
    });
  });

  it("falls back to the key as the container name", () => {
    const history = historyFromMetrics({
      "prism-service": {
        device: "synology",
        points: [
          { cpu: 1, mem: 100 },
          { cpu: null, mem: 200 },
        ],
      },
      empty: { device: "synology", points: [] },
    });
    expect(history).toEqual({
      "synology::prism-service": { cpu: [1, 0], mem: [100, 200] },
    });
  });
});

describe("historyFromRingBuffer", () => {
  it("builds one series per device + container from per-device snapshots", () => {
    const history = historyFromRingBuffer({
      synology: [
        { containers: { api: { cpu: 1, memoryUsed: 10 } } },
        { containers: { api: { cpu: 2, memoryUsed: 20 } } },
      ],
      workstation: [{ containers: { api: { cpu: 7, memoryUsed: 70 } } }],
    });
    expect(history["synology::api"]).toEqual({ cpu: [1, 2], mem: [10, 20] });
    expect(history["workstation::api"]).toEqual({ cpu: [7], mem: [70] });
  });
});

describe("sumAligned", () => {
  it("sums right-aligned so the newest samples line up", () => {
    expect(sumAligned([[1, 2, 3], [10], []])).toEqual([1, 2, 13]);
    expect(sumAligned([])).toEqual([]);
  });
});

describe("percentCeiling", () => {
  it("never drops below 100 but grows for multi-core usage", () => {
    expect(percentCeiling([5, 20])).toBe(100);
    expect(percentCeiling([120, 340])).toBe(340);
  });
});
