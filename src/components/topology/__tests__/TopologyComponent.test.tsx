import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import TopologyComponent from "../../TopologyComponent";
import ApiService from "../../../services/ApiService";
import type { ServicesResponse } from "../../../types/portal";
import { projectAnalysis } from "../../__tests__/apiFixtures";

vi.mock("@rodrigo-barraza/components-library", () => import("../../__tests__/componentsLibraryStub"));
vi.mock("../../../services/ApiService", () => ({
  default: {
    getServices: vi.fn(),
    getProjectAnalysis: vi.fn(),
  },
}));

const getServices = vi.mocked(ApiService.getServices);
const getProjectAnalysis = vi.mocked(ApiService.getProjectAnalysis);

const SERVICES: ServicesResponse = {
  services: [
    { id: "api", name: "API", healthy: true, projectType: "Service", deployTier: 1, dependsOn: ["lib"] },
    { id: "web", name: "Web", healthy: false, projectType: "Client", deployTier: 1, dependsOn: ["api"] },
    { id: "lib", name: "Lib", healthy: true, projectType: "Library" },
  ],
  infrastructure: [{ id: "mongodb", name: "MongoDB", healthy: true, projectType: "Database", deployTier: 0 }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TopologyComponent", () => {
  it("serves the code analysis from cache on load and forces it on refresh", async () => {
    getServices.mockResolvedValue(SERVICES);
    getProjectAnalysis.mockResolvedValue(projectAnalysis());

    render(<TopologyComponent />);

    expect(await screen.findByText("API")).toBeInTheDocument();
    expect(screen.getByText("4 services · 3 healthy")).toBeInTheDocument();
    const withSignal = { signal: expect.any(AbortSignal) };
    expect(getServices).toHaveBeenCalledWith(true, withSignal);
    expect(getProjectAnalysis).toHaveBeenCalledWith(false, withSignal);

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => expect(getProjectAnalysis).toHaveBeenLastCalledWith(true, withSignal));
  });

  it("shows an error state with retry instead of an empty graph", async () => {
    getServices.mockRejectedValueOnce(new Error("portal-service unreachable"));
    getProjectAnalysis.mockRejectedValue(new Error("analysis unavailable"));

    render(<TopologyComponent />);

    expect(await screen.findByText("Couldn't load the topology")).toBeInTheDocument();
    expect(screen.getByText("portal-service unreachable")).toBeInTheDocument();

    getServices.mockResolvedValue(SERVICES);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("MongoDB")).toBeInTheDocument();
  });

  it("keeps the last analysis when a refresh's analysis request fails", async () => {
    getServices.mockResolvedValue(SERVICES);
    getProjectAnalysis.mockResolvedValueOnce(
      projectAnalysis({
        github: {
          tokenConfigured: false,
          status: "unavailable",
          stats: { requests: 4, failures: 4, unauthorized: 4, rateLimited: 0, notFound: 0 },
        },
      }),
    );

    render(<TopologyComponent />);
    expect(await screen.findByText(/code analysis offline/)).toBeInTheDocument();

    getProjectAnalysis.mockRejectedValueOnce(new Error("rate limited"));
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => expect(getProjectAnalysis).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/code analysis offline/)).toBeInTheDocument();
  });

  it("selects nodes from the keyboard", async () => {
    getServices.mockResolvedValue(SERVICES);
    getProjectAnalysis.mockRejectedValue(new Error("analysis unavailable"));

    render(<TopologyComponent />);
    const node = await screen.findByRole("button", { name: "Web, down" });

    fireEvent.keyDown(node, { key: "Enter" });
    expect(node).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Upstream")).toBeInTheDocument();

    fireEvent.keyDown(node, { key: "Escape" });
    expect(node).toHaveAttribute("aria-pressed", "false");
  });

  it("pans, zooms and clears the selection from the keyboard on the focusable canvas", async () => {
    getServices.mockResolvedValue(SERVICES);
    getProjectAnalysis.mockRejectedValue(new Error("analysis unavailable"));

    const { container } = render(<TopologyComponent />);
    const node = await screen.findByRole("button", { name: "Web, down" });
    const canvas = screen.getByRole("region", { name: /service topology/i });
    expect(canvas).toHaveAttribute("tabindex", "0");
    const graph = () => container.querySelector("svg > g")!.getAttribute("transform");

    const before = graph();
    fireEvent.keyDown(canvas, { key: "ArrowRight" });
    const panned = graph();
    expect(panned).not.toBe(before);
    fireEvent.keyDown(canvas, { key: "ArrowLeft" });
    expect(graph()).toBe(before);

    fireEvent.keyDown(canvas, { key: "+" });
    expect(graph()).toMatch(/scale\(1\.25\)/);

    fireEvent.keyDown(node, { key: "Enter" });
    expect(node).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(canvas, { key: "Escape" });
    expect(node).toHaveAttribute("aria-pressed", "false");
  });

  it("labels the libraries cluster correctly in the by-type view", async () => {
    getServices.mockResolvedValue(SERVICES);
    getProjectAnalysis.mockRejectedValue(new Error("analysis unavailable"));

    render(<TopologyComponent />);
    await screen.findByText("API");

    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: /by type/i }));
    });
    expect(screen.getByText("Libraries")).toBeInTheDocument();
    expect(screen.queryByText("Librarys")).not.toBeInTheDocument();
  });

  it("ignores a response that lands after a newer one", async () => {
    let resolveFirst: (value: ServicesResponse) => void = () => {};
    getServices
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValue(SERVICES);
    getProjectAnalysis.mockRejectedValue(new Error("analysis unavailable"));

    render(<TopologyComponent />);
    // StrictMode-style re-run / refresh: a second request supersedes the first
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(await screen.findByText("API")).toBeInTheDocument();

    await act(async () => {
      resolveFirst({ services: [{ id: "stale", name: "Stale", healthy: true }], infrastructure: [] });
    });
    expect(screen.queryByText("Stale")).not.toBeInTheDocument();
  });
});
