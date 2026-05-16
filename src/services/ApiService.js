/**
 * ApiService — HTTP client for the API backend.
 * Follows the same static-method pattern as Prism Client's PrismService.
 */

import { PORTAL_SERVICE_URL } from "../../config.js";

const API_BASE = PORTAL_SERVICE_URL;

export default class ApiService {
  /**
   * Shared fetch helper — centralises request / error handling.
   * @param {string} endpoint
   * @param {object} [options]
   * @param {string} [options.method="GET"]
   * @param {object} [options.body]
   * @returns {Promise<any>}
   */
  static async _request(endpoint, { method = "GET", body } = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      ...(body && { body: JSON.stringify(body) }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(error.message || `API error: ${res.status}`);
    }

    return res.json();
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
   * @param {boolean} [refresh=false] - Force fresh health check
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
   * @param {string} serviceId - Service ID (e.g. "lights", "vault")
   */
  static async restartService(serviceId) {
    return ApiService._request(`/services/${serviceId}/restart`, { method: "POST" });
  }

  /**
   * Stop a containerized service via SSH + Docker Compose.
   * @param {string} serviceId
   */
  static async stopService(serviceId) {
    return ApiService._request(`/services/${serviceId}/stop`, { method: "POST" });
  }

  /**
   * Start a containerized service via SSH + Docker Compose.
   * @param {string} serviceId
   */
  static async startService(serviceId) {
    return ApiService._request(`/services/${serviceId}/start`, { method: "POST" });
  }

  /**
   * Rollback a containerized service to its previous image.
   * @param {string} serviceId
   */
  static async rollbackService(serviceId) {
    return ApiService._request(`/services/${serviceId}/rollback`, { method: "POST" });
  }

  /**
   * Check if a rollback is available for a containerized service.
   * @param {string} serviceId
   * @returns {Promise<{ available: boolean, previousImage?: object }>}
   */
  static async getRollbackStatus(serviceId) {
    return ApiService._request(`/services/${serviceId}/rollback-status`);
  }

  /**
   * Get GitHub repository sizes for all projects.
   * @returns {Promise<{ sizes: Record<string, { sizeKB: number, sizeBytes: number }> }>}
   */
  static async getProjectSizes() {
    return ApiService._request("/services/sizes");
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
   * @param {string} [period="24h"]
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
   * @param {string} [deviceId] - Optional device filter
   */
  static async getContainerStats(deviceId) {
    const qs = deviceId ? `?device=${deviceId}` : "";
    return ApiService._request(`/stats/containers${qs}`);
  }

  /**
   * Get time-series container stats history.
   * Returns per-device history keyed by device ID.
   * @param {string} [deviceId] - Optional device filter
   */
  static async getContainerStatsHistory(deviceId) {
    const qs = deviceId ? `?device=${deviceId}` : "";
    return ApiService._request(`/stats/containers/history${qs}`);
  }

  /**
   * Get Docker system info — disk usage breakdown (images, volumes, build cache).
   * @param {string} [deviceId] - Optional device filter
   */
  static async getSystemInfo(deviceId) {
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
   * @param {string} containerName - Docker container name
   * @param {{ tail?: number, follow?: boolean, device?: string }} [opts]
   * @returns {string}
   */
  static buildLogStreamUrl(containerName, { tail = 200, follow = true, device } = {}) {
    let url = `${API_BASE}/logs/${containerName}?tail=${tail}&follow=${follow ? "1" : "0"}`;
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
   * @param {(event: object) => void} onEvent
   * @returns {{ close: () => void }} — call close() to abort
   */
  static streamStorageBuckets(onEvent) {
    const es = new EventSource(`${API_BASE}/object-store/buckets/stream`);

    es.addEventListener("init", (e) => {
      onEvent({ type: "init", ...JSON.parse(e.data) });
    });

    es.addEventListener("bucket", (e) => {
      onEvent({ type: "bucket", bucket: JSON.parse(e.data) });
    });

    es.addEventListener("done", () => {
      onEvent({ type: "done" });
      es.close();
    });

    es.addEventListener("error", (e) => {
      // EventSource fires a generic error on close — only report if we have data
      if (e.data) {
        try {
          onEvent({ type: "error", ...JSON.parse(e.data) });
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
   * @param {string} bucketName
   * @param {{ prefix?: string, recursive?: boolean }} [opts]
   */
  static async getStorageObjects(bucketName, { prefix = "", recursive = false } = {}) {
    const qs = new URLSearchParams();
    if (prefix) qs.set("prefix", prefix);
    if (recursive) qs.set("recursive", "true");
    const query = qs.toString();
    return ApiService._request(`/object-store/buckets/${bucketName}${query ? `?${query}` : ""}`);
  }

  /**
   * Get metadata for a single object.
   * @param {string} bucketName
   * @param {string} objectName
   */
  static async statStorageObject(bucketName, objectName) {
    return ApiService._request(`/object-store/buckets/${bucketName}/stat/${objectName}`);
  }

  /**
   * Build a download URL for an object-store object.
   * @param {string} bucketName
   * @param {string} objectName
   * @param {{ inline?: boolean }} [opts]
   * @returns {string}
   */
  static buildStorageDownloadUrl(bucketName, objectName, { inline = false } = {}) {
    const qs = inline ? "?inline=true" : "";
    return `${API_BASE}/object-store/buckets/${bucketName}/download/${objectName}${qs}`;
  }

  /**
   * Delete an object-store object.
   * @param {string} bucketName
   * @param {string} objectName
   */
  static async deleteStorageObject(bucketName, objectName) {
    return ApiService._request(`/object-store/buckets/${bucketName}/${objectName}`, { method: "DELETE" });
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
   * @param {string} propertyId
   */
  static async getGARealtime(propertyId) {
    return ApiService._request(`/google-analytics/${propertyId}/realtime`);
  }

  /**
   * Get overview metrics for a GA4 property.
   * @param {string} propertyId
   * @param {string} [period="30d"]
   */
  static async getGAOverview(propertyId, period = "30d") {
    return ApiService._request(`/google-analytics/${propertyId}/overview?period=${period}`);
  }

  /**
   * Get top pages for a GA4 property.
   * @param {string} propertyId
   * @param {string} [period="30d"]
   */
  static async getGAPages(propertyId, period = "30d") {
    return ApiService._request(`/google-analytics/${propertyId}/pages?period=${period}`);
  }

  /**
   * Get traffic source breakdown for a GA4 property.
   * @param {string} propertyId
   * @param {string} [period="30d"]
   */
  static async getGASources(propertyId, period = "30d") {
    return ApiService._request(`/google-analytics/${propertyId}/sources?period=${period}`);
  }

  /**
   * Get geographic breakdown for a GA4 property.
   * @param {string} propertyId
   * @param {string} [period="30d"]
   */
  static async getGAGeography(propertyId, period = "30d") {
    return ApiService._request(`/google-analytics/${propertyId}/geography?period=${period}`);
  }

  /**
   * Get device and browser breakdown for a GA4 property.
   * @param {string} propertyId
   * @param {string} [period="30d"]
   */
  static async getGADevices(propertyId, period = "30d") {
    return ApiService._request(`/google-analytics/${propertyId}/devices?period=${period}`);
  }

  /**
   * Get daily time-series data (pageviews, users, sessions).
   * @param {string} propertyId
   * @param {string} [period="30d"]
   */
  static async getGATimeSeries(propertyId, period = "30d") {
    return ApiService._request(`/google-analytics/${propertyId}/timeseries?period=${period}`);
  }

  /**
   * Get channel grouping breakdown (Organic Search, Direct, Referral, etc.).
   * @param {string} propertyId
   * @param {string} [period="30d"]
   */
  static async getGAChannels(propertyId, period = "30d") {
    return ApiService._request(`/google-analytics/${propertyId}/channels?period=${period}`);
  }

  /**
   * Get landing page performance (entry points).
   * @param {string} propertyId
   * @param {string} [period="30d"]
   */
  static async getGALandingPages(propertyId, period = "30d") {
    return ApiService._request(`/google-analytics/${propertyId}/landing-pages?period=${period}`);
  }

  /**
   * Get hourly traffic heatmap (day × hour matrix).
   * @param {string} propertyId
   * @param {string} [period="30d"]
   */
  static async getGAHeatmap(propertyId, period = "30d") {
    return ApiService._request(`/google-analytics/${propertyId}/heatmap?period=${period}`);
  }

  /**
   * Get new vs returning users breakdown.
   * @param {string} propertyId
   * @param {string} [period="30d"]
   */
  static async getGANewVsReturning(propertyId, period = "30d") {
    return ApiService._request(`/google-analytics/${propertyId}/new-vs-returning?period=${period}`);
  }

  /**
   * Get top events breakdown.
   * @param {string} propertyId
   * @param {string} [period="30d"]
   */
  static async getGAEvents(propertyId, period = "30d") {
    return ApiService._request(`/google-analytics/${propertyId}/events?period=${period}`);
  }
}
