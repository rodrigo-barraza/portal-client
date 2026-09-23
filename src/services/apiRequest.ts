/**
 * Request plumbing for ApiService: one JSON request helper over
 * utilities-library's HTTP client, with error mapping that matches what
 * portal-service (and the sessions-service bodies it proxies) sends.
 */

import {
  ApiError,
  createApiClient,
  type ApiClient,
} from "@rodrigo-barraza/utilities-library";

export { ApiError };

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Per-call options every ApiService request accepts. */
export interface RequestOptions {
  /** Abort the request — pass one from an effect's cleanup so an unmounted
   *  component never receives (or waits on) a stale response. */
  signal?: AbortSignal;
}

/** Status of an {@link ApiError} for a request that never got a response. */
export const NETWORK_ERROR_STATUS = 0;

/**
 * The message to show for a failed response. portal-service sends
 * `{ error: "<message>" }`; proxied sessions-service bodies may still carry
 * `{ error: true, message }` — read whichever holds text, never "true".
 * Non-JSON bodies (a proxy's HTML error page) are not echoed.
 */
export function apiErrorMessage(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null) {
    const { error, message } = body as { error?: unknown; message?: unknown };
    if (typeof error === "string" && error.trim()) return error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return `Request failed with status ${status}`;
}

/** Aborts and timeouts must reach callers untouched — they check the name. */
function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

/**
 * Parse a portal-service response: JSON body on success, {@link ApiError}
 * (with status and body) otherwise. A successful response that is not JSON
 * means the base URL points somewhere else (typically the Next.js app
 * itself, when PORTAL_SERVICE_URL is unset) — that is an error too, rather
 * than an HTML string every caller would treat as empty data.
 */
export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown;
  let isJson = true;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
      isJson = false;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      apiErrorMessage(body, response.status),
      response.status,
      body,
    );
  }
  if (!isJson) {
    throw new ApiError(
      `Expected JSON from portal-service but got "${response.headers.get("content-type") ?? "unknown"}" — is PORTAL_SERVICE_URL configured?`,
      response.status,
      body,
    );
  }
  return body as T;
}

/**
 * Build a JSON requester bound to `baseUrl`. Requests are never served from
 * the HTTP cache (the portal shows live state), GETs carry no body and thus
 * no Content-Type (no CORS preflight), and failures surface as
 * {@link ApiError}: HTTP errors with the server's message, unreachable
 * servers with status {@link NETWORK_ERROR_STATUS}.
 */
export function createJsonRequester(
  baseUrl: string,
  fetchImplementation?: typeof fetch,
) {
  const client: ApiClient = createApiClient(baseUrl, {
    // Resolve fetch per call, not once at module load, so a fetch installed
    // later (instrumentation, tests) is the one used.
    fetchImplementation:
      fetchImplementation ?? ((input, init) => globalThis.fetch(input, init)),
  });

  return async function request<T>(
    method: HttpMethod,
    path: string,
    { body, signal }: RequestOptions & { body?: unknown } = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await client.requestRaw(path, {
        method,
        cache: "no-store",
        signal,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      if (isAbortError(error)) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      throw new ApiError(
        `Could not reach portal-service (${reason})`,
        NETWORK_ERROR_STATUS,
        undefined,
      );
    }
    return readJsonResponse<T>(response);
  };
}

/** Encode one URL path segment (container, bucket, id…). */
export function pathSegment(value: string): string {
  return encodeURIComponent(value);
}

/** Encode an object key for a URL path, preserving its `/` separators. */
export function objectPath(objectName: string): string {
  return objectName.split("/").map(encodeURIComponent).join("/");
}

/** `?a=1&b=2` from the defined entries of `params` ("" when none). */
export function queryString(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
