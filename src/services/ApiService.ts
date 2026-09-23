/**
 * ApiService — HTTP client for portal-service.
 * Follows the same static-method pattern as Prism Client's PrismService.
 *
 * Every request method takes a trailing `{ signal }` so callers can abort
 * on unmount, and fails with an `ApiError` (from utilities-library) whose
 * `status` is the HTTP status — 0 when portal-service was unreachable —
 * and whose `message` is the service's own error text. Aborts reject with
 * the platform's AbortError unchanged.
 */

import { PORTAL_SERVICE_URL } from "@/config";
import type { BucketStreamEvent } from "@/types/portal";
import {
  createJsonRequester,
  objectPath,
  pathSegment,
  queryString,
  type HttpMethod,
  type RequestOptions,
} from "./apiRequest";

export { ApiError, NETWORK_ERROR_STATUS } from "./apiRequest";
export type { RequestOptions } from "./apiRequest";

/**
 * Response payloads are not typed per endpoint yet — callers narrow the
 * shape they consume. (Typing them changes every method's signature, which
 * the consuming components have to adopt together.)
 */
type ApiResponse = any;

const request = createJsonRequester(PORTAL_SERVICE_URL);

function get(path: string, options?: RequestOptions): Promise<ApiResponse> {
  return request<ApiResponse>("GET", path, options);
}

function send(
  method: Exclude<HttpMethod, "GET">,
  path: string,
  options?: RequestOptions,
): Promise<ApiResponse> {
  return request<ApiResponse>(method, path, options);
}

type SessionSort = "createdAt" | "updatedAt" | "duration" | (string & {});

export default class ApiService {
  // ── Projects ──────────────────────────────────────────────────

  /** Health status of every registered service and infrastructure entry. */
  static getServices(refresh = false, options?: RequestOptions) {
    return get(`/services${queryString({ refresh: refresh || undefined })}`, options);
  }

  // Start / stop / restart a registered, containerized service by project
  // id — the Projects page's card actions (they have no device id to use
  // the container-direct routes below).

  static startService(serviceId: string, options?: RequestOptions) {
    return ApiService.serviceAction("start", serviceId, options);
  }

  static stopService(serviceId: string, options?: RequestOptions) {
    return ApiService.serviceAction("stop", serviceId, options);
  }

  static restartService(serviceId: string, options?: RequestOptions) {
    return ApiService.serviceAction("restart", serviceId, options);
  }

  private static serviceAction(
    action: "restart" | "stop" | "start",
    serviceId: string,
    options?: RequestOptions,
  ) {
    return send("POST", `/services/${pathSegment(serviceId)}/${action}`, options);
  }

  /** Roll a containerized service back to its previous image. */
  static rollbackService(serviceId: string, options?: RequestOptions) {
    return send("POST", `/services/${pathSegment(serviceId)}/rollback`, options);
  }

  /** Whether a previous image exists to roll a service back to. */
  static getRollbackStatus(serviceId: string, options?: RequestOptions) {
    return get(`/services/${pathSegment(serviceId)}/rollback-status`, options);
  }

  /** GitHub repository sizes of every project. */
  static getProjectSizes(options?: RequestOptions) {
    return get("/services/sizes", options);
  }

  /** Auto-detected ecosystem dependencies (imports, API calls, repo sizes). */
  static getProjectAnalysis(refresh = false, options?: RequestOptions) {
    return get(
      `/services/analysis${queryString({ refresh: refresh || undefined })}`,
      options,
    );
  }

  /** GitHub Linguist language breakdown of every project. */
  static getProjectLanguages(options?: RequestOptions) {
    return get("/services/languages", options);
  }

  // ── Container-Direct Actions ─────────────────────────────────
  // By Docker container name + device ID, bypassing the project registry —
  // control of any Docker container.

  static restartContainer(
    containerName: string,
    device: string,
    options?: RequestOptions,
  ) {
    return ApiService.containerAction("restart", containerName, device, options);
  }

  static stopContainer(
    containerName: string,
    device: string,
    options?: RequestOptions,
  ) {
    return ApiService.containerAction("stop", containerName, device, options);
  }

  static startContainer(
    containerName: string,
    device: string,
    options?: RequestOptions,
  ) {
    return ApiService.containerAction("start", containerName, device, options);
  }

  private static containerAction(
    action: "restart" | "stop" | "start",
    containerName: string,
    device: string,
    options?: RequestOptions,
  ) {
    return send(
      "POST",
      `/containers/${pathSegment(containerName)}/${action}${queryString({ device })}`,
      options,
    );
  }

  /** Screenshot of a site, for container/property cards (an <img> src). */
  static buildContainerPreviewUrl(domain: string) {
    return `${PORTAL_SERVICE_URL}/containers/previews/${pathSegment(domain)}`;
  }

