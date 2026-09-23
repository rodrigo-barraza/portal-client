import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVisiblePolling, type IsCurrent } from "../useVisiblePolling";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useVisiblePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
    setVisibility("visible");
  });

  it("runs immediately and then on the interval", async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useVisiblePolling(task, 1000));
    await act(async () => {});
    expect(task).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(task).toHaveBeenCalledTimes(4);
  });

  it("stops while the tab is hidden and catches up when it returns", async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useVisiblePolling(task, 1000));
    await act(async () => {});
    act(() => setVisibility("hidden"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(task).toHaveBeenCalledTimes(1);
    act(() => setVisibility("visible"));
    await act(async () => {});
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("skips ticks while a run is still in flight", async () => {
    let resolveRun: () => void = () => {};
    const task = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRun = resolve;
        }),
    );
    renderHook(() => useVisiblePolling(task, 1000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(task).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveRun();
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("marks a superseded run stale so its response is dropped", async () => {
    const seen: IsCurrent[] = [];
    const resolvers: (() => void)[] = [];
    const task = vi.fn(
      (isCurrent: IsCurrent) =>
        new Promise<void>((resolve) => {
          seen.push(isCurrent);
          resolvers.push(resolve);
        }),
    );
    const { result } = renderHook(() => useVisiblePolling(task, 60_000));
    await act(async () => {});
    await act(async () => {
      void result.current();
    });
    expect(task).toHaveBeenCalledTimes(2);
    expect(seen[0]()).toBe(false);
    expect(seen[1]()).toBe(true);
    resolvers.forEach((resolve) => resolve());
  });

  it("reports runs as stale after unmount", async () => {
    let isCurrent: IsCurrent = () => true;
    const task = vi.fn(async (current: IsCurrent) => {
      isCurrent = current;
    });
    const { unmount } = renderHook(() => useVisiblePolling(task, 1000));
    await act(async () => {});
    expect(isCurrent()).toBe(true);
    unmount();
    expect(isCurrent()).toBe(false);
  });

  it("restarts with a fresh run when the restart key changes", async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ target }) => useVisiblePolling(task, 60_000, { restartKey: target }),
      { initialProps: { target: "a" } },
    );
    await act(async () => {});
    expect(task).toHaveBeenCalledTimes(1);
    rerender({ target: "b" });
    await act(async () => {});
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("does nothing while disabled", async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useVisiblePolling(task, 1000, { enabled: false }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(task).not.toHaveBeenCalled();
  });
});
