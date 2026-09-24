import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  envelope,
  sessionDetail,
  sessionSummary,
  sessionsPage,
} from "../../__tests__/apiFixtures";

const api = vi.hoisted(() => ({
  getSessionsList: vi.fn(),
  getSessionDetail: vi.fn(),
  getSessionReplay: vi.fn(),
}));

vi.mock("../../../services/ApiService", () => ({ default: api }));
// The replay player is lazy-loaded via next/dynamic; stub it out here
vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="replay-stub" />,
}));

import SessionExplorerComponent from "../../SessionExplorerComponent";
import { INITIAL_EXPLORER_STATE, type ExplorerState } from "../explorerModel";

const PROJECT = "rod-dev-client";
const SESSION_ID = "session-aaaaaaaaaaaa";

/** The explorer is controlled by its report; this plays the report. */
function Harness({
  period = "30d",
  initial = INITIAL_EXPLORER_STATE,
}: {
  period?: string;
  initial?: ExplorerState;
}) {
  const [state, setState] = useState(initial);
  return (
    <SessionExplorerComponent
      projectId={PROJECT}
      period={period}
      state={state}
      onStateChange={setState}
    />
  );
}

/** The arguments of the most recent list request, without the signal. */
function lastListCall() {
  const call = api.getSessionsList.mock.calls.at(-1)!;
  return {
    projectId: call[0],
    range: call[1],
    filters: call[2],
    paging: call[3],
    sort: call[4],
  };
}

async function openFirstSession() {
  fireEvent.click(
    await screen.findByRole("button", { name: /^Open session started/ }),
  );
  await screen.findByRole("region", { name: "Journey" });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getSessionsList.mockResolvedValue(
    envelope(sessionsPage([sessionSummary({ hasReplay: true })])),
  );
  api.getSessionDetail.mockResolvedValue(envelope(sessionDetail()));
});

