import { describe, it, expect } from "vitest";
import {
  formatCount,
  formatDurationMs,
  formatLocation,
  formatRatioPercent,
  formatTimestamp,
  formatWholePercent,
  joinMeta,
  percentChange,
  readableErrorMessage,
  shortId,
} from "../analyticsFormat";

describe("formatLocation", () => {
  it("joins city and country", () => {
    expect(formatLocation({ city: "Vancouver", country: "Canada" })).toBe("Vancouver, Canada");
  });

  it("drops the (not set) city GA and sessions-service use for unknowns", () => {
    expect(formatLocation({ city: "(not set)", country: "Canada" })).toBe("Canada");
  });

  it("never renders a dangling separator when the country is missing", () => {
    expect(formatLocation({ city: "Paris", country: null })).toBe("Paris");
  });

  it("falls back when nothing is known", () => {
    expect(formatLocation(null)).toBe("—");
    expect(formatLocation({ city: null, country: null }, "Unknown")).toBe("Unknown");
  });
});

describe("formatDurationMs", () => {
  it("treats sessions-service durations as milliseconds", () => {
    expect(formatDurationMs(252_000)).toBe("4m 12s");
  });

  it("renders zero and missing durations as 0s", () => {
    expect(formatDurationMs(0)).toBe("0s");
    expect(formatDurationMs(null)).toBe("0s");
  });
});

describe("formatTimestamp", () => {
  it("renders midnight as 00, never 24", () => {
    const midnight = new Date();
    midnight.setHours(0, 5, 9, 0);
    const formatted = formatTimestamp(midnight);
    expect(formatted).toContain("00:05:09");
    expect(formatted).not.toContain("24:");
  });

  it("includes seconds in 24-hour time", () => {
    const afternoon = new Date();
    afternoon.setHours(14, 5, 9, 0);
    expect(formatTimestamp(afternoon)).toContain("14:05:09");
  });

  it("adds the year for timestamps outside the current year", () => {
    const lastYear = new Date(new Date().getFullYear() - 1, 5, 1, 12, 0, 0);
    expect(formatTimestamp(lastYear)).toContain(String(lastYear.getFullYear()));
  });

  it("renders a dash for missing or invalid input", () => {
    expect(formatTimestamp(null)).toBe("—");
    expect(formatTimestamp("not a date")).toBe("—");
  });
});

describe("formatCount", () => {
  it("pluralizes and groups", () => {
    expect(formatCount(1, "session")).toBe("1 session");
    expect(formatCount(1204, "session")).toBe("1,204 sessions");
    expect(formatCount(0, "visitor")).toBe("0 visitors");
  });
});

describe("shortId", () => {
  it("truncates with an ellipsis only when the id is longer", () => {
    expect(shortId("abcdef1234567890", 8)).toBe("abcdef12…");
    expect(shortId("abc", 8)).toBe("abc");
  });

  it("renders a dash for a missing id", () => {
    expect(shortId(null, 8)).toBe("—");
  });
});

describe("percent formatting", () => {
  it("converts GA ratios to percentages", () => {
    expect(formatRatioPercent(0.4567)).toBe("45.7%");
  });

  it("shows a dash rather than a fake 0% for missing values", () => {
    expect(formatRatioPercent(null)).toBe("—");
    expect(formatRatioPercent(Number.NaN)).toBe("—");
    expect(formatWholePercent(undefined)).toBe("—");
  });

  it("leaves sessions-service percentages as-is", () => {
    expect(formatWholePercent(42)).toBe("42%");
  });
});

describe("percentChange", () => {
  it("returns the relative change", () => {
    expect(percentChange(150, 100)).toBeCloseTo(0.5);
    expect(percentChange(50, 100)).toBeCloseTo(-0.5);
  });

  it("returns null for a zero baseline instead of Infinity or NaN", () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });

  it("returns null when either side is missing or non-finite", () => {
    expect(percentChange(null, 10)).toBeNull();
    expect(percentChange(10, undefined)).toBeNull();
    expect(percentChange(Number.POSITIVE_INFINITY, 10)).toBeNull();
  });
});

describe("joinMeta", () => {
  it("skips empty parts so no dangling separator is rendered", () => {
    expect(joinMeta("Rod Dev", "", "G-123")).toBe("Rod Dev · G-123");
    expect(joinMeta("Rod Dev", null, false)).toBe("Rod Dev");
  });
});

describe("readableErrorMessage", () => {
  it("passes real messages through", () => {
    expect(readableErrorMessage(new Error("Unknown property: 123"))).toBe("Unknown property: 123");
  });

  it("drops the boolean a `{ error: true, message }` body turns into", () => {
    expect(readableErrorMessage(new Error(String(true)))).toBeNull();
    expect(readableErrorMessage(new Error("  "))).toBeNull();
    expect(readableErrorMessage(null)).toBeNull();
  });
});
