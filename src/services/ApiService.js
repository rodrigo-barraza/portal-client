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
      throw new Error(err.message || `API error: ${res.status}`);
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

  // ── Services ──────────────────────────────────────────────────

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
   * Get Docker container resource usage (CPU, memory, network, block I/O).
   */
  static async getContainerStats() {
    return ApiService._request("/stats/containers");
  }

  /**
   * Get time-series container stats history (last 5 minutes, 5s intervals).
   * Used for live sparkline charts.
   */
  static async getContainerStatsHistory() {
    return ApiService._request("/stats/containers/history");
  }

  /**
   * Get Docker system info — disk usage breakdown (images, volumes, build cache).
   */
  static async getSystemInfo() {
    return ApiService._request("/stats/system");
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
   * Get the list of services that support log streaming.
   */
  static async getLoggableServices() {
    return ApiService._request("/logs");
  }

  /**
   * Build the SSE URL for streaming container logs.
   * The caller should use `new EventSource(url)` to connect.
   * @param {string} serviceId
   * @param {{ tail?: number, follow?: boolean }} [opts]
   * @returns {string}
   */
  static buildLogStreamUrl(serviceId, { tail = 200, follow = true } = {}) {
    return `${API_BASE}/logs/${serviceId}?tail=${tail}&follow=${follow ? "1" : "0"}`;
  }

  // ── Devices ──────────────────────────────────────────────────

  /**
   * Get device topology — physical devices with their hosted services.
   */
  static async getDevices() {
    return ApiService._request("/devices");
  }

  // ── Storage ─────────────────────────────────────────────────

  /**
   * List all MinIO buckets with object counts and sizes.
   */
  static async getStorageBuckets() {
    return ApiService._request("/storage/buckets");
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
    return ApiService._request(`/storage/buckets/${bucketName}${query ? `?${query}` : ""}`);
  }

  /**
   * Get metadata for a single object.
   * @param {string} bucketName
   * @param {string} objectName
   */
  static async statStorageObject(bucketName, objectName) {
    return ApiService._request(`/storage/buckets/${bucketName}/stat/${objectName}`);
  }

  /**
   * Build a download URL for a storage object.
   * @param {string} bucketName
   * @param {string} objectName
   * @param {{ inline?: boolean }} [opts]
   * @returns {string}
   */
  static buildStorageDownloadUrl(bucketName, objectName, { inline = false } = {}) {
    const qs = inline ? "?inline=true" : "";
    return `${API_BASE}/storage/buckets/${bucketName}/download/${objectName}${qs}`;
  }

  /**
   * Delete a storage object.
   * @param {string} bucketName
   * @param {string} objectName
   */
  static async deleteStorageObject(bucketName, objectName) {
    return ApiService._request(`/storage/buckets/${bucketName}/${objectName}`, { method: "DELETE" });
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
