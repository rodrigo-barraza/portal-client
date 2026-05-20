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
    return request(method as "GET" | "POST" | "PUT" | "DELETE" | "PATCH", endpoint, body);
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
    const qs = refresh ? "?refresh=true" : "";
    return ApiService._request(`/services${qs}`);
  }

  /**
   * Trigger a manual health check for all services.
   */
  static async checkServices() {
    return ApiService._request("/services/check", { method: "POST" });
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

   * @returns {Promise<{ available: boolean, previousImage?: object }>}
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
   * @returns {Promise<{ sizes: Record<string, { sizeKB: number, sizeBytes: number }> }>}
   */
  static async getProjectSizes() {
    return ApiService._request("/services/sizes");
  }

  /**
   * Get auto-detected ecosystem dependencies (imports, API calls, repo sizes).
   * @returns {Promise<{ dependencies: Record<string, { imports: string[], apiCalls: string[] }>, repoSizes: Record<string, { sizeKB: number, sizeBytes: number }>, analyzedAt: string }>}
   */
  static async getProjectAnalysis(refresh = false) {
    const qs = refresh ? "?refresh=true" : "";
    return ApiService._request(`/services/analysis${qs}`);
  }

  /**
   * Get GitHub Linguist language breakdown for all projects.
   * @returns {Promise<{ languages: Record<string, { primary: string, breakdown: { language: string, percent: number }[], totalBytes: number }> }>}
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
    const qs = deviceId ? `?device=${deviceId}` : "";
    return ApiService._request(`/stats/containers${qs}`);
  }

  /**
   * Get time-series container stats history.
   * Returns per-device history keyed by device ID.

   */
  static async getContainerStatsHistory(deviceId?: string) {
    const qs = deviceId ? `?device=${deviceId}` : "";
    return ApiService._request(`/stats/containers/history${qs}`);
  }

  /**
   * Get persistent container metrics from MongoDB time-series collection.
   * Returns per-container historical data points with configurable range.
   *
   * @param range  - Time range: "1h", "6h", "24h", "7d" (default: "1h")
   * @param container - Optional container name filter
   * @param device - Optional device ID filter
   * @param limit  - Max samples per container (default: 120)
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
    const qs = new URLSearchParams();
    qs.set("range", range);
    if (container) qs.set("container", container);
    if (device) qs.set("device", device);
    if (limit !== 120) qs.set("limit", String(limit));
    return ApiService._request(`/stats/containers/metrics?${qs.toString()}`);
  }

  /**
   * Get Docker system info — disk usage breakdown (images, volumes, build cache).

   */
  static async getSystemInfo(deviceId?: string) {
    const qs = deviceId ? `?device=${deviceId}` : "";
    return ApiService._request(`/stats/system${qs}`);
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

   * @param {{ tail?: number, follow?: boolean, device?: string }} [opts]

   */
  static buildLogStreamUrl(
    containerName: string,
    { tail = 200, follow = true, device }: { tail?: number; follow?: boolean; device?: string } = {},
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

   * @returns {{ close: () => void }} — call close() to abort
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

   * @param {{ prefix?: string, recursive?: boolean }} [opts]
   */
  static async getStorageObjects(
    bucketName: string,
    { prefix = "", recursive = false }: { prefix?: string; recursive?: boolean } = {},
  ) {
    const qs = new URLSearchParams();
    if (prefix) qs.set("prefix", prefix);
    if (recursive) qs.set("recursive", "true");
    const query = qs.toString();
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


   * @param {{ inline?: boolean }} [opts]

   */
  static buildStorageDownloadUrl(
    bucketName: string,
    objectName: string,
    { inline = false }: { inline?: boolean } = {},
  ) {
    const qs = inline ? "?inline=true" : "";
    return `${PORTAL_SERVICE_URL}/object-store/buckets/${bucketName}/download/${objectName}${qs}`;
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
}
