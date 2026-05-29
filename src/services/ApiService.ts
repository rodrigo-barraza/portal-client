/**
 * ApiService — HTTP client for the API backend.
 * Follows the same static-method pattern as Prism Client's PrismService.
 */

import { PORTAL_SERVICE_URL } from "@/config";
import { createApiClient } from "@rodrigo-barraza/components-library";
import type { BucketStreamEvent } from "../types/portal";

const request = createApiClient(PORTAL_SERVICE_URL, { noCache: true });

export default class ApiService {
  /**
   * Shared fetch helper — delegates to components-library.
   */
  static async _request(
    endpoint: string,
    { method = "GET", body }: { method?: string; body?: unknown } = {},
  ) {
    return request(
      method as "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
      endpoint,
      body,
    );
  }

  // ── Root ──────────────────────────────────────────────────────

  /**
   * Root health check — returns name, version, endpoints.
   */
  static async getHealth() {
    return ApiService._request("/");
  }

  // ── Projects ──────────────────────────────────────────────────

  /**
   * Get service health status for all services.

   */
  static async getServices(refresh = false) {
    const queryString = refresh ? "?refresh=true" : "";
    return ApiService._request(`/services${queryString}`);
  }

  /**
   * Trigger a manual health check for all services.
   */
  static async checkServices() {
    return ApiService._request("/services/check", { method: "POST" });
  }

  /**
   * Reload the vault registry — picks up newly added projects
   * without requiring a portal-service container restart.
   */
  static async reloadRegistry() {
    return ApiService._request("/services/reload", { method: "POST" });
  }

  /**
   * Restart a containerized service via SSH + Docker Compose.

   */
  static async restartService(serviceId: string) {
    return ApiService._request(`/services/${serviceId}/restart`, {
      method: "POST",
    });
  }

  /**
   * Stop a containerized service via SSH + Docker Compose.

   */
  static async stopService(serviceId: string) {
    return ApiService._request(`/services/${serviceId}/stop`, {
      method: "POST",
    });
  }

  /**
   * Start a containerized service via SSH + Docker Compose.

   */
  static async startService(serviceId: string) {
    return ApiService._request(`/services/${serviceId}/start`, {
      method: "POST",
    });
  }

  /**
   * Rollback a containerized service to its previous image.

   */
  static async rollbackService(serviceId: string) {
    return ApiService._request(`/services/${serviceId}/rollback`, {
      method: "POST",
    });
  }

  /**
   * Check if a rollback is available for a containerized service.

   */
  static async getRollbackStatus(serviceId: string) {
    return ApiService._request(`/services/${serviceId}/rollback-status`);
  }

  // ── Container-Direct Actions ─────────────────────────────────
  // These operate by Docker container name + device ID, bypassing the
  // project registry — enabling control of any Docker container.

  /**
   * Restart a Docker container by name on a specific device.


   */
  static async restartContainer(containerName: string, device: string) {
    return ApiService._request(
      `/containers/${containerName}/restart?device=${encodeURIComponent(device)}`,
      { method: "POST" },
    );
  }

  /**
   * Stop a Docker container by name on a specific device.


   */
  static async stopContainer(containerName: string, device: string) {
    return ApiService._request(
      `/containers/${containerName}/stop?device=${encodeURIComponent(device)}`,
      { method: "POST" },
    );
  }

  /**
   * Start a Docker container by name on a specific device.


   */
  static async startContainer(containerName: string, device: string) {
    return ApiService._request(
      `/containers/${containerName}/start?device=${encodeURIComponent(device)}`,
      { method: "POST" },
    );
  }

  /**
   * Get GitHub repository sizes for all projects.
   */
  static async getProjectSizes() {
    return ApiService._request("/services/sizes");
  }

  /**
   * Get auto-detected ecosystem dependencies (imports, API calls, repo sizes).
   */
  static async getProjectAnalysis(refresh = false) {
    const queryString = refresh ? "?refresh=true" : "";
    return ApiService._request(`/services/analysis${queryString}`);
  }

  /**
   * Get GitHub Linguist language breakdown for all projects.
   */
  static async getProjectLanguages() {
    return ApiService._request("/services/languages");
  }

  // ── Stats ─────────────────────────────────────────────────────

  /**
   * Get overview stats from Prism.
   */
  static async getStats() {
    return ApiService._request("/stats");
  }

  /**
   * Get request breakdown stats.

   */
  static async getStatsBreakdown(period = "24h") {
    return ApiService._request(`/stats/breakdown?period=${period}`);
  }

  /**
   * Get per-project stats.
   */
  static async getProjectStats() {
    return ApiService._request("/stats/projects");
  }

