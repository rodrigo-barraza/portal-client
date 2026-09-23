import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import useAsyncData, { settleReports, unwrapData } from "../useAsyncData";

/** A promise whose settlement the test controls. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

afterEach(() => {
  vi.useRealTimers();
  setVisibility("visible");
});

describe("useAsyncData", () => {
  it("loads, then exposes the data", async () => {
    const { result } = renderHook(() => useAsyncData("a", () => Promise.resolve(42)));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe(42));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("drops a slow response for a key that is no longer current", async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();
    const loaders: Record<string, () => Promise<string>> = {
      old: () => slow.promise,
      new: () => fast.promise,
    };
    const { result, rerender } = renderHook(({ key }) => useAsyncData(key, loaders[key]), {
      initialProps: { key: "old" },
    });

    rerender({ key: "new" });
    await act(async () => fast.resolve("new data"));
    expect(result.current.data).toBe("new data");

    // The superseded request finally lands — it must not win
    await act(async () => slow.resolve("stale data"));
    expect(result.current.data).toBe("new data");
  });

  it("reports loading (not the old data) in the same render the key changes", async () => {
    const { result, rerender } = renderHook(
      ({ key }) => useAsyncData(key, () => Promise.resolve(`data:${key}`)),
      { initialProps: { key: "a" } },
    );
    await waitFor(() => expect(result.current.data).toBe("data:a"));

    rerender({ key: "b" });
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.data).toBe("data:b"));
  });

  it("can keep the previous data visible while the next key loads", async () => {
    const { result, rerender } = renderHook(
      ({ key }) =>
        useAsyncData(key, () => Promise.resolve(`data:${key}`), { keepPreviousData: true }),
      { initialProps: { key: "page-1" } },
    );
    await waitFor(() => expect(result.current.data).toBe("data:page-1"));

    rerender({ key: "page-2" });
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe("data:page-1");
  });

  it("surfaces errors", async () => {
    const { result } = renderHook(() => useAsyncData("a", () => Promise.reject(new Error("boom"))));
    await waitFor(() => expect(result.current.error?.message).toBe("boom"));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("does nothing for a null key", () => {
    const load = vi.fn(() => Promise.resolve(1));
    const { result } = renderHook(() => useAsyncData(null, load));
    expect(load).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("reload re-runs the loader for the current key", async () => {
    let calls = 0;
    const { result } = renderHook(() => useAsyncData("a", () => Promise.resolve(++calls)));
    await waitFor(() => expect(result.current.data).toBe(1));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.data).toBe(2);
  });

  it("reports reloading until the reload settles, keeping data on a failed reload", async () => {
    let calls = 0;
    const second = deferred<number>();
    const { result } = renderHook(() =>
      useAsyncData("a", () => (++calls === 1 ? Promise.resolve(1) : second.promise)),
    );
    await waitFor(() => expect(result.current.data).toBe(1));

    let reloaded!: Promise<void>;
    act(() => {
      reloaded = result.current.reload();
    });
    expect(result.current.reloading).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(1);

    await act(async () => {
      second.reject(new Error("blip"));
      await reloaded;
    });
    expect(result.current.reloading).toBe(false);
    expect(result.current.data).toBe(1);
    expect(result.current.error?.message).toBe("blip");
  });

  it("hands the loader an AbortSignal and aborts superseded and unmounted loads", async () => {
    const signals: Record<string, AbortSignal> = {};
    const { rerender, unmount } = renderHook(
      ({ key }) =>
        useAsyncData(key, (signal) => {
          signals[key] = signal;
          return new Promise<string>(() => {});
        }),
      { initialProps: { key: "old" } },
    );
    rerender({ key: "new" });
    expect(signals.old.aborted).toBe(true);
    expect(signals.new.aborted).toBe(false);
    unmount();
    expect(signals.new.aborted).toBe(true);
  });

  it("reload supersedes a load in flight", async () => {
    const first = deferred<string>();
    let calls = 0;
    const signals: AbortSignal[] = [];
    const { result } = renderHook(() =>
      useAsyncData("a", (signal) => {
        signals.push(signal);
        return ++calls === 1 ? first.promise : Promise.resolve("fresh");
      }),
    );
    await act(async () => {
      await result.current.reload();
    });
    expect(signals[0].aborted).toBe(true);
    expect(result.current.data).toBe("fresh");

    // The superseded answer lands late — it must not win
    await act(async () => first.resolve("stale"));
    expect(result.current.data).toBe("fresh");
  });

  it("never stacks a poll on a load that outlasts the interval", async () => {
    vi.useFakeTimers();
    const pending = deferred<number>();
    const load = vi.fn(() => pending.promise);
    renderHook(() => useAsyncData("live", load, { refreshIntervalMs: 1000 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve(1);
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("polls in the background, keeps data through a failed refresh, and skips hidden tabs", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const load = vi.fn(() => {
      calls += 1;
      return calls === 2 ? Promise.reject(new Error("blip")) : Promise.resolve(calls);
    });
    const { result } = renderHook(() => useAsyncData("live", load, { refreshIntervalMs: 1000 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data).toBe(1);

    // Second call fails — the last good value stays on screen
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.data).toBe(1);
    expect(result.current.loading).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.data).toBe(3);

    // Hidden tab: ticks are skipped…
    act(() => setVisibility("hidden"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(load).toHaveBeenCalledTimes(3);

    // …and a refresh fires as soon as it becomes visible again
    await act(async () => {
      setVisibility("visible");
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(load).toHaveBeenCalledTimes(4);
  });

  it("stops polling on unmount", async () => {
    vi.useFakeTimers();
    const load = vi.fn(() => Promise.resolve(1));
    const { unmount } = renderHook(() => useAsyncData("live", load, { refreshIntervalMs: 1000 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("settleReports", () => {
  it("keeps successful reports when others fail", async () => {
    const result = await settleReports<{ a: number; b: number }>({
      a: Promise.resolve(1),
      b: Promise.reject(new Error("b failed")),
    });
    expect(result.values).toEqual({ a: 1, b: null });
    expect(result.firstError?.message).toBe("b failed");
    expect(result.allFailed).toBe(false);
  });

  it("flags a total failure", async () => {
    const result = await settleReports<{ a: number }>({ a: Promise.reject(new Error("down")) });
    expect(result.allFailed).toBe(true);
  });
});

describe("unwrapData", () => {
  it("unwraps sessions-service envelopes and passes GA payloads through", () => {
    expect(unwrapData({ success: true, data: [1] })).toEqual([1]);
    expect(unwrapData({ properties: [] })).toEqual({ properties: [] });
    expect(unwrapData(null)).toBeNull();
  });
});
