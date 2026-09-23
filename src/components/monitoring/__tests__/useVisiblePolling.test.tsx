import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVisiblePolling, type IsCurrent } from "../useVisiblePolling";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
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

  it("aborts the requests of superseded runs and on unmount", async () => {
    const signals: AbortSignal[] = [];
    const task = vi.fn(
      (_isCurrent: IsCurrent, signal: AbortSignal) =>
        new Promise<void>(() => {
          signals.push(signal);
        }),
    );
    const { result, unmount } = renderHook(() =>
      useVisiblePolling(task, 60_000),
    );
    await act(async () => {});
    await act(async () => {
      void result.current();
    });
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    unmount();
    expect(signals[1].aborted).toBe(true);
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

  it("does not refetch on a tab flip shorter than the interval", async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useVisiblePolling(task, 10_000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    act(() => setVisibility("hidden"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    act(() => setVisibility("visible"));
    await act(async () => {});
    expect(task).toHaveBeenCalledTimes(1);

    // The timer resumes where it left off: the tick lands at 10s, not 15s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999);
    });
    expect(task).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("loads once even when mounted in a hidden tab, then waits for it to show", async () => {
    setVisibility("hidden");
    const task = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useVisiblePolling(task, 1000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(task).toHaveBeenCalledTimes(1);
    act(() => setVisibility("visible"));
    await act(async () => {});
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("with no interval runs once per restart key and on refresh, never on a timer", async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ target }) => useVisiblePolling(task, null, { restartKey: target }),
      { initialProps: { target: "a" } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    await act(async () => {});
    expect(task).toHaveBeenCalledTimes(1);

    rerender({ target: "b" });
    await act(async () => {});
    expect(task).toHaveBeenCalledTimes(2);
    await act(async () => {
      await result.current();
    });
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("refresh() resolves once its run has settled", async () => {
    let resolveRun: () => void = () => {};
    const task = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRun = resolve;
        }),
    );
    const { result } = renderHook(() => useVisiblePolling(task, 60_000));
    await act(async () => {});
    let settled = false;
    await act(async () => {
      void result.current().then(() => {
        settled = true;
      });
    });
    expect(settled).toBe(false);
    await act(async () => {
      resolveRun();
    });
    expect(settled).toBe(true);
  });

  it("disabling supersedes the run in flight and a later run is not blocked by it", async () => {
    const signals: AbortSignal[] = [];
    const currents: IsCurrent[] = [];
    const task = vi.fn(
      (isCurrent: IsCurrent, signal: AbortSignal) =>
        new Promise<void>(() => {
          currents.push(isCurrent);
          signals.push(signal);
        }),
    );
    const { rerender } = renderHook(
      ({ enabled }) => useVisiblePolling(task, 1000, { enabled }),
      {
        initialProps: { enabled: true },
      },
    );
    await act(async () => {});
    rerender({ enabled: false });
    expect(signals[0].aborted).toBe(true);
    expect(currents[0]()).toBe(false);

    rerender({ enabled: true });
    await act(async () => {});
    expect(task).toHaveBeenCalledTimes(2);
    expect(signals[1].aborted).toBe(false);
  });
});
