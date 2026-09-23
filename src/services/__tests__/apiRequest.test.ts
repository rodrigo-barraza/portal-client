import { describe, it, expect, vi } from "vitest";
import {
  ApiError,
  apiErrorMessage,
  createJsonRequester,
  NETWORK_ERROR_STATUS,
  objectPath,
  queryString,
} from "@/services/apiRequest";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("apiErrorMessage", () => {
  it("reads portal-service's { error } envelope", () => {
    expect(apiErrorMessage({ error: "Unknown service: x" }, 404)).toBe(
      "Unknown service: x",
    );
  });

  it("never shows a boolean error flag — falls back to message", () => {
    expect(apiErrorMessage({ error: true, message: "Upstream down" }, 502)).toBe(
      "Upstream down",
    );
  });

  it("does not echo non-JSON bodies", () => {
    expect(apiErrorMessage("<html>Bad Gateway</html>", 502)).toBe(
      "Request failed with status 502",
    );
    expect(apiErrorMessage(undefined, 500)).toBe("Request failed with status 500");
  });
});

describe("createJsonRequester", () => {
  it("GETs JSON without a body or Content-Type (no CORS preflight)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ services: [] }));
    const request = createJsonRequester("http://api.test/", fetchMock);

    await expect(request("GET", "/services")).resolves.toEqual({ services: [] });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.test/services");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(init.cache).toBe("no-store");
    expect(new Headers(init.headers).has("content-type")).toBe(false);
  });

  it("sends a JSON body with Content-Type", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    const request = createJsonRequester("http://api.test", fetchMock);

    await request("POST", "/x", { body: { a: 1 } });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBe('{"a":1}');
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });

  it("passes the abort signal through and rethrows aborts unchanged", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      throw new DOMException("The operation was aborted.", "AbortError");
    });
    const request = createJsonRequester("http://api.test", fetchMock as typeof fetch);

    controller.abort();
    await expect(
      request("GET", "/x", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("maps HTTP errors to ApiError with status, message and body", async () => {
    const request = createJsonRequester(
      "http://api.test",
      vi.fn(async () => jsonResponse({ error: "Bucket not found" }, 404)),
    );

    const error = await request("GET", "/x").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      message: "Bucket not found",
      body: { error: "Bucket not found" },
    });
  });

  it("maps an HTML error page without a JSON parse crash", async () => {
    const request = createJsonRequester(
      "http://api.test",
      vi.fn(async () => new Response("<html>502</html>", { status: 502 })),
    );
    await expect(request("GET", "/x")).rejects.toMatchObject({
      status: 502,
      message: "Request failed with status 502",
    });
  });

  it("rejects a successful non-JSON response (wrong base URL)", async () => {
    const request = createJsonRequester(
      "",
      vi.fn(
        async () =>
          new Response("<!doctype html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
      ),
    );
    await expect(request("GET", "/services")).rejects.toThrow(
      /Expected JSON from portal-service/,
    );
  });

  it("maps an unreachable server to a network ApiError", async () => {
    const request = createJsonRequester(
      "http://api.test",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(request("GET", "/x")).rejects.toMatchObject({
      status: NETWORK_ERROR_STATUS,
      message: "Could not reach portal-service (Failed to fetch)",
    });
  });

  it("resolves an empty 2xx body to undefined", async () => {
    const request = createJsonRequester(
      "http://api.test",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    await expect(request("DELETE", "/x")).resolves.toBeUndefined();
  });
});

describe("URL helpers", () => {
  it("builds a query string from defined values only", () => {
    expect(queryString({ a: 1, b: undefined, c: "", d: null, e: "x y" })).toBe(
      "?a=1&e=x+y",
    );
    expect(queryString({ a: undefined })).toBe("");
  });

  it("encodes object keys segment by segment", () => {
    expect(objectPath("a dir/b#c.txt")).toBe("a%20dir/b%23c.txt");
  });
});
