import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { updateSettings, resetSettings } from "@/lib/settings";

// The root page is a client component that redirects to the user's
// configured landing page (Settings → Dashboard), so we mock the router
// and assert on router.replace.
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: mockReplace,
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

describe("Home page", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    resetSettings();
  });

  it("redirects to /containers by default", async () => {
    const { default: Page } = await import("../page");
    render(React.createElement(Page));
    expect(mockReplace).toHaveBeenCalledWith("/containers");
  });

  it("redirects to the configured landing page", async () => {
    updateSettings({ defaultPage: "/projects" });

    const { default: Page } = await import("../page");
    render(React.createElement(Page));
    expect(mockReplace).toHaveBeenCalledWith("/projects");
  });

  it("falls back to /containers for unknown landing pages", async () => {
    updateSettings({ defaultPage: "/nonsense" });

    const { default: Page } = await import("../page");
    render(React.createElement(Page));
    expect(mockReplace).toHaveBeenCalledWith("/containers");
  });
});
