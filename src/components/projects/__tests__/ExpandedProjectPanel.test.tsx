import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSettings } from "@/lib/settings";
import ApiService from "@/services/ApiService";
import type { PortalService } from "@/types/portal";
import ExpandedProjectPanel from "../../ExpandedProjectPanelComponent";

vi.mock("@rodrigo-barraza/components-library", () => import("../../__tests__/componentsLibraryStub"));

vi.mock("@/services/ApiService", () => ({
  default: {
    getContainerStats: vi.fn(),
    getContainerMetrics: vi.fn(),
    getGAOverview: vi.fn(),
    getGAPages: vi.fn(),
    getGARealtime: vi.fn(),
  },
}));

const api = vi.mocked(ApiService);

const service: PortalService = {
  id: "prism-service",
  name: "Prism Service",
  healthy: true,
  checkedAt: "2026-09-22T00:00:00.000Z",
  projectType: "Service",
  dockerProject: "prism-service",
};

beforeEach(() => {
  resetSettings();
  api.getContainerStats.mockResolvedValue({
    containers: [
      {
        name: "prism-service",
        device: "synology",
        state: "running",
        cpu: { percent: 12.5, cores: 4 },
        memory: { used: 512 * 1024 ** 2, limit: 2 * 1024 ** 3, percent: 25 },
      },
    ],
  });
  api.getContainerMetrics.mockResolvedValue({ containers: {} });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ExpandedProjectPanel", () => {
  it("loads live container metrics on the Container tab", async () => {
    render(<ExpandedProjectPanel service={service} allServices={[service]} />);
    expect(api.getContainerStats).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Container" }));
    expect(await screen.findByText("512 MB")).toBeInTheDocument();
    expect(api.getContainerMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ container: "prism-service" }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("says a project without a container is not containerized", () => {
    render(
      <ExpandedProjectPanel
        service={{ ...service, dockerProject: undefined, projectType: "Library" }}
        allServices={[]}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Container" }));
    expect(screen.getByText("Not containerized")).toBeInTheDocument();
    expect(api.getContainerStats).not.toHaveBeenCalled();
  });

  it("only offers Web Analytics for projects with a GA property", () => {
    render(<ExpandedProjectPanel service={service} allServices={[service]} />);
    expect(screen.queryByRole("tab", { name: "Web Analytics" })).not.toBeInTheDocument();
  });

  it("hides the health error for libraries", () => {
    render(
      <ExpandedProjectPanel
        service={{ ...service, projectType: "Library", healthy: false, error: "No URL configured" }}
        allServices={[]}
      />,
    );
    expect(screen.queryByText("No URL configured")).not.toBeInTheDocument();
  });
});
