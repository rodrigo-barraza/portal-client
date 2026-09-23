import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSettings, updateSettings } from "@/lib/settings";
import ApiService from "@/services/ApiService";
import ContainerStatsComponent from "../../ContainerStatsComponent";
import {
  EMPTY_METRICS,
  EMPTY_STATS_HISTORY,
  containerActionResponse,
  deviceSystemInfo,
  dockerContainer,
} from "../../__tests__/apiFixtures";

vi.mock(
  "@rodrigo-barraza/components-library",
  () => import("../../__tests__/componentsLibraryStub"),
);

vi.mock("@/services/ApiService", () => ({
  default: {
    getContainerStats: vi.fn(),
    getServices: vi.fn(),
    getSystemInfo: vi.fn(),
    getContainerMetrics: vi.fn(),
    getContainerStatsHistory: vi.fn(),
    getRollbackStatus: vi.fn(),
    getRollbackStatuses: vi.fn(),
    invalidateStats: vi.fn(),
    startContainer: vi.fn(),
    stopContainer: vi.fn(),
    restartContainer: vi.fn(),
    rollbackService: vi.fn(),
    buildContainerPreviewUrl: (domain: string) =>
      `http://portal/containers/previews/${domain}`,
  },
}));

const api = vi.mocked(ApiService);

beforeEach(() => {
  resetSettings();
  api.getContainerStats.mockResolvedValue({
    containers: [
      dockerContainer({ name: "prism-service", device: "synology" }),
      dockerContainer({ name: "prism-service", device: "workstation" }),
    ],
    fetchedAt: "2026-09-22T00:00:00.000Z",
  });
  api.getServices.mockResolvedValue({
    services: [
      {
        id: "prism-service",
        name: "Prism Service",
        healthy: true,
        checkedAt: "2026-09-22T00:00:00.000Z",
        dockerProject: "prism-service",
      },
    ],
    infrastructure: [],
  });
  api.getSystemInfo.mockResolvedValue([
    deviceSystemInfo({ deviceId: "synology", totalMemory: 16 * 1024 ** 3 }),
  ]);
  api.getContainerMetrics.mockResolvedValue(EMPTY_METRICS);
  api.getContainerStatsHistory.mockResolvedValue(EMPTY_STATS_HISTORY);
  api.getRollbackStatus.mockResolvedValue({ available: false });
  api.getRollbackStatuses.mockResolvedValue({});
  api.invalidateStats.mockResolvedValue({ ok: true });
  api.stopContainer.mockResolvedValue(containerActionResponse("prism-service"));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ContainerStatsComponent", () => {
  it("renders same-named containers on different hosts as separate rows", async () => {
    render(<ContainerStatsComponent />);
    const names = await screen.findAllByRole("button", {
      name: "Show details for prism-service",
    });
    expect(names).toHaveLength(2);
  });

  it("states the configured polling interval", async () => {
    updateSettings({ containerPollingInterval: 15 });
    render(<ContainerStatsComponent />);
    expect(await screen.findByText(/polling every 15s/)).toBeInTheDocument();
  });

  it("stops the container on the clicked host, only after confirmation", async () => {
    render(<ContainerStatsComponent />);
    const stopButtons = await screen.findAllByRole("button", {
      name: "Stop prism-service",
    });
    const workstationRow = stopButtons[1].closest("tr");
    expect(workstationRow).not.toBeNull();
    expect(
      within(workstationRow as HTMLElement).getByText("workstation"),
    ).toBeInTheDocument();

    fireEvent.click(stopButtons[1]);
    expect(api.stopContainer).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("alertdialog", {
      name: "Stop prism-service?",
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Stop" }));
    });

    await waitFor(() =>
      expect(api.stopContainer).toHaveBeenCalledWith(
        "prism-service",
        "workstation",
      ),
    );
    await waitFor(() => expect(api.invalidateStats).toHaveBeenCalled());
  });

  it("surfaces a failed poll instead of claiming there are no containers", async () => {
    api.getContainerStats.mockRejectedValue(
      new Error("portal-service unreachable"),
    );
    render(<ContainerStatsComponent />);
    expect(
      await screen.findByText(
        "Couldn't load containers: portal-service unreachable",
      ),
    ).toBeInTheDocument();
  });
});
