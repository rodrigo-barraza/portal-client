import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  envelope,
  sessionHeatmap,
  sessionLive,
  sessionReport,
  sessionReportSummary,
  sessionsPage,
} from "../../__tests__/apiFixtures";
import type { SessionReport } from "@/types/portal";
import type { AsyncDataResult } from "../useAsyncData";

const api = vi.hoisted(() => ({
  getSessionLive: vi.fn(),
  getSessionsList: vi.fn(),
  getSessionDetail: vi.fn(),
  getSessionHeatmap: vi.fn(),
}));

vi.mock("../../../services/ApiService", () => ({ default: api }));
vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="replay-stub" />,
}));

import SessionReportComponent from "../../SessionReportComponent";

function loaded(
  data: SessionReport | null,
  error: Error | null = null,
): AsyncDataResult<SessionReport> {
  return {
    data,
    error,
    loading: false,
    reloading: false,
    reload: async () => {},
  };
}

function renderReport(report: AsyncDataResult<SessionReport>) {
  return render(
    <SessionReportComponent
      projectId="rod-dev-client"
      period="30d"
      report={report}
    />,
  );
}

const busyReport = sessionReport({
  range: {
    from: "2026-09-22T07:00:00.000Z",
    to: "2026-09-23T07:00:00.000Z",
    bucket: "hour",
    tz: "America/Vancouver",
  },
  summary: sessionReportSummary({
    visitors: 120,
    newVisitors: 90,
    sessions: 150,
    engagedSessions: 60,
    pageviews: 400,
    engagedMs: 9_000_000,
    avgEngagedMs: 60_000,
    engagementRate: 0.4,
    bounceRate: 0.6,
    pagesPerSession: 2.67,
  }),
  previous: sessionReportSummary({ visitors: 100, sessions: 0 }),
  series: [
    {
      bucket: "2026-09-22T00",
      visitors: 3,
      sessions: 4,
      pageviews: 9,
      engagedMs: 1,
    },
    {
      bucket: "2026-09-22T01",
      visitors: 5,
      sessions: 6,
      pageviews: 12,
      engagedMs: 1,
    },
  ],
  pages: [
    {
      path: "/about",
      views: 40,
      visitors: 30,
      avgEngagedMs: 1000,
      avgScroll: 50,
      entries: 5,
      exits: 9,
    },
    {
      path: "/",
      views: 300,
      visitors: 110,
      avgEngagedMs: 30_000,
      avgScroll: 72,
      entries: 140,
      exits: 100,
    },
  ],
  channels: [
    {
      channel: "Organic Search",
      sessions: 100,
      visitors: 80,
      engagementRate: 0.5,
    },
  ],
  countries: [{ country: "CA", name: "Canada", sessions: 90, visitors: 70 }],
  devices: [{ name: "desktop", sessions: 150 }],
  hours: [{ weekday: 0, hour: 9, sessions: 12 }],
});

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom has no canvas; the charts and heatmap simply skip painting
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  api.getSessionLive.mockResolvedValue(
    envelope(
      sessionLive({ active: 4, pages: [{ path: "/pricing", active: 3 }] }),
    ),
  );
  api.getSessionsList.mockResolvedValue(envelope(sessionsPage([])));
  api.getSessionHeatmap.mockResolvedValue(envelope(sessionHeatmap()));
});

describe("SessionReportComponent", () => {
  it("reads well for a project with no visits yet", async () => {
    renderReport(loaded(sessionReport()));
    expect(screen.getByText("No visits in this range yet")).toBeInTheDocument();
    // KPIs still show, as zeros, without meaningless deltas
    expect(screen.getByText("Engagement Rate")).toBeInTheDocument();
    expect(
      screen.queryByText(/%$/, { selector: "span[class*=delta]" }),
    ).toBeNull();
    // The explorer still offers all-time search
    expect(
      await screen.findByText(/No sessions in this range yet/),
    ).toBeInTheDocument();
    expect(api.getSessionHeatmap).not.toHaveBeenCalled();
  });

  it("shows who is on the site right now, and where", async () => {
    renderReport(loaded(sessionReport()));
    const pages = await screen.findByRole("list", {
      name: "Pages being viewed right now",
    });
    expect(within(pages).getByText("/pricing")).toBeInTheDocument();
    expect(within(pages).getByText("3 active sessions")).toBeInTheDocument();
    expect(api.getSessionLive).toHaveBeenCalledWith("rod-dev-client", {
      signal: expect.any(AbortSignal),
    });
  });

  it("compares KPIs with the previous range, skipping a zero baseline", () => {
    renderReport(loaded(busyReport));
    const visitors = screen.getByText("Visitors", {
      selector: "span[class*=stat-card-label]",
    }).parentElement!;
    expect(visitors).toHaveTextContent("+20.0%");
    expect(visitors).toHaveTextContent("90 new");
    const sessions = screen.getByText("Sessions", {
      selector: "span[class*=stat-card-label]",
    }).parentElement!;
    expect(sessions).not.toHaveTextContent("%");
    expect(screen.getByText("2.7 pages / session")).toBeInTheDocument();
    expect(screen.getByText("40.0%")).toBeInTheDocument();
  });

  it("labels an hour-bucketed range as hourly", () => {
    renderReport(loaded(busyReport));
    expect(screen.getByText("Hourly Trends")).toBeInTheDocument();
    expect(
      screen.getByText(
        "2026-09-22 00:00 → 2026-09-22 01:00 · America/Vancouver",
      ),
    ).toBeInTheDocument();
  });

  it("ranks pages by views until re-sorted", () => {
    renderReport(loaded(busyReport));
    const table = screen
      .getByRole("heading", { name: "Pages" })
      .closest(".table-component") as HTMLElement;
    const paths = within(table)
      .getAllByRole("button", { name: /^\// })
      .map((button) => button.textContent);
    expect(paths).toEqual(["/", "/about"]);
  });

  it("drills from a country into its sessions", async () => {
    renderReport(loaded(busyReport));
    fireEvent.click(
      screen.getByRole("button", { name: "Show sessions from 🇨🇦 Canada" }),
    );
    await vi.waitFor(() =>
      expect(api.getSessionsList.mock.calls.at(-1)?.[2]).toEqual({
        country: "CA",
      }),
    );
    expect(await screen.findByText("🇨🇦 Canada (CA)")).toBeInTheDocument();
  });

  it("drills from a page and a channel, adding up the filters", async () => {
    renderReport(loaded(busyReport));
    fireEvent.click(
      screen.getByRole("button", { name: "Show Organic Search sessions" }),
    );
    fireEvent.click(screen.getByTitle("Show sessions that viewed /about"));
    await vi.waitFor(() =>
      expect(api.getSessionsList.mock.calls.at(-1)?.[2]).toEqual({
        channel: "Organic Search",
        path: "/about",
      }),
    );
  });

  it("names the failure when the report cannot load", () => {
    renderReport(loaded(null, new Error("sessions-service is unreachable")));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "First-party analytics unavailable",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "sessions-service is unreachable",
    );
  });
});
