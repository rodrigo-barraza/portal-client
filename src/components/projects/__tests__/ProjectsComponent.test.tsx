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
import type { PortalService } from "@/types/portal";
import ProjectsComponent from "../../ProjectsComponent";
import { serviceActionResponse } from "../../__tests__/apiFixtures";

vi.mock(
  "@rodrigo-barraza/components-library",
  () => import("../../__tests__/componentsLibraryStub"),
);

vi.mock("@/services/ApiService", () => ({
  default: {
    getServices: vi.fn(),
    getProjectSizes: vi.fn(),
    getProjectLanguages: vi.fn(),
    getRollbackStatus: vi.fn(),
    getRollbackStatuses: vi.fn(),
    startService: vi.fn(),
    stopService: vi.fn(),
    restartService: vi.fn(),
    rollbackService: vi.fn(),
  },
}));

const api = vi.mocked(ApiService);

const CHECKED = "2026-09-22T00:00:00.000Z";

const services: PortalService[] = [
  {
    id: "prism-service",
    name: "Prism Service",
    healthy: true,
    checkedAt: CHECKED,
    projectType: "Service",
    dockerProject: "prism-service",
    restartable: true,
  },
  {
    id: "components-library",
    name: "Components Library",
    healthy: false,
    checkedAt: CHECKED,
    projectType: "Library",
    error: "No URL configured",
    restartable: false,
  },
];

const infrastructure: PortalService[] = [
  {
    id: "mongodb",
    name: "MongoDB",
    healthy: true,
    checkedAt: CHECKED,
    projectType: "Database",
  },
];

beforeEach(() => {
  resetSettings();
  updateSettings({ defaultView: "card" });
  api.getServices.mockResolvedValue({ services, infrastructure });
  api.getProjectSizes.mockResolvedValue({ sizes: {}, fetchedAt: CHECKED });
  api.getProjectLanguages.mockResolvedValue({
    languages: {},
    fetchedAt: CHECKED,
  });
  api.getRollbackStatus.mockResolvedValue({ available: false });
  api.getRollbackStatuses.mockResolvedValue({});
  api.stopService.mockResolvedValue(serviceActionResponse("Prism Service"));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ProjectsComponent", () => {
  it("stops a service from its card after confirmation", async () => {
    render(<ProjectsComponent />);
    const stop = await screen.findByRole("button", { name: "Stop" });
    fireEvent.click(stop);
    expect(api.stopService).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog", {
      name: "Stop Prism Service?",
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Stop" }));
    });
    expect(api.stopService).toHaveBeenCalledWith("prism-service");
    expect(
      await screen.findByText("Prism Service stopped"),
    ).toBeInTheDocument();
  });

  it("shows why an action failed", async () => {
    api.stopService.mockRejectedValue(
      new Error("No Docker API configured for device: nas"),
    );
    render(<ProjectsComponent />);
    fireEvent.click(await screen.findByRole("button", { name: "Stop" }));
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: "Stop",
        }),
      );
    });
    expect(
      await screen.findByText(
        "Stop failed for Prism Service: No Docker API configured for device: nas",
      ),
    ).toBeInTheDocument();
  });

  it("does not paint libraries as down", async () => {
    render(<ProjectsComponent />);
    expect(await screen.findByText("Not Deployed")).toBeInTheDocument();
    expect(screen.queryByText("No URL configured")).not.toBeInTheDocument();
  });

  it("shows unprobed infrastructure as unchecked, not down", async () => {
    updateSettings({ showInfrastructure: true });
    api.getServices.mockResolvedValue({
      services,
      infrastructure: [
        {
          id: "llama",
          name: "llama.cpp",
          healthy: false,
          checkedAt: undefined,
          projectType: "Inference",
          error: 'Unchecked — no health probe for infrastructure type "gpu"',
        },
      ],
    });
    render(<ProjectsComponent />);
    expect(await screen.findByText("Unchecked")).toBeInTheDocument();
    expect(screen.queryByText(/no health probe/)).not.toBeInTheDocument();
  });

  it("includes databases and stores only when the setting asks for them", async () => {
    const { unmount } = render(<ProjectsComponent />);
    await screen.findByText("Prism Service");
    expect(screen.queryByText("MongoDB")).not.toBeInTheDocument();
    unmount();

    updateSettings({ showInfrastructure: true });
    render(<ProjectsComponent />);
    expect(await screen.findByText("MongoDB")).toBeInTheDocument();
  });

  it("runs a real health round for the first load and on Check All", async () => {
    render(<ProjectsComponent />);
    await waitFor(() =>
      expect(api.getServices).toHaveBeenCalledWith(true, expect.anything()),
    );
    const callsBefore = api.getServices.mock.calls.length;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Check All" }));
    });
    expect(api.getServices.mock.calls.length).toBe(callsBefore + 1);
    expect(api.getServices).toHaveBeenLastCalledWith(true, expect.anything());
  });

  it("says when projects could not be loaded", async () => {
    api.getServices.mockRejectedValue(new Error("portal-service unreachable"));
    render(<ProjectsComponent />);
    expect(
      await screen.findByText(
        "Couldn't load projects: portal-service unreachable",
      ),
    ).toBeInTheDocument();
  });
});
