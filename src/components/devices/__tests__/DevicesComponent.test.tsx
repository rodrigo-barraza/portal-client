import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import DevicesComponent from "../../DevicesComponent";
import ApiService from "../../../services/ApiService";
import { resetSettings, updateSettings } from "@/lib/settings";
import { device, dockerContainer } from "../../__tests__/apiFixtures";
import {
  deviceStatus,
  groupContainersByDevice,
  sortDevicesByContainerCount,
  type DeviceContainer,
} from "../deviceModel";

vi.mock("@rodrigo-barraza/components-library", () => import("../../__tests__/componentsLibraryStub"));
vi.mock("../../../services/ApiService", () => ({
  default: { getDevices: vi.fn(), getContainerStats: vi.fn() },
}));

const api = vi.mocked(ApiService);

const CONTAINERS: DeviceContainer[] = [
  dockerContainer({ name: "web", device: "nas", status: "Up 2 hours", cpu: { percent: 95, cores: 2 }, memory: { used: 1024, limit: 2048, percent: 50 } }),
  dockerContainer({ name: "api", device: "nas", state: "exited", status: "Exited (0)", cpu: { percent: 0, cores: 0 }, memory: { used: 0, limit: 0, percent: 0 } }),
  dockerContainer({ name: "lights", device: "pi", status: "" }),
];

describe("deviceModel", () => {
  it("groups containers per device, sorted by name", () => {
    const groups = groupContainersByDevice(CONTAINERS);
    expect(groups.nas.map((container) => container.name)).toEqual(["api", "web"]);
    expect(groups.pi.map((container) => container.name)).toEqual(["lights"]);
  });

  it("orders devices busiest first", () => {
    const devices = [
      { id: "pi", name: "Pi" },
      { id: "desktop", name: "Desktop" },
      { id: "nas", name: "NAS" },
    ];
    expect(sortDevicesByContainerCount(devices, groupContainersByDevice(CONTAINERS)).map((device) => device.id)).toEqual([
      "nas",
      "pi",
      "desktop",
    ]);
  });

  it("reads a device without containers as inactive, not down", () => {
    expect(deviceStatus([])).toEqual({ variant: "inactive", running: 0, total: 0 });
    expect(deviceStatus(groupContainersByDevice(CONTAINERS).nas).variant).toBe("unhealthy");
    expect(deviceStatus(groupContainersByDevice(CONTAINERS).pi).variant).toBe("healthy");
  });
});

describe("DevicesComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSettings();
    api.getDevices.mockResolvedValue({
      devices: [
        device({ id: "nas", name: "NAS", type: "NAS", os: "DSM", hostname: "192.168.1.2" }),
        device({ id: "desktop", name: "Desktop", type: "Desktop" }),
      ],
    });
    api.getContainerStats.mockResolvedValue({
      containers: CONTAINERS,
      fetchedAt: "2026-09-22T00:00:00.000Z",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows metrics only for running containers, colored by the user's thresholds", async () => {
    updateSettings({ alertThresholdCpu: 99 });
    render(<DevicesComponent />);

    expect(await screen.findByText("Up 2 hours")).toBeInTheDocument();
    const cpuBadge = screen.getByTitle(/^CPU: 95%/);
    // 95% is above the warn floor but under the user's 99% alert threshold
    expect(cpuBadge.style.getPropertyValue("--metric-color")).toBe("var(--color-warning)");
    expect(screen.queryByTitle(/^CPU: 0%/)).not.toBeInTheDocument();
    expect(screen.getByText("exited")).toBeInTheDocument();
  });

  it("marks a device with no containers inactive and skips empty host rows", async () => {
    render(<DevicesComponent />);
    await screen.findByText("Up 2 hours");
    expect(screen.getByTitle("No containers reported").querySelector("[data-status]")).toHaveAttribute(
      "data-status",
      "inactive",
    );
    expect(screen.getAllByText("Hostname")).toHaveLength(1);
  });

  it("pauses container polling while the tab is hidden", async () => {
    vi.useFakeTimers();
    render(<DevicesComponent />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const initialCalls = api.getContainerStats.mock.calls.length;

    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(api.getContainerStats.mock.calls.length).toBe(initialCalls);

    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.getContainerStats.mock.calls.length).toBe(initialCalls + 1);
    visibility.mockRestore();
  });

  it("shows an error state with retry when devices fail to load", async () => {
    api.getDevices.mockRejectedValueOnce(new Error("registry unavailable"));
    render(<DevicesComponent />);
    expect(await screen.findByText("registry unavailable")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "NAS" })).toBeInTheDocument();
  });
});