  /**
   * Get Docker container resource usage (CPU, memory, network).

   */
  static async getContainerStats(deviceId?: string) {
    const queryString = deviceId ? `?device=${deviceId}` : "";
    return ApiService._request(`/stats/containers${queryString}`);
  }

  /**
   * Get time-series container stats history.
   * Returns per-device history keyed by device ID.

   */
  static async getContainerStatsHistory(deviceId?: string) {
    const queryString = deviceId ? `?device=${deviceId}` : "";
    return ApiService._request(`/stats/containers/history${queryString}`);
  }

  /**
   * Get persistent container metrics from MongoDB time-series collection.
   * Returns per-container historical data points with configurable range.
   */
  static async getContainerMetrics({
    range = "1h",
    container,
    device,
    limit = 120,
  }: {
    range?: string;
    container?: string;
    device?: string;
    limit?: number;
  } = {}) {
    const queryString = new URLSearchParams();
    queryString.set("range", range);
    if (container) queryString.set("container", container);
    if (device) queryString.set("device", device);
    if (limit !== 120) queryString.set("limit", String(limit));
    return ApiService._request(
      `/stats/containers/metrics?${queryString.toString()}`,
    );
  }

  /**
   * Get Docker system info — disk usage breakdown (images, volumes, build cache).

   */
  static async getSystemInfo(deviceId?: string) {
    const queryString = deviceId ? `?device=${deviceId}` : "";
    return ApiService._request(`/stats/system${queryString}`);
  }

  /**
   * Get MinIO storage summary — bucket counts and total sizes.
   */
  static async getStorageSummary() {
    return ApiService._request("/stats/storage");
  }

  // ── Integrations ─────────────────────────────────────────────

  /**
   * Get all external API integrations and their configuration status.
   */
  static async getIntegrations() {
    return ApiService._request("/integrations");
  }

  // ── Logs ────────────────────────────────────────────────────

  /**
   * Get the list of all Docker containers available for log streaming.
   */
  static async getLoggableContainers() {
    return ApiService._request("/logs");
  }

  /**
   * Build the SSE URL for streaming container logs.
   * The caller should use `new EventSource(url)` to connect.


   */
  static buildLogStreamUrl(
    containerName: string,
    {
      tail = 200,
      follow = true,
      device,
    }: { tail?: number; follow?: boolean; device?: string } = {},
  ) {
    let url = `${PORTAL_SERVICE_URL}/logs/${containerName}?tail=${tail}&follow=${follow ? "1" : "0"}`;
    if (device) url += `&device=${encodeURIComponent(device)}`;
    return url;
  }

  // ── Devices ──────────────────────────────────────────────────

  /**
   * Get device topology — physical devices with their hosted services.
   */
  static async getDevices() {
    return ApiService._request("/devices");
  }

  // ── Object Store ────────────────────────────────────────────

  /**
   * List all MinIO buckets with object counts and sizes.
   */
  static async getStorageBuckets() {
    return ApiService._request("/object-store/buckets");
  }

  /**
   * Stream bucket data via SSE for progressive loading.
   * Calls onEvent for each server-sent event:
   *   { type: "init", totalBuckets }
   *   { type: "bucket", bucket: { name, creationDate, objectCount, totalSize } }
   *   { type: "done" }
   *   { type: "error", message }

   */
  static streamStorageBuckets(onEvent: (event: BucketStreamEvent) => void) {
    const es = new EventSource(
      `${PORTAL_SERVICE_URL}/object-store/buckets/stream`,
    );

    es.addEventListener("init", (e: Event) => {
      onEvent({ type: "init", ...JSON.parse((e as MessageEvent).data) });
    });

    es.addEventListener("bucket", (e: Event) => {
      onEvent({ type: "bucket", bucket: JSON.parse((e as MessageEvent).data) });
    });

    es.addEventListener("done", () => {
      onEvent({ type: "done" });
      es.close();
    });

    es.addEventListener("error", (e: Event) => {
      // EventSource fires a generic error on close — only report if we have data
      const me = e as MessageEvent;
      if (me.data) {
        try {
          onEvent({ type: "error", ...JSON.parse(me.data) });
        } catch {
          onEvent({ type: "error", message: "Stream error" });
        }
      }
      es.close();
    });

    return { close: () => es.close() };
  }

  /**
   * List objects in a bucket.

   */
  static async getStorageObjects(
    bucketName: string,
    {
      prefix = "",
      recursive = false,
    }: { prefix?: string; recursive?: boolean } = {},
  ) {
    const queryString = new URLSearchParams();
    if (prefix) queryString.set("prefix", prefix);
    if (recursive) queryString.set("recursive", "true");
    const query = queryString.toString();
    return ApiService._request(
      `/object-store/buckets/${bucketName}${query ? `?${query}` : ""}`,
    );
  }

