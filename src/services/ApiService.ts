/**
 * ApiService — HTTP client for portal-service.
 * Follows the same static-method pattern as Prism Client's PrismService.
 *
 * Every request method takes a trailing `{ signal }` so callers can abort
 * on unmount, and fails with an `ApiError` (from utilities-library) whose
 * `status` is the HTTP status — 0 when portal-service was unreachable —
 * and whose `message` is the service's own error text. Aborts reject with
 * the platform's AbortError unchanged.
 *
 * Every method resolves to the body portal-service sends for that route
 * (types in `@/types/portal`, matching the service's handlers); session
 * analytics come back in sessions-service's `{ success, data }` envelope.
 */

import { PORTAL_SERVICE_URL } from "@/config";
import type {
  BucketStreamEvent,
  ContainerActionResponse,
  ContainerMetricsResponse,
  ContainerStatsHistoryResponse,
  ContainerStatsResponse,
  DevicesResponse,
  ExternalApiTimeSeries,
  ExternalApiUsageData,
  GAPropertiesResponse,
  GARealtimeReport,
  GAReportsByName,
  IntegrationsData,
  LanguagesResponse,
  LoggableContainersResponse,
  ProjectAnalysis,
  RepoSizesResponse,
  ServiceActionResponse,
  ServiceRollbackStatus,
  ServicesResponse,
  SessionBand,
  SessionDetail,
  SessionFilters,
  SessionHeatmapType,
  SessionPaging,
  SessionRange,
  SessionReplay,
  SessionSort,
  SessionStatsByRoute,
  SessionsEnvelope,
  StorageBucket,
  StorageDeleteResponse,
  StorageObjectListing,
  StorageObjectStat,
  StorageSearchResponse,
  StorageSummary,
  SystemInfoResponse,
} from "@/types/portal";
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

const request = createJsonRequester(PORTAL_SERVICE_URL);

/** GET `path`; `Body` is what portal-service sends for that route. */
function get<Body>(path: string, options?: RequestOptions): Promise<Body> {
  return request<Body>("GET", path, options);
}

function send<Body>(
  method: Exclude<HttpMethod, "GET">,
  path: string,
  options?: RequestOptions,
): Promise<Body> {
  return request<Body>(method, path, options);
}

/** A GA4 period report's body, by report name. */
type GAReport<Report extends keyof GAReportsByName> = Promise<
  GAReportsByName[Report]
>;

/** A sessions-service stats body, still in its `{ success, data }` envelope. */
type SessionStats<Route extends keyof SessionStatsByRoute> = Promise<
  SessionsEnvelope<SessionStatsByRoute[Route]>
>;

/**
 * The browser's IANA time zone ("America/Vancouver"). sessions-service
 * buckets reports and reads date-only bounds in it; UTC when the runtime
 * cannot say.
 */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** A range's query params — `period`, or `from` + `to` — plus the browser's `tz`. */
function rangeParams(range: SessionRange): Record<string, string> {
  const tz = browserTimeZone();
  return "period" in range
    ? { period: range.period, tz }
    : { from: range.from, to: range.to, tz };
}

export default class ApiService {
  // ── Projects ──────────────────────────────────────────────────

  /** Health status of every registered service and infrastructure entry. */
  static getServices(
    refresh = false,
    options?: RequestOptions,
  ): Promise<ServicesResponse> {
    return get(
      `/services${queryString({ refresh: refresh || undefined })}`,
      options,
    );
  }

  // Start / stop / restart a registered, containerized service by project
  // id — the Projects page's card actions (they have no device id to use
  // the container-direct routes below).

  static startService(
    serviceId: string,
    options?: RequestOptions,
  ): Promise<ServiceActionResponse> {
    return ApiService.serviceAction("start", serviceId, options);
  }

  static stopService(
    serviceId: string,
    options?: RequestOptions,
  ): Promise<ServiceActionResponse> {
    return ApiService.serviceAction("stop", serviceId, options);
  }

  static restartService(
    serviceId: string,
    options?: RequestOptions,
  ): Promise<ServiceActionResponse> {
    return ApiService.serviceAction("restart", serviceId, options);
  }

  private static serviceAction(
    action: "restart" | "stop" | "start",
    serviceId: string,
    options?: RequestOptions,
  ): Promise<ServiceActionResponse> {
    return send(
      "POST",
      `/services/${pathSegment(serviceId)}/${action}`,
      options,
    );
  }

