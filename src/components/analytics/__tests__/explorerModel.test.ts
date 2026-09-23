import { describe, it, expect } from "vitest";
import {
  buildTimeline,
  filterIpUsers,
  filterSessions,
  filterVisitors,
  ipFingerprint,
  ipLastSeen,
  ipTimeline,
} from "../explorerModel";
import type {
  ExplorerSession,
  IpDetail,
  IpUser,
  Visitor,
} from "@/types/portal";

function session(overrides: Partial<ExplorerSession>): ExplorerSession {
  return {
    sessionId: "s-1",
    visitorId: "v-1",
    projectId: "rod-dev-client",
    ip: "203.0.113.5",
    fingerprintId: null,
    browser: { name: "Chrome", version: "140" },
    os: { name: "macOS", version: "15" },
    device: { type: "desktop", vendor: null },
    geo: { country: "Canada", city: "Vancouver", countryCode: "CA" },
    viewport: null,
    referrer: null,
    duration: 1000,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:05:00.000Z",
    ...overrides,
  };
}

function ipDetail(overrides: Partial<IpDetail>): IpDetail {
  return {
    ip: "203.0.113.5",
    visitorIds: [],
    projects: [],
    sessionCount: 0,
    totalDuration: 0,
    firstSeen: null,
    lastSeen: null,
    lastBrowser: null,
    lastOs: null,
    lastDevice: null,
    lastGeo: null,
    sessions: [],
    pageViews: [],
    events: [],
    timeline: [],
    ...overrides,
  };
}

describe("search filters", () => {
  const sessions = [
    session({ sessionId: "aaa", browser: { name: "Firefox", version: "130" } }),
    session({
      sessionId: "bbb",
      userId: "hello@rod.dev",
      geo: null,
      browser: null,
    }),
  ];

  it("returns everything for a blank query", () => {
    expect(filterSessions(sessions, "   ")).toHaveLength(2);
  });

  it("matches case-insensitively across fields", () => {
    expect(
      filterSessions(sessions, "FIREFOX").map((item) => item.sessionId),
    ).toEqual(["aaa"]);
  });

  it("finds sessions by linked user identity", () => {
    expect(
      filterSessions(sessions, "rod.dev").map((item) => item.sessionId),
    ).toEqual(["bbb"]);
  });

  it("tolerates null nested objects", () => {
    expect(() => filterSessions(sessions, "vancouver")).not.toThrow();
    expect(
      filterSessions(sessions, "vancouver").map((item) => item.sessionId),
    ).toEqual(["aaa"]);
  });

  it("searches IPs by any linked visitor id", () => {
    const ips = [
      { ip: "198.51.100.1", visitorIds: ["visitor-xyz"] },
      { ip: "198.51.100.2", visitorIds: [] },
    ] as unknown as IpUser[];
    expect(filterIpUsers(ips, "xyz").map((item) => item.ip)).toEqual([
      "198.51.100.1",
    ]);
  });

  it("searches visitors by last IP", () => {
    const visitors = [
      { visitorId: "v1", lastIp: "198.51.100.1" },
      { visitorId: "v2", lastIp: null },
    ] as unknown as Visitor[];
    expect(
      filterVisitors(visitors, "100.1").map((item) => item.visitorId),
    ).toEqual(["v1"]);
  });
});

describe("buildTimeline", () => {
  it("merges chronologically and keeps each entry's session", () => {
    const timeline = buildTimeline(
      [
        {
          sessionId: "s2",
          url: "https://x/b",
          path: "/b",
          title: "B",
          timestamp: "2026-09-01T10:02:00Z",
        },
        {
          sessionId: "s1",
          url: "https://x/a",
          path: "/a",
          title: "A",
          timestamp: "2026-09-01T10:00:00Z",
        },
      ],
      [
        {
          sessionId: "s1",
          category: "ui",
          action: "click",
          label: null,
          timestamp: "2026-09-01T10:01:00Z",
        },
      ],
    );
    expect(timeline.map((entry) => `${entry.type}:${entry.sessionId}`)).toEqual(
      ["pageview:s1", "event:s1", "pageview:s2"],
    );
  });

  it("keeps page views ahead of events at the same instant", () => {
    const timeline = buildTimeline(
      [{ url: "u", path: "/", title: null, timestamp: "2026-09-01T10:00:00Z" }],
      [
        {
          category: "c",
          action: "a",
          label: null,
          timestamp: "2026-09-01T10:00:00Z",
        },
      ],
    );
    expect(timeline.map((entry) => entry.type)).toEqual(["pageview", "event"]);
  });
});

describe("IP detail helpers", () => {
  it("rebuilds the cross-session timeline so rows keep their session tag", () => {
    const detail = ipDetail({
      pageViews: [
        {
          sessionId: "s9",
          url: "u",
          path: "/",
          title: null,
          timestamp: "2026-09-01T10:00:00Z",
        },
      ],
      // The service's merged timeline has no sessionId
      timeline: [
        { type: "pageview", timestamp: "2026-09-01T10:00:00Z", path: "/" },
      ],
    });
    expect(ipTimeline(detail)[0].sessionId).toBe("s9");
  });

  it("falls back to the service timeline when raw records are absent", () => {
    const timeline = [
      { type: "event" as const, timestamp: "2026-09-01T10:00:00Z" },
    ];
    expect(ipTimeline(ipDetail({ timeline }))).toBe(timeline);
  });

  it("takes the newest session's fingerprint, skipping sessions without one", () => {
    const detail = ipDetail({
      sessions: [
        session({ sessionId: "newest", fingerprintId: null }),
        session({ sessionId: "older", fingerprintId: "fp-older" }),
      ],
    });
    expect(ipFingerprint(detail)).toBe("fp-older");
    expect(ipFingerprint(ipDetail({}))).toBeNull();
  });

  it("takes the latest activity across sessions, not the newest session's", () => {
    const detail = ipDetail({
      lastSeen: "2026-09-01T10:05:00.000Z",
      sessions: [
        session({ sessionId: "newest", updatedAt: "2026-09-01T10:05:00.000Z" }),
        session({
          sessionId: "long-lived",
          updatedAt: "2026-09-01T18:00:00.000Z",
        }),
      ],
    });
    expect(ipLastSeen(detail)).toBe("2026-09-01T18:00:00.000Z");
    expect(ipLastSeen(ipDetail({}))).toBeNull();
  });
});
