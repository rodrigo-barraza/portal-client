import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLogStream } from "../useLogStream";

vi.mock("@/services/ApiService", () => ({
  default: {
    buildLogStreamUrl: (container: string, { device }: { device?: string }) =>
      `http://portal/logs/${container}?device=${device}`,
  },
}));

type Listener = (event: MessageEvent) => void;

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances: MockEventSource[] = [];

  readyState = MockEventSource.CONNECTING;
  onmessage: Listener | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, Set<Listener>>();

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  emit(type: string, data?: string) {
    const event = new MessageEvent(type, { data });
    this.listeners.get(type)?.forEach((listener) => listener(event));
    if (type === "message") this.onmessage?.(event);
  }

  frame(line: string) {
    this.emit("message", JSON.stringify({ line, stream: "stdout" }));
  }
}

const latest = () =>
  MockEventSource.instances[MockEventSource.instances.length - 1];

async function flushFrames() {
  await act(async () => {
    await new Promise((resolve) =>
      requestAnimationFrame(() => resolve(undefined)),
    );
  });
}

beforeEach(() => {
  MockEventSource.instances = [];
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useLogStream", () => {
  it("renders the line inside portal-service's JSON frames", async () => {
    const { result } = renderHook(() => useLogStream());
    act(() => result.current.connect({ container: "api", device: "synology" }));
    expect(latest().url).toBe("http://portal/logs/api?device=synology");

    act(() => latest().emit("connected", "{}"));
    act(() => latest().frame("2026-09-22T10:00:00.1Z INFO ready"));
    await flushFrames();

    expect(result.current.connected).toBe(true);
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0]).toMatchObject({
      id: 1,
      timestamp: "10:00:00.100",
      content: "INFO ready",
      level: "info",
    });
  });

  it("does not duplicate the replayed tail after an automatic reconnect", async () => {
    const { result } = renderHook(() => useLogStream());
    act(() => result.current.connect({ container: "api", device: "synology" }));
    const source = latest();
    act(() => {
      source.emit("connected", "{}");
      source.frame("2026-09-22T10:00:01Z one");
      source.frame("2026-09-22T10:00:02Z two");
    });
    await flushFrames();

    // EventSource reconnects by itself; the server replays its tail.
    act(() => {
      source.emit("connected", "{}");
      source.frame("2026-09-22T10:00:01Z one");
      source.frame("2026-09-22T10:00:02Z two");
      source.frame("2026-09-22T10:00:03Z three");
    });
    await flushFrames();

    expect(result.current.lines.map((line) => line.content)).toEqual([
      "one",
      "two",
      "three",
    ]);
    expect(result.current.lines.map((line) => line.id)).toEqual([1, 2, 3]);
  });

  it("closes for good on a server-sent error instead of reconnecting in a loop", () => {
    const { result } = renderHook(() => useLogStream());
    act(() => result.current.connect({ container: "api", device: "synology" }));
    act(() =>
      latest().emit(
        "error",
        JSON.stringify({ error: "No Docker API configured" }),
      ),
    );
    expect(latest().readyState).toBe(MockEventSource.CLOSED);
    expect(result.current.error).toBe("No Docker API configured");
  });

  it("marks the stream ended on `end`", () => {
    const { result } = renderHook(() => useLogStream());
    act(() => result.current.connect({ container: "api", device: "synology" }));
    act(() => latest().emit("end", '{"code":0}'));
    expect(latest().readyState).toBe(MockEventSource.CLOSED);
    expect(result.current.ended).toBe(true);
    expect(result.current.connected).toBe(false);
  });

  it("buffers while paused and appends on resume", async () => {
    const { result } = renderHook(() => useLogStream());
    act(() => result.current.connect({ container: "api", device: "synology" }));
    act(() => result.current.pause());
    act(() => {
      latest().frame("2026-09-22T10:00:01Z a");
      latest().frame("2026-09-22T10:00:02Z b");
    });
    await flushFrames();
    expect(result.current.lines).toHaveLength(0);
    expect(result.current.bufferedCount).toBe(2);

    act(() => result.current.resume());
    expect(result.current.lines.map((line) => line.content)).toEqual([
      "a",
      "b",
    ]);
    expect(result.current.bufferedCount).toBe(0);
  });

  it("closes the previous stream when switching containers and on unmount", () => {
    const { result, unmount } = renderHook(() => useLogStream());
    act(() => result.current.connect({ container: "a", device: "synology" }));
    const first = latest();
    act(() => result.current.connect({ container: "b", device: "synology" }));
    expect(first.readyState).toBe(MockEventSource.CLOSED);
    const second = latest();
    unmount();
    expect(second.readyState).toBe(MockEventSource.CLOSED);
  });
});
