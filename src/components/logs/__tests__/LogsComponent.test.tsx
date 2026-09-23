import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchParams } from "next/navigation";
import { resetSettings } from "@/lib/settings";
import ApiService from "@/services/ApiService";
import LogsComponent from "../../LogsComponent";

vi.mock("@rodrigo-barraza/components-library", () => import("../../__tests__/componentsLibraryStub"));

vi.mock("@/services/ApiService", () => ({
  default: {
    getLoggableContainers: vi.fn(),
    getContainerStats: vi.fn(),
    restartContainer: vi.fn(),
    buildLogStreamUrl: (container: string, { device }: { device?: string }) =>
      `http://portal/logs/${container}?device=${device}`,
  },
}));

const api = vi.mocked(ApiService);

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances: MockEventSource[] = [];
  readyState = 0;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, ((event: MessageEvent) => void)[]>();
  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close() {
    this.readyState = MockEventSource.CLOSED;
  }
  emit(type: string, data?: string) {
    const event = new MessageEvent(type, { data });
    this.listeners.get(type)?.forEach((listener) => listener(event));
    if (type === "message") this.onmessage?.(event);
  }
}

beforeEach(() => {
  resetSettings();
  MockEventSource.instances = [];
  vi.stubGlobal("EventSource", MockEventSource);
  api.getLoggableContainers.mockResolvedValue({
    containers: [
      { name: "prism-service", device: "synology", deviceName: "Synology", state: "running" },
      { name: "prism-service", device: "workstation", deviceName: "Workstation", state: "running" },
    ],
  });
  api.getContainerStats.mockResolvedValue({
    containers: [
      {
        name: "prism-service",
        device: "workstation",
        state: "running",
        status: "Up 1 hour",
        cpu: { percent: 3, cores: 2 },
        memory: { used: 1024, limit: 2048, percent: 50 },
      },
    ],
  });
  api.restartContainer.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
  vi.clearAllMocks();
});

describe("LogsComponent", () => {
  it("opens the deep-linked container on the linked host", async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("container=prism-service&device=workstation") as never,
    );
    render(<LogsComponent />);
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    expect(MockEventSource.instances[0].url).toBe(
      "http://portal/logs/prism-service?device=workstation",
    );
    await waitFor(() => expect(api.getContainerStats).toHaveBeenCalledWith("workstation", expect.anything()));
  });

  it("shows the log text, not the JSON frame around it", async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("container=prism-service&device=synology") as never,
    );
    render(<LogsComponent />);
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    const source = MockEventSource.instances[0];
    await act(async () => {
      source.emit("connected", "{}");
      source.emit(
        "message",
        JSON.stringify({ line: "2026-09-22T10:00:00Z server listening", stream: "stdout" }),
      );
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    });
    expect(screen.getByText("server listening")).toBeInTheDocument();
    expect(screen.queryByText(/"stream"/)).not.toBeInTheDocument();
  });

  it("restarts only after confirmation, then follows the new stream", async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("container=prism-service&device=synology") as never,
    );
    render(<LogsComponent />);
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: "Restart prism-service" }));
    expect(api.restartContainer).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog", { name: "Restart prism-service?" });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Restart" }));
    });

    expect(api.restartContainer).toHaveBeenCalledWith("prism-service", "synology");
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(2));
    expect(MockEventSource.instances[0].readyState).toBe(MockEventSource.CLOSED);
  });

  it("leaves the browser's Ctrl+F alone until a log is open", async () => {
    render(<LogsComponent />);
    await waitFor(() => expect(api.getLoggableContainers).toHaveBeenCalled());
    const event = new KeyboardEvent("keydown", { key: "f", ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("says when the container list could not be loaded", async () => {
    api.getLoggableContainers.mockRejectedValue(new Error("service down"));
    render(<LogsComponent />);
    expect(await screen.findByText("Couldn't load containers: service down")).toBeInTheDocument();
  });
});
