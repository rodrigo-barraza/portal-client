import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// A fixed base URL — the real one comes from the build environment.
vi.mock("@/config", () => ({ PORTAL_SERVICE_URL: "http://portal.test" }));

const { default: ApiService, browserTimeZone } =
  await import("@/services/ApiService");

const fetchMock = vi.fn();
const realResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;

/** Make the browser report `timeZone` from Intl. */
function stubTimeZone(timeZone: string | undefined) {
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(
    function (this: Intl.DateTimeFormat) {
      return {
        ...realResolvedOptions.call(this),
        timeZone,
      } as Intl.ResolvedDateTimeFormatOptions;
    },
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    async () =>
      new Response("{}", { headers: { "content-type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  stubTimeZone("America/Vancouver");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
    ).toBe(
      "http://portal.test/object-store/buckets/b/download/dir/f%20%231.png?inline=true",
    );
    expect(ApiService.buildContainerPreviewUrl("rod.dev")).toBe(
      "http://portal.test/containers/previews/rod.dev",
    );
  });
});

describe("ApiService session analytics", () => {
  const TZ = "tz=America%2FVancouver";

  it("sends a preset range as a period with the browser's time zone", async () => {
    await ApiService.getSessionReport("rod&dev", { period: "7d" });
    expect(requestedUrl()).toBe(
      `http://portal.test/session-analytics/report?projectId=rod%26dev&period=7d&${TZ}`,
    );
  });

  it("sends a custom range as its two calendar days", async () => {
    await ApiService.getSessionReport("p", {
      from: "2026-09-01",
      to: "2026-09-10",
    });
    expect(requestedUrl()).toBe(
      `http://portal.test/session-analytics/report?projectId=p&from=2026-09-01&to=2026-09-10&${TZ}`,
    );
  });

  it("lists every project for a range in one call", async () => {
    await ApiService.getSessionProjects({ period: "30d" });
    expect(requestedUrl()).toBe(
      `http://portal.test/session-analytics/projects?period=30d&${TZ}`,
    );
  });

  it("asks for live sessions of one project, or of all of them", async () => {
    await ApiService.getSessionLive("p");
    await ApiService.getSessionLive();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://portal.test/session-analytics/live?projectId=p",
      "http://portal.test/session-analytics/live",
    ]);
  });

  it("sends list filters, paging and sort; on/off filters only when on", async () => {
    await ApiService.getSessionsList(
      "p",
      { period: "all" },
      {
        country: "CA",
        path: "/a b",
        visitorId: "v 1",
        replay: true,
        engaged: false,
      },
      { limit: 50, offset: 100 },
      { sort: "engagedMs", order: "asc" },
    );
    expect(requestedUrl()).toBe(
      `http://portal.test/session-analytics/sessions?projectId=p&period=all&${TZ}&limit=50&offset=100&visitorId=v+1&country=CA&path=%2Fa+b&replay=1&sort=engagedMs&order=asc`,
    );
  });

  it("defaults the list to the newest 50 sessions, unfiltered", async () => {
    await ApiService.getSessionsList("p", { period: "30d" });
    expect(requestedUrl()).toBe(
      `http://portal.test/session-analytics/sessions?projectId=p&period=30d&${TZ}&limit=50&offset=0&sort=startedAt&order=desc`,
    );
  });

  it("builds heatmap queries for a band and interaction type", async () => {
    await ApiService.getSessionHeatmap(
      "p",
      "/a b",
      { period: "30d" },
      "mobile",
      "move",
    );
    await ApiService.getSessionHeatmap("p", "/", { period: "7d" });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `http://portal.test/session-analytics/heatmap?projectId=p&path=%2Fa+b&period=30d&${TZ}&band=mobile&type=move`,
      `http://portal.test/session-analytics/heatmap?projectId=p&path=%2F&period=7d&${TZ}&band=desktop&type=click`,
    ]);
  });

  it("addresses a session and its replay by encoded id", async () => {
    await ApiService.getSessionDetail("a/b c");
    await ApiService.getSessionReplay("a/b c");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://portal.test/session-analytics/sessions/a%2Fb%20c",
      "http://portal.test/session-analytics/sessions/a%2Fb%20c/replay",
    ]);
  });

  it("falls back to UTC when the runtime has no time zone", () => {
    stubTimeZone(undefined);
    expect(browserTimeZone()).toBe("UTC");
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
    source.emit(
      "bucket",
      JSON.stringify({ name: "a", objectCount: 1, totalSize: 2 }),
    );
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
    FakeEventSource.last.emit(
      "error",
      JSON.stringify({ message: "Failed to list buckets" }),
    );
    FakeEventSource.last.emit("error");

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      type: "error",
      message: "Failed to list buckets",
    });
  });
});