  // ── Stats ─────────────────────────────────────────────────────

  /** Docker container resource usage (CPU, memory, network). */
  static getContainerStats(deviceId?: string, options?: RequestOptions) {
    return get(`/stats/containers${queryString({ device: deviceId })}`, options);
  }

  /** In-memory time series of container stats, keyed by device ID. */
  static getContainerStatsHistory(deviceId?: string, options?: RequestOptions) {
    return get(
      `/stats/containers/history${queryString({ device: deviceId })}`,
      options,
    );
  }

  /** Persisted container metrics (MongoDB time series) over a range. */
  static getContainerMetrics(
    {
      range = "1h",
      container,
      device,
      limit,
    }: {
      range?: string;
      container?: string;
      device?: string;
      limit?: number;
    } = {},
    options?: RequestOptions,
  ) {
    return get(
      `/stats/containers/metrics${queryString({ range, container, device, limit })}`,
      options,
    );
  }

  /**
   * Docker system info — disk usage breakdown (images, volumes, build
   * cache). Without a device, an array with one entry per device.
   */
  static getSystemInfo(deviceId?: string, options?: RequestOptions) {
    return get(`/stats/system${queryString({ device: deviceId })}`, options);
  }

  /**
   * Drop portal-service's cached container stats so the next read reflects
   * a start/stop/restart immediately instead of up to 10 s later.
   */
  static invalidateStats(options?: RequestOptions) {
    return send("POST", "/stats/invalidate", options);
  }

  /** MinIO storage summary — bucket counts and total sizes. */
  static getStorageSummary(options?: RequestOptions) {
    return get("/stats/storage", options);
  }

  // ── Integrations ─────────────────────────────────────────────

  /** External API integrations and whether each is configured. */
  static getIntegrations(options?: RequestOptions) {
    return get("/integrations", options);
  }

  // ── Logs ─────────────────────────────────────────────────────

  /** Every Docker container available for log streaming. */
  static getLoggableContainers(options?: RequestOptions) {
    return get("/logs", options);
  }

  /** SSE URL for streaming a container's logs (`new EventSource(url)`). */
  static buildLogStreamUrl(
    containerName: string,
    {
      tail = 200,
      follow = true,
      device,
    }: { tail?: number; follow?: boolean; device?: string } = {},
  ) {
    return `${PORTAL_SERVICE_URL}/logs/${pathSegment(containerName)}${queryString(
      { tail, follow: follow ? "1" : "0", device },
    )}`;
  }

  // ── Devices ──────────────────────────────────────────────────

  /** Physical devices with their hosted services and live specs. */
  static getDevices(options?: RequestOptions) {
    return get("/devices", options);
  }

  // ── Object Store ────────────────────────────────────────────

  /**
   * Stream bucket data via SSE for progressive loading. Calls onEvent for:
   *   { type: "init", totalBuckets, buckets }  (names up front, stats null)
   *   { type: "bucket", bucket }               (one bucket's stats)
   *   { type: "done" }
   *   { type: "error", message }               (stream over)
   */
  static streamStorageBuckets(onEvent: (event: BucketStreamEvent) => void) {
    const eventSource = new EventSource(
      `${PORTAL_SERVICE_URL}/object-store/buckets/stream`,
    );
    let finished = false;
    const finish = (event: BucketStreamEvent) => {
      if (finished) return;
      finished = true;
      eventSource.close();
      onEvent(event);
    };
    const parse = <T,>(event: Event): T | null => {
      try {
        return JSON.parse((event as MessageEvent<string>).data) as T;
      } catch {
        finish({ type: "error", message: "Malformed bucket stream event" });
        return null;
      }
    };

    eventSource.addEventListener("init", (event) => {
      const data = parse<Omit<BucketStreamEvent, "type">>(event);
      if (data) onEvent({ ...data, type: "init" });
    });
    eventSource.addEventListener("bucket", (event) => {
      const bucket = parse<BucketStreamEvent["bucket"]>(event);
      if (bucket) onEvent({ type: "bucket", bucket });
    });
    eventSource.addEventListener("done", () => finish({ type: "done" }));
    eventSource.addEventListener("error", (event) => {
      // Fired both for a server-sent `event: error` (has data) and for a
      // connection failure (no data). Either way the stream is over —
      // always notify so the UI doesn't hang in its loading state.
      let message = "Connection to bucket stream lost";
      const data = (event as MessageEvent<string>).data;
      if (data) {
        try {
          message = JSON.parse(data).message || message;
        } catch {
          // keep the generic message
        }
      }
      finish({ type: "error", message });
    });

    return { close: () => eventSource.close() };
  }