  /** Roll a containerized service back to its previous image. */
  static rollbackService(
    serviceId: string,
    options?: RequestOptions,
  ): Promise<ServiceActionResponse> {
    return send(
      "POST",
      `/services/${pathSegment(serviceId)}/rollback`,
      options,
    );
  }

  /** Whether a previous image exists to roll a service back to. */
  static getRollbackStatus(
    serviceId: string,
    options?: RequestOptions,
  ): Promise<ServiceRollbackStatus> {
    return get(`/services/${pathSegment(serviceId)}/rollback-status`, options);
  }

  /** Rollback status of every containerized service, keyed by project id. */
  static getRollbackStatuses(
    options?: RequestOptions,
  ): Promise<Record<string, ServiceRollbackStatus>> {
    return get("/services/rollback-status", options);
  }

  /** GitHub repository sizes of every project. */
  static getProjectSizes(options?: RequestOptions): Promise<RepoSizesResponse> {
    return get("/services/sizes", options);
  }

  /** Auto-detected ecosystem dependencies (imports, API calls, repo sizes). */
  static getProjectAnalysis(
    refresh = false,
    options?: RequestOptions,
  ): Promise<ProjectAnalysis> {
    return get(
      `/services/analysis${queryString({ refresh: refresh || undefined })}`,
      options,
    );
  }

  /** GitHub Linguist language breakdown of every project. */
  static getProjectLanguages(
    options?: RequestOptions,
  ): Promise<LanguagesResponse> {
    return get("/services/languages", options);
  }

  // ── Container-Direct Actions ─────────────────────────────────
  // By Docker container name + device ID, bypassing the project registry —
  // control of any Docker container.

  static restartContainer(
    containerName: string,
    device: string,
    options?: RequestOptions,
  ): Promise<ContainerActionResponse> {
    return ApiService.containerAction(
      "restart",
      containerName,
      device,
      options,
    );
  }

  static stopContainer(
    containerName: string,
    device: string,
    options?: RequestOptions,
  ): Promise<ContainerActionResponse> {
    return ApiService.containerAction("stop", containerName, device, options);
  }

  static startContainer(
    containerName: string,
    device: string,
    options?: RequestOptions,
  ): Promise<ContainerActionResponse> {
    return ApiService.containerAction("start", containerName, device, options);
  }