  /**
   * Get metadata for a single object.


   */
  static async statStorageObject(bucketName: string, objectName: string) {
    return ApiService._request(
      `/object-store/buckets/${bucketName}/stat/${objectName}`,
    );
  }

  /**
   * Build a download URL for an object-store object.


   */
  static buildStorageDownloadUrl(
    bucketName: string,
    objectName: string,
    { inline = false }: { inline?: boolean } = {},
  ) {
    const queryString = inline ? "?inline=true" : "";
    return `${PORTAL_SERVICE_URL}/object-store/buckets/${bucketName}/download/${objectName}${queryString}`;
  }

  /**
   * Delete an object-store object.


   */
  static async deleteStorageObject(bucketName: string, objectName: string) {
    return ApiService._request(
      `/object-store/buckets/${bucketName}/${objectName}`,
      { method: "DELETE" },
    );
  }

  static async searchStorageObjects(
    query: string,
    { bucket, limit = 200 }: { bucket?: string; limit?: number } = {},
  ) {
    const queryString = new URLSearchParams();
    queryString.set("query", query);
    if (bucket) queryString.set("bucket", bucket);
    if (limit !== 200) queryString.set("limit", String(limit));
    return ApiService._request(
      `/object-store/search?${queryString.toString()}`,
    );
  }

  // ── Google Analytics ────────────────────────────────────────

  /**
   * List configured GA4 properties.
   */
  static async getGAProperties() {
    return ApiService._request("/google-analytics/properties");
  }

  /**
   * Get realtime active users for a GA4 property.

   */
  static async getGARealtime(propertyId: string) {
    return ApiService._request(`/google-analytics/${propertyId}/realtime`);
  }

  /**
   * Get overview metrics for a GA4 property.


   */
  static async getGAOverview(propertyId: string, period = "30d") {
    return ApiService._request(
      `/google-analytics/${propertyId}/overview?period=${period}`,
    );
  }

  /**
   * Get top pages for a GA4 property.


   */
  static async getGAPages(propertyId: string, period = "30d") {
    return ApiService._request(
      `/google-analytics/${propertyId}/pages?period=${period}`,
    );
  }

  /**
   * Get traffic source breakdown for a GA4 property.


   */
  static async getGASources(propertyId: string, period = "30d") {
    return ApiService._request(
      `/google-analytics/${propertyId}/sources?period=${period}`,
    );
  }

  /**
   * Get geographic breakdown for a GA4 property.


   */
  static async getGAGeography(propertyId: string, period = "30d") {
    return ApiService._request(
      `/google-analytics/${propertyId}/geography?period=${period}`,
    );
  }

  /**
   * Get device and browser breakdown for a GA4 property.


   */
  static async getGADevices(propertyId: string, period = "30d") {
    return ApiService._request(
      `/google-analytics/${propertyId}/devices?period=${period}`,
    );
  }

  /**
   * Get daily time-series data (pageviews, users, sessions).


   */
  static async getGATimeSeries(propertyId: string, period = "30d") {
    return ApiService._request(
      `/google-analytics/${propertyId}/timeseries?period=${period}`,
    );
  }

  /**
   * Get channel grouping breakdown (Organic Search, Direct, Referral, etc.).


   */
  static async getGAChannels(propertyId: string, period = "30d") {
    return ApiService._request(
      `/google-analytics/${propertyId}/channels?period=${period}`,
    );
  }

  /**
   * Get landing page performance (entry points).


   */
  static async getGALandingPages(propertyId: string, period = "30d") {
    return ApiService._request(
      `/google-analytics/${propertyId}/landing-pages?period=${period}`,
    );
  }

  /**
   * Get hourly traffic heatmap (day × hour matrix).


   */
  static async getGAHeatmap(propertyId: string, period = "30d") {
    return ApiService._request(
      `/google-analytics/${propertyId}/heatmap?period=${period}`,
    );
  }

  /**
   * Get new vs returning users breakdown.


   */
  static async getGANewVsReturning(propertyId: string, period = "30d") {
    return ApiService._request(
      `/google-analytics/${propertyId}/new-vs-returning?period=${period}`,
    );
  }

  /**
   * Get top events breakdown.


   */
  static async getGAEvents(propertyId: string, period = "30d") {
    return ApiService._request(
      `/google-analytics/${propertyId}/events?period=${period}`,
    );
  }

  // ── Session Analytics (First-Party) ─────────────────────────