  /** Objects and prefixes ("folders") in a bucket. */
  static getStorageObjects(
    bucketName: string,
    {
      prefix = "",
      recursive = false,
    }: { prefix?: string; recursive?: boolean } = {},
    options?: RequestOptions,
  ) {
    return get(
      `/object-store/buckets/${pathSegment(bucketName)}${queryString({
        prefix,
        recursive: recursive || undefined,
      })}`,
      options,
    );
  }

  /** Metadata of a single object. */
  static statStorageObject(
    bucketName: string,
    objectName: string,
    options?: RequestOptions,
  ) {
    return get(
      `/object-store/buckets/${pathSegment(bucketName)}/stat/${objectPath(objectName)}`,
      options,
    );
  }

  /** Download URL of an object; `inline` asks the browser to display it. */
  static buildStorageDownloadUrl(
    bucketName: string,
    objectName: string,
    { inline = false }: { inline?: boolean } = {},
  ) {
    return `${PORTAL_SERVICE_URL}/object-store/buckets/${pathSegment(bucketName)}/download/${objectPath(objectName)}${queryString(
      { inline: inline || undefined },
    )}`;
  }

  static deleteStorageObject(
    bucketName: string,
    objectName: string,
    options?: RequestOptions,
  ) {
    return send(
      "DELETE",
      `/object-store/buckets/${pathSegment(bucketName)}/${objectPath(objectName)}`,
      options,
    );
  }

  /** Search object names across buckets (or within one). */
  static searchStorageObjects(
    query: string,
    { bucket, limit }: { bucket?: string; limit?: number } = {},
    options?: RequestOptions,
  ) {
    return get(
      `/object-store/search${queryString({ query, bucket, limit })}`,
      options,
    );
  }

  // ── Google Analytics ────────────────────────────────────────
  // `period`: "7d" | "30d" | "90d" | "YYYY-MM-DD_YYYY-MM-DD".

  /** Configured GA4 properties. */
  static getGAProperties(options?: RequestOptions) {
    return get("/google-analytics/properties", options);
  }

  /** Realtime active users of a GA4 property. */
  static getGARealtime(propertyId: string, options?: RequestOptions) {
    return get(`/google-analytics/${pathSegment(propertyId)}/realtime`, options);
  }

  static getGAOverview(propertyId: string, period = "30d", options?: RequestOptions) {
    return ApiService.gaReport(propertyId, "overview", period, options);
  }

  static getGAPages(propertyId: string, period = "30d", options?: RequestOptions) {
    return ApiService.gaReport(propertyId, "pages", period, options);
  }

  static getGASources(propertyId: string, period = "30d", options?: RequestOptions) {
    return ApiService.gaReport(propertyId, "sources", period, options);
  }

  static getGAGeography(propertyId: string, period = "30d", options?: RequestOptions) {
    return ApiService.gaReport(propertyId, "geography", period, options);
  }

  /** Device category, browser, OS and screen breakdown. */
  static getGADevices(propertyId: string, period = "30d", options?: RequestOptions) {
    return ApiService.gaReport(propertyId, "devices", period, options);
  }

  /** Daily pageviews, users and sessions. */
  static getGATimeSeries(propertyId: string, period = "30d", options?: RequestOptions) {
    return ApiService.gaReport(propertyId, "timeseries", period, options);
  }

  /** Channel grouping breakdown (Organic Search, Direct, Referral, …). */
  static getGAChannels(propertyId: string, period = "30d", options?: RequestOptions) {
    return ApiService.gaReport(propertyId, "channels", period, options);
  }

  /** Landing page performance (entry points). */
  static getGALandingPages(propertyId: string, period = "30d", options?: RequestOptions) {
    return ApiService.gaReport(propertyId, "landing-pages", period, options);
  }

  /** Day × hour traffic matrix. */
  static getGAHeatmap(propertyId: string, period = "30d", options?: RequestOptions) {
    return ApiService.gaReport(propertyId, "heatmap", period, options);
  }

  static getGANewVsReturning(
    propertyId: string,
    period = "30d",
    options?: RequestOptions,
  ) {
    return ApiService.gaReport(propertyId, "new-vs-returning", period, options);
  }

  static getGAEvents(propertyId: string, period = "30d", options?: RequestOptions) {
    return ApiService.gaReport(propertyId, "events", period, options);
  }

  private static gaReport(
    propertyId: string,
    report: string,
    period: string,
    options?: RequestOptions,
  ) {
    return get(
      `/google-analytics/${pathSegment(propertyId)}/${report}${queryString({ period })}`,
      options,
    );
  }

  // ── Session Analytics (first-party, proxied sessions-service) ──
  // Success bodies come back in sessions-service's `{ success, data }`
  // envelope.

  /** Distinct projects tracked by sessions-service. */
  static getSessionProjects(period = "30d", options?: RequestOptions) {
    return ApiService.sessionStats("projects", { period }, options);
  }

