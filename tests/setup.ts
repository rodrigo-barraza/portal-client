import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock next/navigation — components read the path/router; there is no
// Next.js app router in unit tests.
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// ── Browser APIs jsdom does not implement ─────────────────────────
// Library components (tables, charts, the sidebar) observe sizes and
// visibility and query media features.

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

globalThis.ResizeObserver ??= ObserverStub as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??=
  ObserverStub as unknown as typeof IntersectionObserver;

// jsdom has no layout, so no scrolling either.
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
