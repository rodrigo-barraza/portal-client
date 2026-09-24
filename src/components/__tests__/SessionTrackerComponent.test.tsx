import { act, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetSettings, updateSettings } from "@/lib/settings";

const mounts = vi.hoisted(() => [] as string[]);

vi.mock("@rodrigo-barraza/components-library", () => ({
  SessionTrackerComponent: ({ projectId }: { projectId: string }) => {
    // The real loader records the page from an effect, so a mount = a visit.
    useEffect(() => {
      mounts.push(projectId);
    }, [projectId]);
    return null;
  },
}));
vi.mock("@/providers/AuthProvider", () => ({ useAuthEnabled: () => false }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }));

const { default: SessionTrackerComponent } =
  await import("../SessionTrackerComponent");

let unmount: (() => void) | null = null;

/** Server-render, then hydrate — the path a real page load takes. */
async function hydrate() {
  const container = document.createElement("div");
  container.innerHTML = renderToString(<SessionTrackerComponent />);
  document.body.append(container);
  await act(async () => {
    const root = hydrateRoot(container, <SessionTrackerComponent />);
    unmount = () => {
      root.unmount();
      container.remove();
    };
  });
}

afterEach(() => {
  act(() => unmount?.());
  unmount = null;
  mounts.length = 0;
  resetSettings(); // the settings store caches its snapshot per module
});

describe("SessionTrackerComponent", () => {
  it("never mounts the tracker for a visitor who turned telemetry off", async () => {
    updateSettings({ telemetryEnabled: false });
    await hydrate();
    expect(mounts).toEqual([]);
  });

  it("mounts it once hydrated when telemetry is on", async () => {
    await hydrate();
    expect(mounts).toEqual(["portal"]);
  });
});