  static getSessionOverview(projectId: string, period = "30d", options?: RequestOptions) {
    return ApiService.sessionStats("overview", { projectId, period }, options);
  }

  /** Paginated session list with full detail (IP, geo, device). */
  static getSessionsList(
    projectId: string,
    period = "30d",
    limit = 50,
    offset = 0,
    sort: SessionSort = "createdAt",
    order: "asc" | "desc" = "desc",
    options?: RequestOptions,
  ) {
    return ApiService.sessionStats(
      "sessions",
      { projectId, period, limit, offset, sort, order },
      options,
    );
  }

  /** Top pages by view count. */
  static getSessionPages(projectId: string, period = "30d", options?: RequestOptions) {
    return ApiService.sessionStats("pages", { projectId, period }, options);
  }

  static getSessionReferrers(projectId: string, period = "30d", options?: RequestOptions) {
    return ApiService.sessionStats("referrers", { projectId, period }, options);
  }

  static getSessionGeo(projectId: string, period = "30d", options?: RequestOptions) {
    return ApiService.sessionStats("geo", { projectId, period }, options);
  }

  /** Device/browser/OS breakdown. */
  static getSessionDevices(projectId: string, period = "30d", options?: RequestOptions) {
    return ApiService.sessionStats("devices", { projectId, period }, options);
  }

  static getSessionTimeSeries(projectId: string, period = "30d", options?: RequestOptions) {
    return ApiService.sessionStats("timeseries", { projectId, period }, options);
  }

  /** Sessions active within the last `minutes`. */
  static getSessionLive(projectId: string, minutes = 5, options?: RequestOptions) {
    return ApiService.sessionStats("live", { projectId, minutes }, options);
  }

  /** Top events by category/action. */
  static getSessionEvents(projectId: string, period = "30d", options?: RequestOptions) {
    return ApiService.sessionStats("events", { projectId, period }, options);
  }

  /** One session with its page views, events and timeline. */
  static getSessionDetail(sessionId: string, options?: RequestOptions) {
    return get(`/session-analytics/session/${pathSegment(sessionId)}`, options);
  }

  /** The ordered rrweb event stream of a session's replay. */
  static getSessionReplay(sessionId: string, options?: RequestOptions) {
    return get(
      `/session-analytics/session/${pathSegment(sessionId)}/replay`,
      options,
    );
  }

  /**
   * Normalized cursor/click/scroll density grid for one page path. Pass a
   * viewport band (mobile/tablet/desktop) so a phone and a desktop layout
   * aren't averaged into the same grid.
   */
  static getSessionHeatmap(
    projectId: string,
    path: string,
    period = "30d",
    type: "move" | "click" | "scroll" = "move",
    band?: "mobile" | "tablet" | "desktop",
    grid = 50,
    options?: RequestOptions,
  ) {
    return ApiService.sessionStats(
      "heatmap",
      { projectId, path, period, type, band, grid },
      options,
    );
  }

  /** Distinct visitors with session counts and device metadata. */
  static getSessionVisitors(
    projectId: string,
    period = "30d",
    limit = 50,
    offset = 0,
    options?: RequestOptions,
  ) {
    return ApiService.sessionStats(
      "visitors",
      { projectId, period, limit, offset },
      options,
    );
  }

  /** IP-based pseudo-users with session/visitor aggregation. */
  static getSessionIpUsers(
    projectId: string,
    period = "30d",
    limit = 50,
    offset = 0,
    options?: RequestOptions,
  ) {
    return ApiService.sessionStats("ips", { projectId, period, limit, offset }, options);
  }

  /** One IP — all its sessions and a cross-session timeline. */
  static getSessionIpDetail(
    ip: string,
    projectId?: string,
    period = "all",
    options?: RequestOptions,
  ) {
    return get(
      `/session-analytics/ip/${pathSegment(ip)}${queryString({ period, projectId })}`,
      options,
    );
  }

  private static sessionStats(
    report: string,
    params: Record<string, string | number | undefined>,
    options?: RequestOptions,
  ) {
    return get(`/session-analytics/${report}${queryString(params)}`, options);
  }

  // ── External APIs (Google Cloud Monitoring + providers) ───────

  /** Usage summary of every external API with traffic. */
  static getExternalApiUsageSummary(period = "30d", options?: RequestOptions) {
    return get(`/external-apis${queryString({ period })}`, options);
  }

  /** Daily time series of one external API service. */
  static getExternalApiUsageTimeSeries(
    serviceIdentifier: string,
    period = "30d",
    options?: RequestOptions,
  ) {
    return get(
      `/external-apis/timeseries${queryString({ service: serviceIdentifier, period })}`,
      options,
    );
  }
}