describe("SessionExplorerComponent — list", () => {
  it("asks for the newest 50 sessions of the dashboard's range", async () => {
    render(<Harness />);
    await screen.findByRole("button", { name: /^Open session started/ });
    expect(lastListCall()).toEqual({
      projectId: PROJECT,
      range: { period: "30d" },
      filters: {},
      paging: { limit: 50, offset: 0 },
      sort: { sort: "startedAt", order: "desc" },
    });
  });

  it("sends a custom dashboard range as its calendar days", async () => {
    render(<Harness period="2026-09-01_2026-09-10" />);
    await screen.findByRole("button", { name: /^Open session started/ });
    expect(lastListCall().range).toEqual({
      from: "2026-09-01",
      to: "2026-09-10",
    });
  });

  it("shows who, where, on what, from where and what they did", async () => {
    render(<Harness />);
    const table = await screen.findByRole("table");
    expect(within(table).getByText("visitor-…")).toBeInTheDocument();
    expect(within(table).getByText("returning #3")).toBeInTheDocument();
    expect(within(table).getByText("🇨🇦 Vancouver, Canada")).toBeInTheDocument();
    expect(within(table).getByText("Chrome · macOS")).toBeInTheDocument();
    expect(within(table).getByText("Organic Search")).toBeInTheDocument();
    expect(within(table).getByText("www.google.com")).toBeInTheDocument();
    expect(within(table).getByText("/pricing")).toBeInTheDocument();
    expect(within(table).getByLabelText("Has a replay")).toBeInTheDocument();
  });

  it("filters on the server with the replay and engaged toggles", async () => {
    render(<Harness />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "With replay" }));
    fireEvent.click(screen.getByRole("button", { name: "Engaged only" }));
    await vi.waitFor(() =>
      expect(lastListCall().filters).toEqual({ replay: true, engaged: true }),
    );
    expect(screen.getByRole("button", { name: "With replay" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("adds a typed filter as a removable chip", async () => {
    render(<Harness />);
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("Filter by"), {
      target: { value: "country" },
    });
    fireEvent.change(screen.getByLabelText("Filter value"), {
      target: { value: " ca " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));

    const chips = await screen.findByRole("list", { name: "Active filters" });
    expect(within(chips).getByText("🇨🇦 Canada (CA)")).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(lastListCall().filters).toEqual({ country: "CA" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Remove filter Country: CA" }),
    );
    await vi.waitFor(() => expect(lastListCall().filters).toEqual({}));
    expect(
      screen.queryByRole("list", { name: "Active filters" }),
    ).not.toBeInTheDocument();
  });

  it("sorts on the server", async () => {
    render(<Harness />);
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("Sort sessions"), {
      target: { value: "engagedMs:desc" },
    });
    await vi.waitFor(() =>
      expect(lastListCall().sort).toEqual({ sort: "engagedMs", order: "desc" }),
    );
  });

  it("pages through the server's total and starts over for a new query", async () => {
    api.getSessionsList.mockResolvedValue(
      envelope(sessionsPage([sessionSummary()], { total: 120 })),
    );
    render(<Harness />);
    await screen.findByRole("table");
    expect(screen.getByText("120 sessions")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await vi.waitFor(() =>
      expect(lastListCall().paging).toEqual({ limit: 50, offset: 50 }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Engaged only" }));
    await vi.waitFor(() =>
      expect(lastListCall()).toMatchObject({
        filters: { engaged: true },
        paging: { limit: 50, offset: 0 },
      }),
    );
  });

  it("searches all time from the scope control", async () => {
    render(<Harness />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("radio", { name: "All time" }));
    await vi.waitFor(() =>
      expect(lastListCall().range).toEqual({ period: "all" }),
    );
  });

  it("explains an empty range and offers all time", async () => {
    api.getSessionsList.mockResolvedValue(envelope(sessionsPage([])));
    render(<Harness />);
    expect(
      await screen.findByText(/No sessions in this range yet/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Search all time" }));
    await vi.waitFor(() =>
      expect(lastListCall().range).toEqual({ period: "all" }),
    );
  });

  it("offers to clear filters that match nothing", async () => {
    api.getSessionsList.mockResolvedValue(envelope(sessionsPage([])));
    render(
      <Harness
        initial={{ ...INITIAL_EXPLORER_STATE, filters: { ip: "198.51.100.1" } }}
      />,
    );
    expect(
      await screen.findByText(/No sessions match these filters/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await vi.waitFor(() => expect(lastListCall().filters).toEqual({}));
  });

  it("reports a failed list as an error, not as an empty range", async () => {
    api.getSessionsList.mockRejectedValue(new Error("Unauthorized"));
    render(<Harness />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load sessions: Unauthorized",
    );
    expect(
      screen.queryByText(/No sessions in this range/),
    ).not.toBeInTheDocument();
  });

  it('never shows a bare `{ error: true }` body as the text "true"', async () => {
    api.getSessionsList.mockRejectedValue(new Error(String(true)));
    render(<Harness />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^Could not load sessions\.$/,
    );
  });
});

describe("SessionExplorerComponent — session detail", () => {
  it("opens a session from its row's button and returns to the list", async () => {
    render(<Harness />);
    await openFirstSession();
    expect(api.getSessionDetail).toHaveBeenCalledWith(SESSION_ID, {
      signal: expect.any(AbortSignal),
    });
    expect(
      screen.getByRole("heading", { name: "Session session-aaaa…" }),
    ).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Back to sessions" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("walks the journey: pages in order with time and scroll, events between", async () => {
    render(<Harness />);
    await openFirstSession();
    const journey = screen.getByRole("region", { name: "Journey" });
    const steps = within(journey)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toMatch(/Page 1.*\/ — Home.*20\.0s engaged.*80% scrolled/);
    expect(steps[1]).toMatch(
      /Event.*outbound on \/.*url.*https:\/\/github\.com\/rod/,
    );
    expect(steps[2]).toMatch(
      /Page 2.*\/pricing — Pricing.*45\.0s engaged.*35% scrolled/,
    );
  });

  it("shows identity, client and acquisition details", async () => {
    render(<Harness />);
    await openFirstSession();
    expect(screen.getByText("203.0.113.5")).toBeInTheDocument();
    expect(screen.getByText("Chrome 140")).toBeInTheDocument();
    expect(screen.getByText("macOS 15")).toBeInTheDocument();
    expect(screen.getByText("google / organic")).toBeInTheDocument();
    expect(screen.getByText("en-CA")).toBeInTheDocument();
    expect(screen.getByText(/returning · session #3 of 7/)).toBeInTheDocument();
    expect(
      screen.getByText("Mozilla/5.0 (Macintosh) Chrome/140"),
    ).toBeInTheDocument();
  });

  it("mounts the replay player only for a session with a recording", async () => {
    render(<Harness />);
    await openFirstSession();
    expect(screen.queryByTestId("replay-stub")).not.toBeInTheDocument();

    api.getSessionDetail.mockResolvedValue(
      envelope(sessionDetail({ replay: { chunks: 3, bytes: 90_000 } })),
    );
    fireEvent.click(screen.getByRole("button", { name: "Back to sessions" }));
    await openFirstSession();
    expect(screen.getByTestId("replay-stub")).toBeInTheDocument();
  });

  it("lists every session of the visitor, all time", async () => {
    render(<Harness />);
    await openFirstSession();
    fireEvent.click(
      screen.getByRole("button", {
        name: "All sessions from this visitor (7)",
      }),
    );
    await screen.findByRole("table");
    expect(lastListCall()).toMatchObject({
      range: { period: "all" },
      filters: { visitorId: "visitor-1234567890" },
    });
    expect(screen.getByRole("radio", { name: "All time" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("lists every session of the IP, all time", async () => {
    render(<Harness />);
    await openFirstSession();
    fireEvent.click(
      screen.getByRole("button", { name: "All sessions from this IP" }),
    );
    await screen.findByRole("table");
    expect(lastListCall()).toMatchObject({
      range: { period: "all" },
      filters: { ip: "203.0.113.5" },
    });
  });

  it("reports a session that failed to load", async () => {
    api.getSessionDetail.mockRejectedValue(new Error("Session not found"));
    render(<Harness />);
    fireEvent.click(
      await screen.findByRole("button", { name: /^Open session started/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load this session: Session not found",
    );
  });
});
