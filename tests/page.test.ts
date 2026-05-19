import { describe, it, expect, vi } from "vitest";

// next/navigation's redirect throws a NEXT_REDIRECT error to stop rendering,
// so we verify the function is called rather than testing the rendered output.
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

describe("Home page", () => {
  it("redirects to /containers", async () => {
    const { default: Page } = await import("@/app/page");
    Page();
    expect(mockRedirect).toHaveBeenCalledWith("/containers");
  });
});
