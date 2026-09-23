import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

const api = vi.hoisted(() => ({
  getSessionIpUsers: vi.fn(),
  getSessionVisitors: vi.fn(),
  getSessionsList: vi.fn(),
  getSessionIpDetail: vi.fn(),
  getSessionDetail: vi.fn(),
  getSessionReplay: vi.fn(),
}));

vi.mock("../../../services/ApiService", () => ({ default: api }));
// The replay player is lazy-loaded via next/dynamic; stub it out here
vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="replay-stub" />,
}));

import SessionExplorerComponent from "../../SessionExplorerComponent";

const IP = "203.0.113.5";
const SESSION_ID = "session-aaaaaaaaaaaa";

const client = {
  browser: { name: "Firefox", version: "130" },
  os: { name: "Linux", version: null },
  device: { type: "desktop", vendor: null },
  geo: { country: "Canada", city: "Vancouver", countryCode: "CA" },
};

function sessionRow(overrides = {}) {
  return {
    sessionId: SESSION_ID,
    visitorId: "visitor-1",
    projectId: "rod-dev-client",
    ip: IP,
    fingerprintId: "fp-1",
    ...client,
    viewport: null,
    referrer: null,
    duration: 65_000,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:05:00.000Z",
    ...overrides,
  };
}

beforeAll(() => {
  // SegmentedControlComponent measures itself with a ResizeObserver
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  vi.clearAllMocks();
  api.getSessionIpUsers.mockResolvedValue({
    success: true,
    data: {
      ips: [
        {
          ip: IP,
          visitorIds: ["visitor-1"],
          sessionIds: [SESSION_ID],
          sessionCount: 1,
          totalDuration: 65_000,
          firstSeen: "2026-09-01T10:00:00.000Z",
          lastSeen: "2026-09-01T10:05:00.000Z",
          projects: ["rod-dev-client"],
          lastBrowser: client.browser,
          lastOs: client.os,
          lastDevice: client.device,
          lastGeo: client.geo,
          lastFingerprintId: "fp-1",
          lastReferrer: null,
          lastViewport: null,
        },
      ],
      total: 1,
    },
  });
  api.getSessionVisitors.mockResolvedValue({
    success: true,
    data: {
      visitors: [
        {
          visitorId: "visitor-1",
          sessionCount: 40,
          totalDuration: 1000,
          firstSeen: "2026-09-01T10:00:00.000Z",
          lastSeen: "2026-09-01T10:05:00.000Z",
          lastIp: IP,
          lastBrowser: client.browser,
          lastOs: client.os,
          lastDevice: client.device,
          lastGeo: client.geo,
          lastReferrer: null,
          lastViewport: null,
          // The service caps this list at the newest 20
          sessionIds: Array.from({ length: 20 }, (_, index) => `s-${index}`),
        },
      ],
      total: 1,
    },
  });
  api.getSessionsList.mockResolvedValue({
    success: true,
    data: { sessions: [sessionRow({ isBot: true })], total: 1 },
  });
  api.getSessionIpDetail.mockResolvedValue({
    success: true,
    data: {
      ip: IP,
      visitorIds: ["visitor-1"],
      projects: ["rod-dev-client"],
      sessionCount: 1,
      totalDuration: 65_000,
      firstSeen: "2026-09-01T10:00:00.000Z",
      lastSeen: "2026-09-01T10:05:00.000Z",
      lastBrowser: client.browser,
      lastOs: client.os,
      lastDevice: client.device,
      lastGeo: client.geo,
      sessions: [sessionRow()],
      pageViews: [
        {
          sessionId: SESSION_ID,
          url: "https://rod.dev/",
          path: "/",
          title: "Home",
          timestamp: "2026-09-01T10:00:00.000Z",
        },
      ],
      events: [],
      // The service's merged timeline drops sessionId
      timeline: [
        { type: "pageview", timestamp: "2026-09-01T10:00:00.000Z", path: "/" },
      ],
    },
  });
  api.getSessionDetail.mockResolvedValue({
    success: true,
    data: {
      ...sessionRow({ userId: "hello@rod.dev" }),
      userAgent: "Mozilla/5.0",
      locale: "en-CA",
      utm: null,
      pageViews: [],
      events: [],
      timeline: [],
      hasReplay: false,
    },
  });
});

describe("SessionExplorerComponent", () => {
  it("walks list → IP → session → IP and back through the same stack", async () => {
    render(
      <SessionExplorerComponent projectId="rod-dev-client" period="30d" />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: new RegExp(IP) }),
    );
    expect(
      await screen.findByText("Cross-Session Timeline"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back to list" }),
    ).toBeInTheDocument();

    // Open the session from the IP profile
    fireEvent.click(
      screen.getByRole("button", { name: `Open session ${SESSION_ID}` }),
    );
    expect(await screen.findByText("hello@rod.dev")).toBeInTheDocument();

    // The IP link in a session used to do nothing (the session view won)
    fireEvent.click(screen.getByRole("button", { name: `Open IP ${IP}` }));
    expect(
      await screen.findByText("Cross-Session Timeline"),
    ).toBeInTheDocument();
    expect(api.getSessionIpDetail).toHaveBeenCalledWith(
      IP,
      "rod-dev-client",
      "30d",
      {
        signal: expect.any(AbortSignal),
      },
    );

    // Back pops one level at a time
    fireEvent.click(screen.getByRole("button", { name: /Back to session/ }));
    expect(await screen.findByText("hello@rod.dev")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Back to ${IP}` }));
    expect(
      await screen.findByText("Cross-Session Timeline"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to list" }));
    expect(await screen.findByRole("tablist")).toBeInTheDocument();
  });

  it("tags cross-session timeline rows with their session", async () => {
    render(
      <SessionExplorerComponent projectId="rod-dev-client" period="30d" />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: new RegExp(IP) }),
    );

    const timeline = await screen.findByRole("region", {
      name: "Cross-Session Timeline",
    });
    expect(within(timeline).getByTitle(SESSION_ID)).toHaveTextContent(
      "sessio…",
    );
  });

  it("counts hidden sessions from the visitor's total, not the capped id list", async () => {
    render(
      <SessionExplorerComponent projectId="rod-dev-client" period="30d" />,
    );
    fireEvent.click(await screen.findByRole("tab", { name: /Visitors/ }));
    // 40 sessions, 5 pills shown → 35 more (was "+15": 20 capped ids − 5)
    expect(await screen.findByText("+35 more")).toBeInTheDocument();
  });

  it("flags bot sessions in the list", async () => {
    render(
      <SessionExplorerComponent projectId="rod-dev-client" period="30d" />,
    );
    fireEvent.click(await screen.findByRole("tab", { name: /Sessions/ }));
    expect(
      await screen.findByTitle("Flagged as crawler/bot traffic"),
    ).toBeInTheDocument();
  });

  it("reports a failed list as an error, not as an empty period", async () => {
    api.getSessionIpUsers.mockRejectedValue(new Error("Unauthorized"));
    render(
      <SessionExplorerComponent projectId="rod-dev-client" period="30d" />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load IPs: Unauthorized",
    );
    expect(screen.queryByText(/No IPs in this period/)).not.toBeInTheDocument();
  });

  it('never shows a proxied `{ error: true }` body as the text "true"', async () => {
    api.getSessionIpUsers.mockRejectedValue(new Error(String(true)));
    render(
      <SessionExplorerComponent projectId="rod-dev-client" period="30d" />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^Could not load IPs\.$/,
    );
  });
});
