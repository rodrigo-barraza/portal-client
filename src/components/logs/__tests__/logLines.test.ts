import { describe, expect, it } from "vitest";
import {
  appendCapped,
  detectLevel,
  filterLogLines,
  parseLogFrame,
  parseLogLine,
} from "../logLines";

describe("parseLogFrame", () => {
  it("unwraps portal-service's JSON frames", () => {
    expect(
      parseLogFrame('{"line":"2026-09-22T10:00:00Z hello","stream":"stdout"}'),
    ).toBe("2026-09-22T10:00:00Z hello");
  });

  it("passes raw lines through, including ones that merely start with a brace", () => {
    expect(parseLogFrame("plain line")).toBe("plain line");
    expect(parseLogFrame('{"level":"info"} not quite json')).toBe(
      '{"level":"info"} not quite json',
    );
    expect(parseLogFrame('{"msg":"structured log"}')).toBe(
      '{"msg":"structured log"}',
    );
  });
});

describe("parseLogLine", () => {
  it("splits Docker's timestamp from the content", () => {
    const line = parseLogLine(
      "2026-09-22T10:11:12.345678901Z [10:11:12] INFO  started",
      7,
    );
    expect(line).toMatchObject({
      id: 7,
      timestamp: "10:11:12.345",
      sortKey: "2026-09-22T10:11:12.345678901",
      content: "[10:11:12] INFO  started",
      level: "info",
    });
  });

  it("pads the fraction so sort keys order by time", () => {
    const earlier = parseLogLine("2026-09-22T10:11:12.05Z a", 1);
    const later = parseLogLine("2026-09-22T10:11:12.1Z b", 2);
    expect(earlier.sortKey! < later.sortKey!).toBe(true);
    expect(parseLogLine("2026-09-22T10:11:12Z c", 3).timestamp).toBe(
      "10:11:12.000",
    );
  });

  it("keeps un-stamped lines", () => {
    expect(parseLogLine("    at Object.<anonymous>", 1)).toMatchObject({
      timestamp: null,
      sortKey: null,
      content: "    at Object.<anonymous>",
    });
  });

  it("searches and detects levels on the ANSI-free text", () => {
    const line = parseLogLine("\x1b[31mERROR\x1b[0m Boom", 1);
    expect(line.level).toBe("error");
    expect(line.searchText).toBe("error boom");
  });
});

describe("detectLevel", () => {
  it("recognises the common level words", () => {
    expect(detectLevel("WARN  disk almost full")).toBe("warn");
    expect(detectLevel("[DEBUG] cache miss")).toBe("debug");
    expect(detectLevel("OK    connected")).toBe("success");
    expect(detectLevel("debugger attached")).toBeNull();
    expect(detectLevel("nothing here")).toBeNull();
  });
});

describe("appendCapped", () => {
  it("keeps only the newest entries", () => {
    expect(appendCapped([1, 2, 3], [4, 5], 4)).toEqual([2, 3, 4, 5]);
    const existing = [1];
    expect(appendCapped(existing, [], 4)).toBe(existing);
  });
});

describe("filterLogLines", () => {
  const lines = [
    parseLogLine("2026-09-22T10:00:00Z Server listening", 1),
    parseLogLine("2026-09-22T11:30:00Z \x1b[33mWARN\x1b[0m slow query", 2),
  ];

  it("matches content case-insensitively, ignoring ANSI", () => {
    expect(filterLogLines(lines, "  warn ").map((line) => line.id)).toEqual([
      2,
    ]);
  });

  it("matches the displayed timestamp", () => {
    expect(filterLogLines(lines, "11:30").map((line) => line.id)).toEqual([2]);
  });

  it("returns everything for an empty query", () => {
    expect(filterLogLines(lines, "")).toBe(lines);
  });
});
