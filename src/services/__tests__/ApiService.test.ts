import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// A fixed base URL — the real one comes from the build environment.
vi.mock("@/config", () => ({ PORTAL_SERVICE_URL: "http://portal.test" }));

const { default: ApiService } = await import("@/services/ApiService");

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    async () =>
      new Response("{}", { headers: { "content-type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function requestedUrl(): string {
  return fetchMock.mock.calls[0][0] as string;
}

function requestedInit(): RequestInit {
  return fetchMock.mock.calls[0][1] as RequestInit;
}

describe("ApiService request building", () => {
  it("encodes path segments and query values", async () => {
    await ApiService.getStorageObjects("my bucket", { prefix: "a/b c/" });
    expect(requestedUrl()).toBe(
      "http://portal.test/object-store/buckets/my%20bucket?prefix=a%2Fb+c%2F",
    );
  });

  it("addresses container actions by name and device", async () => {
    await ApiService.stopContainer("prism-service", "nas 2");
    expect(requestedUrl()).toBe(
      "http://portal.test/containers/prism-service/stop?device=nas+2",
    );
    expect(requestedInit().method).toBe("POST");
  });

  it("sends session report params URL-encoded", async () => {
    await ApiService.getSessionPages("rod&dev", "7d");
    expect(requestedUrl()).toBe(
      "http://portal.test/session-analytics/pages?projectId=rod%26dev&period=7d",
    );
  });

  it("builds heatmap queries with the optional band", async () => {
    await ApiService.getSessionHeatmap("p", "/a b", "30d", "click", "mobile");
    expect(requestedUrl()).toBe(
      "http://portal.test/session-analytics/heatmap?projectId=p&path=%2Fa+b&period=30d&type=click&band=mobile&grid=50",
    );
  });

  it("only asks for a refresh when requested", async () => {
    await ApiService.getServices();
    await ApiService.getServices(true);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://portal.test/services",
      "http://portal.test/services?refresh=true",
    ]);
  });

  it("forwards an abort signal", async () => {
    const controller = new AbortController();
    await ApiService.getGAPages("123", "30d", { signal: controller.signal });
    expect(requestedUrl()).toBe(
      "http://portal.test/google-analytics/123/pages?period=30d",
    );
    expect(requestedInit().signal).toBe(controller.signal);
  });

  it("builds stream and download URLs", () => {
    expect(
      ApiService.buildLogStreamUrl("web/1", { tail: 50, device: "nas" }),
    ).toBe("http://portal.test/logs/web%2F1?tail=50&follow=1&device=nas");
    expect(
      ApiService.buildStorageDownloadUrl("b", "dir/f #1.png", { inline: true }),
    ).toBe("http://portal.test/object-store/buckets/b/download/dir/f%20%231.png?inline=true");
    expect(ApiService.buildContainerPreviewUrl("rod.dev")).toBe(
      "http://portal.test/containers/previews/rod.dev",
    );
  });
});

describe("ApiService.streamStorageBuckets", () => {
  class FakeEventSource {
    static last: FakeEventSource;
    listeners = new Map<string, (event: Event) => void>();
    closed = false;
    constructor(public url: string) {
      FakeEventSource.last = this;
    }
    addEventListener(type: string, listener: (event: Event) => void) {
      this.listeners.set(type, listener);
    }
    close() {
      this.closed = true;
    }
    emit(type: string, data?: string) {
      this.listeners.get(type)?.(new MessageEvent(type, { data }));
    }
  }

  beforeEach(() => {
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  it("forwards init/bucket events and closes on done", () => {
    const onEvent = vi.fn();
    ApiService.streamStorageBuckets(onEvent);
    const source = FakeEventSource.last;

    source.emit("init", JSON.stringify({ totalBuckets: 1, buckets: [] }));
    source.emit("bucket", JSON.stringify({ name: "a", objectCount: 1, totalSize: 2 }));
    source.emit("done");

    expect(source.url).toBe("http://portal.test/object-store/buckets/stream");
    expect(onEvent.mock.calls.map(([event]) => event)).toEqual([
      { type: "init", totalBuckets: 1, buckets: [] },
      { type: "bucket", bucket: { name: "a", objectCount: 1, totalSize: 2 } },
      { type: "done" },
    ]);
    expect(source.closed).toBe(true);
  });

  it("ends the stream on a malformed event instead of throwing", () => {
    const onEvent = vi.fn();
    ApiService.streamStorageBuckets(onEvent);
    FakeEventSource.last.emit("bucket", "{not json");

    expect(onEvent).toHaveBeenCalledWith({
      type: "error",
      message: "Malformed bucket stream event",
    });
    expect(FakeEventSource.last.closed).toBe(true);
  });

  it("reports a server error once", () => {
    const onEvent = vi.fn();
    ApiService.streamStorageBuckets(onEvent);
    FakeEventSource.last.emit("error", JSON.stringify({ message: "Failed to list buckets" }));
    FakeEventSource.last.emit("error");

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      type: "error",
      message: "Failed to list buckets",
    });
  });
});
