/**
 * PortalApiService — HTTP client for the API Portal backend.
 * Follows the same static-method pattern as Retina's PrismService.
 */

import { PORTAL_API_URL } from "../../config.js";

const API_BASE = PORTAL_API_URL;

export default class PortalApiService {
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
      throw new Error(err.message || `Portal API error: ${res.status}`);
    }

    return res.json();
  }

  // ── Root ──────────────────────────────────────────────────────

  /**
   * Root health check — returns name, version, endpoints.
   */
  static async getHealth() {
    return PortalApiService._request("/");
  }

  // ── Services ──────────────────────────────────────────────────

  /**
   * Get service health status for all Sun services.
   * @param {boolean} [refresh=false] - Force fresh health check
   */
  static async getServices(refresh = false) {
    const qs = refresh ? "?refresh=true" : "";
    return PortalApiService._request(`/services${qs}`);
  }

  /**
   * Trigger a manual health check for all services.
   */
  static async checkServices() {
    return PortalApiService._request("/services/check", { method: "POST" });
  }

  // ── Stats ─────────────────────────────────────────────────────

  /**
   * Get overview stats from Prism.
   */
  static async getStats() {
    return PortalApiService._request("/stats");
  }

  /**
   * Get request breakdown stats.
   * @param {string} [period="24h"]
   */
  static async getStatsBreakdown(period = "24h") {
    return PortalApiService._request(`/stats/breakdown?period=${period}`);
  }

  /**
   * Get per-project stats.
   */
  static async getProjectStats() {
    return PortalApiService._request("/stats/projects");
  }

  // ── Portfolio ─────────────────────────────────────────────────

  /**
   * Get portfolio content and projects.
   */
  static async getPortfolio() {
    return PortalApiService._request("/portfolio");
  }

  // ── Devices ──────────────────────────────────────────────────

  /**
   * Get device topology — physical devices with their hosted services.
   */
  static async getDevices() {
    return PortalApiService._request("/devices");
  }

  /**
   * Update portfolio content.
   * @param {object} content
   */
  static async updatePortfolioContent(content) {
    return PortalApiService._request("/portfolio/content", {
      method: "PUT",
      body: content,
    });
  }
}