  /**
   * List distinct projects tracked by sessions-service.
   */
  static async getSessionProjects(period = "30d") {
    return ApiService._request(`/session-analytics/projects?period=${period}`);
  }

  /**
   * Get overview stats for a project from sessions-service.
   */
  static async getSessionOverview(projectId: string, period = "30d") {
    return ApiService._request(
      `/session-analytics/overview?projectId=${projectId}&period=${period}`,
    );
  }

  /**
   * Get paginated session list with full detail (IP, geo, device).
   */
  static async getSessionsList(
    projectId: string,
    period = "30d",
    limit = 50,
    offset = 0,
    sort = "createdAt",
    order = "desc",
  ) {
    const queryString = new URLSearchParams({
      projectId,
      period,
      limit: String(limit),
      offset: String(offset),
      sort,
      order,
    });
    return ApiService._request(
      `/session-analytics/sessions?${queryString.toString()}`,
    );
  }

  /**
   * Get top pages by view count.
   */
  static async getSessionPages(projectId: string, period = "30d") {
    return ApiService._request(
      `/session-analytics/pages?projectId=${projectId}&period=${period}`,
    );
  }

  /**
   * Get top referrers.
   */
  static async getSessionReferrers(projectId: string, period = "30d") {
    return ApiService._request(
      `/session-analytics/referrers?projectId=${projectId}&period=${period}`,
    );
  }

  /**
   * Get geographic breakdown.
   */
  static async getSessionGeo(projectId: string, period = "30d") {
    return ApiService._request(
      `/session-analytics/geo?projectId=${projectId}&period=${period}`,
    );
  }

  /**
   * Get device/browser/OS breakdown.
   */
  static async getSessionDevices(projectId: string, period = "30d") {
    return ApiService._request(
      `/session-analytics/devices?projectId=${projectId}&period=${period}`,
    );
  }

  /**
   * Get daily time-series data.
   */
  static async getSessionTimeSeries(projectId: string, period = "30d") {
    return ApiService._request(
      `/session-analytics/timeseries?projectId=${projectId}&period=${period}`,
    );
  }

  /**
   * Get live/active sessions.
   */
  static async getSessionLive(projectId: string, minutes = 5) {
    return ApiService._request(
      `/session-analytics/live?projectId=${projectId}&minutes=${minutes}`,
    );
  }

  /**
   * Get top events by category/action.
   */
  static async getSessionEvents(projectId: string, period = "30d") {
    return ApiService._request(
      `/session-analytics/events?projectId=${projectId}&period=${period}`,
    );
  }

  /**
   * Get chronological event feed with pagination.
   */
  static async getSessionEventsFeed(
    projectId: string,
    period = "30d",
    limit = 50,
    offset = 0,
  ) {
    const queryString = new URLSearchParams({
      projectId,
      period,
      limit: String(limit),
      offset: String(offset),
    });
    return ApiService._request(
      `/session-analytics/events/feed?${queryString.toString()}`,
    );
  }

  /**
   * Get cross-client visitor correlation.
   */
  static async getSessionCrossClient(period = "30d") {
    return ApiService._request(
      `/session-analytics/cross-client?period=${period}`,
    );
  }

  /**
   * Get single session detail with page views, events, and timeline.
   */
  static async getSessionDetail(sessionId: string) {
    return ApiService._request(
      `/session-analytics/session/${encodeURIComponent(sessionId)}`,
    );
  }

  /**
   * Get distinct visitors with session counts and device metadata.
   */
  static async getSessionVisitors(
    projectId: string,
    period = "30d",
    limit = 50,
    offset = 0,
  ) {
    const queryString = new URLSearchParams({
      projectId,
      period,
      limit: String(limit),
      offset: String(offset),
    });
    return ApiService._request(
      `/session-analytics/visitors?${queryString.toString()}`,
    );
  }

  /**
   * Get IP-based pseudo-user listing with session/visitor aggregation.
   */
  static async getSessionIpUsers(
    projectId: string,
    period = "30d",
    limit = 50,
    offset = 0,
  ) {
    const queryString = new URLSearchParams({
      projectId,
      period,
      limit: String(limit),
      offset: String(offset),
    });
    return ApiService._request(
      `/session-analytics/ips?${queryString.toString()}`,
    );
  }

  /**
   * Get single IP detail — all sessions + cross-session timeline.
   */
  static async getSessionIpDetail(
    ip: string,
    projectId?: string,
    period = "all",
  ) {
    const queryString = new URLSearchParams({ period });
    if (projectId) queryString.set("projectId", projectId);
    return ApiService._request(
      `/session-analytics/ip/${encodeURIComponent(ip)}?${queryString.toString()}`,
    );
  }
}
