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
   * Get service health status for all Sun services.
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
}
