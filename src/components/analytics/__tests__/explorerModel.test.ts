import { describe, it, expect } from "vitest";
import {
  DEFAULT_SORT,
  SORT_OPTIONS,
  buildJourney,
  eventProps,
  filterChips,
  filtersKey,
  hasFilters,
  journeyKey,
  parseSortValue,
  removeFilter,
  setTextFilter,
  sortValue,
} from "../explorerModel";
import type { SessionEvent, SessionView } from "@/types/portal";

function view(id: string, at: string, overrides: Partial<SessionView> = {}) {
  return {
    id,
    path: `/${id}`,
    title: null,
    at,
    engagedMs: 1000,
    scroll: 50,
    ...overrides,
  };
}

function event(
  name: string,
  at: string,
  overrides: Partial<SessionEvent> = {},
) {
  return { name, props: null, path: null, at, ...overrides };
}

describe("text filters", () => {
  it("sets a trimmed value, and removes the filter when it is empty", () => {
    const withPath = setTextFilter({}, "path", "  /pricing ");
    expect(withPath).toEqual({ path: "/pricing" });
    expect(setTextFilter(withPath, "path", "   ")).toEqual({});
  });

  it("upper-cases country codes, which match exactly", () => {
    expect(setTextFilter({}, "country", "ca")).toEqual({ country: "CA" });
  });

  it("never mutates the filters it was given", () => {
    const filters = { channel: "Direct" };
    setTextFilter(filters, "channel", "Referral");
    removeFilter(filters, "channel");
    expect(filters).toEqual({ channel: "Direct" });
  });

  it("lists typed filters as chips, with a country named and flagged", () => {
    expect(
      filterChips({ country: "CA", visitorId: "v-1", replay: true }),
    ).toEqual([
      {
        key: "country",
        label: "Country",
        display: "🇨🇦 Canada (CA)",
        value: "CA",
      },
      { key: "visitorId", label: "Visitor", display: "v-1", value: "v-1" },
    ]);
  });

  it("counts the on/off filters as filtering too", () => {
    expect(hasFilters({})).toBe(false);
    expect(hasFilters({ engaged: false })).toBe(false);
    expect(hasFilters({ engaged: true })).toBe(true);
    expect(hasFilters({ ip: "203.0.113.5" })).toBe(true);
  });

  it("keys filters by content, not insertion order", () => {
    expect(filtersKey({ ip: "1", path: "/" })).toBe(
      filtersKey({ path: "/", ip: "1" }),
    );
    expect(filtersKey({ replay: false })).toBe(filtersKey({}));
    expect(filtersKey({ replay: true })).not.toBe(filtersKey({}));
  });
});

describe("sort values", () => {
  it("round-trips every sort option through its select value", () => {
    for (const option of SORT_OPTIONS) {
      expect(parseSortValue(sortValue(option.sort))).toEqual(option.sort);
    }
  });

  it("falls back to newest first for an unknown value", () => {
    expect(parseSortValue("bogus:up")).toEqual(DEFAULT_SORT);
  });
});

describe("buildJourney", () => {
  it("numbers pageviews in time order and interleaves events", () => {
    const journey = buildJourney(
      [
        view("b", "2026-09-01T10:02:00.000Z"),
        view("a", "2026-09-01T10:00:00.000Z"),
      ],
      [event("signup", "2026-09-01T10:01:00.000Z")],
    );
    expect(
      journey.map((entry) =>
        entry.kind === "view"
          ? `${entry.step}:${entry.view.id}`
          : entry.event.name,
      ),
    ).toEqual(["1:a", "signup", "2:b"]);
  });

  it("puts an event stamped with its pageview's instant after the pageview", () => {
    const at = "2026-09-01T10:00:00.000Z";
    const journey = buildJourney([view("a", at)], [event("outbound", at)]);
    expect(journey.map((entry) => entry.kind)).toEqual(["view", "event"]);
  });

  it("keeps same-instant events in their recorded order", () => {
    const at = "2026-09-01T10:00:00.000Z";
    const journey = buildJourney([], [event("first", at), event("second", at)]);
    expect(
      journey.map((entry) => entry.kind === "event" && entry.event.name),
    ).toEqual(["first", "second"]);
  });

  it("gives every row a distinct key", () => {
    const at = "2026-09-01T10:00:00.000Z";
    const journey = buildJourney(
      [view("a", at)],
      [event("x", at), event("x", at)],
    );
    const keys = journey.map(journeyKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("eventProps", () => {
  it("lists props as text and drops empty values", () => {
    expect(
      eventProps(
        event("outbound", "2026-09-01T10:00:00.000Z", {
          props: {
            url: "https://x.dev",
            count: 2,
            ok: false,
            gone: null,
            blank: "",
          },
        }),
      ),
    ).toEqual([
      ["url", "https://x.dev"],
      ["count", "2"],
      ["ok", "false"],
    ]);
  });

  it("has nothing to list for an event without props", () => {
    expect(eventProps(event("tap", "2026-09-01T10:00:00.000Z"))).toEqual([]);
  });
});