  private static containerAction(
    action: "restart" | "stop" | "start",
    containerName: string,
    device: string,
    options?: RequestOptions,
  ): Promise<ContainerActionResponse> {
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
  static getContainerStats(
    deviceId?: string,
    options?: RequestOptions,
  ): Promise<ContainerStatsResponse> {
    return get(
      `/stats/containers${queryString({ device: deviceId })}`,
      options,
    );
  }

  /** In-memory time series of container stats, keyed by device ID. */
  static getContainerStatsHistory(
    deviceId?: string,
    options?: RequestOptions,
  ): Promise<ContainerStatsHistoryResponse> {
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
  ): Promise<ContainerMetricsResponse> {
    return get(
      `/stats/containers/metrics${queryString({ range, container, device, limit })}`,
      options,
    );
  }

  /**
   * Docker system info — disk usage breakdown (images, volumes, build
   * cache). One host's object with a device; without, an array with one
   * entry per device that answered.
   */
  static getSystemInfo(
    deviceId?: string,
    options?: RequestOptions,
  ): Promise<SystemInfoResponse> {
    return get(`/stats/system${queryString({ device: deviceId })}`, options);
  }

  /**
   * Drop portal-service's cached container stats so the next read reflects
   * a start/stop/restart immediately instead of up to 10 s later.
   */
  static invalidateStats(options?: RequestOptions): Promise<{ ok: true }> {
    return send("POST", "/stats/invalidate", options);
  }

  /** MinIO storage summary — bucket counts and total sizes. */
  static getStorageSummary(options?: RequestOptions): Promise<StorageSummary> {
    return get("/stats/storage", options);
  }

  // ── Integrations ─────────────────────────────────────────────

  /** External API integrations and whether each is configured. */
  static getIntegrations(options?: RequestOptions): Promise<IntegrationsData> {
    return get("/integrations", options);
  }

  // ── Logs ─────────────────────────────────────────────────────

  /** Every Docker container available for log streaming. */
  static getLoggableContainers(
    options?: RequestOptions,
  ): Promise<LoggableContainersResponse> {
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
  static getDevices(options?: RequestOptions): Promise<DevicesResponse> {
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
    const parse = <T>(event: Event): T | null => {
      try {
        return JSON.parse((event as MessageEvent<string>).data) as T;
      } catch {
        finish({ type: "error", message: "Malformed bucket stream event" });
        return null;
      }
    };

    eventSource.addEventListener("init", (event) => {
      const data = parse<{ totalBuckets: number; buckets: StorageBucket[] }>(
        event,
      );
      if (data) onEvent({ ...data, type: "init" });
    });
    eventSource.addEventListener("bucket", (event) => {
      const bucket = parse<StorageBucket>(event);
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
          message =
            (JSON.parse(data) as { message?: string }).message || message;
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
  ): Promise<StorageObjectListing> {
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
  ): Promise<StorageObjectStat> {
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
  ): Promise<StorageDeleteResponse> {
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
  ): Promise<StorageSearchResponse> {
    return get(
      `/object-store/search${queryString({ query, bucket, limit })}`,
      options,
    );
  }

  // ── Google Analytics ────────────────────────────────────────
  // `period`: "7d" | "30d" | "90d" | "YYYY-MM-DD_YYYY-MM-DD".

  /** Configured GA4 properties. */
  static getGAProperties(
    options?: RequestOptions,
  ): Promise<GAPropertiesResponse> {
    return get("/google-analytics/properties", options);
  }

  /** Realtime active users of a GA4 property. */
  static getGARealtime(
    propertyId: string,
    options?: RequestOptions,
  ): Promise<GARealtimeReport> {
    return get(
      `/google-analytics/${pathSegment(propertyId)}/realtime`,
      options,
    );
  }

  static getGAOverview(
    propertyId: string,
    period = "30d",
    options?: RequestOptions,
  ): GAReport<"overview"> {
    return ApiService.gaReport(propertyId, "overview", period, options);
  }

  static getGAPages(
    propertyId: string,
    period = "30d",
    options?: RequestOptions,
  ): GAReport<"pages"> {
    return ApiService.gaReport(propertyId, "pages", period, options);
  }

  static getGASources(
    propertyId: string,
    period = "30d",
    options?: RequestOptions,
  ): GAReport<"sources"> {
    return ApiService.gaReport(propertyId, "sources", period, options);
  }

  static getGAGeography(
    propertyId: string,
    period = "30d",
    options?: RequestOptions,
  ): GAReport<"geography"> {
    return ApiService.gaReport(propertyId, "geography", period, options);
  }

  /** Device category, browser, OS and screen breakdown. */
  static getGADevices(
    propertyId: string,
    period = "30d",
    options?: RequestOptions,
  ): GAReport<"devices"> {
    return ApiService.gaReport(propertyId, "devices", period, options);
  }

  /** Daily pageviews, users and sessions. */
  static getGATimeSeries(
    propertyId: string,
    period = "30d",
    options?: RequestOptions,
  ): GAReport<"timeseries"> {
    return ApiService.gaReport(propertyId, "timeseries", period, options);
  }

  /** Channel grouping breakdown (Organic Search, Direct, Referral, …). */
  static getGAChannels(
    propertyId: string,
    period = "30d",
    options?: RequestOptions,
  ): GAReport<"channels"> {
    return ApiService.gaReport(propertyId, "channels", period, options);
  }

  /** Landing page performance (entry points). */
  static getGALandingPages(
    propertyId: string,
    period = "30d",
    options?: RequestOptions,
  ): GAReport<"landing-pages"> {
    return ApiService.gaReport(propertyId, "landing-pages", period, options);
  }

  /** Day × hour traffic matrix. */
  static getGAHeatmap(
    propertyId: string,
    period = "30d",
    options?: RequestOptions,
  ): GAReport<"heatmap"> {
    return ApiService.gaReport(propertyId, "heatmap", period, options);
  }

  static getGANewVsReturning(
    propertyId: string,
    period = "30d",
    options?: RequestOptions,
  ): GAReport<"new-vs-returning"> {
    return ApiService.gaReport(propertyId, "new-vs-returning", period, options);
  }

  static getGAEvents(
    propertyId: string,
    period = "30d",
    options?: RequestOptions,
  ): GAReport<"events"> {
    return ApiService.gaReport(propertyId, "events", period, options);
  }

  private static gaReport<Report extends keyof GAReportsByName>(
    propertyId: string,
    report: Report,
    period: string,
    options?: RequestOptions,
  ): GAReport<Report> {
    return get(
      `/google-analytics/${pathSegment(propertyId)}/${report}${queryString({ period })}`,
      options,
    );
  }

  // ── Session Analytics (first-party, proxied sessions-service) ──
  // portal-service passes sessions-service's `{ success, data }` bodies
  // through verbatim. Every ranged request carries the browser's IANA
  // time zone, which sets the report's buckets and where a custom range's
  // calendar days start and end.

  /** Every project sessions-service has seen, with the range's numbers and live count. */
  static getSessionProjects(
    range: SessionRange,
    options?: RequestOptions,
  ): SessionStats<"projects"> {
    return ApiService.sessionStats("projects", rangeParams(range), options);
  }

  /** One project's whole report for the range (and the range before it). */
  static getSessionReport(
    projectId: string,
    range: SessionRange,
    options?: RequestOptions,
  ): SessionStats<"report"> {
    return ApiService.sessionStats(
      "report",
      { projectId, ...rangeParams(range) },
      options,
    );
  }

  /** Sessions active in the last 5 minutes — one project's, or every project's. */
  static getSessionLive(
    projectId?: string,
    options?: RequestOptions,
  ): SessionStats<"live"> {
    return ApiService.sessionStats("live", { projectId }, options);
  }

  /** One page of the project's sessions in the range, filtered and sorted server-side. */
  static getSessionsList(
    projectId: string,
    range: SessionRange,
    filters: SessionFilters = {},
    paging: SessionPaging = { limit: 50, offset: 0 },
    sort: SessionSort = { sort: "startedAt", order: "desc" },
    options?: RequestOptions,
  ): SessionStats<"sessions"> {
    return ApiService.sessionStats(
      "sessions",
      {
        projectId,
        ...rangeParams(range),
        limit: paging.limit,
        offset: paging.offset,
        visitorId: filters.visitorId,
        ip: filters.ip,
        userId: filters.userId,
        country: filters.country,
        channel: filters.channel,
        path: filters.path,
        replay: filters.replay ? 1 : undefined,
        engaged: filters.engaged ? 1 : undefined,
        sort: sort.sort,
        order: sort.order,
      },
      options,
    );
  }

  /** One session: identity, client, acquisition, its pageviews and events. */
  static getSessionDetail(
    sessionId: string,
    options?: RequestOptions,
  ): Promise<SessionsEnvelope<SessionDetail>> {
    return get(
      `/session-analytics/sessions/${pathSegment(sessionId)}`,
      options,
    );
  }

  /** The session's rrweb recording, events ordered by timestamp. */
  static getSessionReplay(
    sessionId: string,
    options?: RequestOptions,
  ): Promise<SessionsEnvelope<SessionReplay>> {
    return get(
      `/session-analytics/sessions/${pathSegment(sessionId)}/replay`,
      options,
    );
  }

  /**
   * Click or cursor-movement density over one page path's full document,
   * for one viewport band — a phone and a desktop layout are never mixed.
   */
  static getSessionHeatmap(
    projectId: string,
    path: string,
    range: SessionRange,
    band: SessionBand = "desktop",
    type: SessionHeatmapType = "click",
    options?: RequestOptions,
  ): SessionStats<"heatmap"> {
    return ApiService.sessionStats(
      "heatmap",
      { projectId, path, ...rangeParams(range), band, type },
      options,
    );
  }

  private static sessionStats<Route extends keyof SessionStatsByRoute>(
    route: Route,
    params: Record<string, string | number | undefined>,
    options?: RequestOptions,
  ): SessionStats<Route> {
    return get(`/session-analytics/${route}${queryString(params)}`, options);
  }

  // ── External APIs (Google Cloud Monitoring + providers) ───────

  /** Usage summary of every external API with traffic. */
  static getExternalApiUsageSummary(
    period = "30d",
    options?: RequestOptions,
  ): Promise<ExternalApiUsageData> {
    return get(`/external-apis${queryString({ period })}`, options);
  }

  /** Daily time series of one external API service. */
  static getExternalApiUsageTimeSeries(
    serviceIdentifier: string,
    period = "30d",
    options?: RequestOptions,
  ): Promise<ExternalApiTimeSeries> {
    return get(
      `/external-apis/timeseries${queryString({ service: serviceIdentifier, period })}`,
      options,
    );
  }
}
