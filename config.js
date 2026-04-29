// ============================================================
// Web Portal — Runtime Configuration
// ============================================================
// Derives the API backend URL from the browser's current origin
// so it works from any host (localhost, LAN IP, hostname, etc.).
// ============================================================

import {
  PORTAL_CLIENT_PORT as SECRETS_PORT,
  PORTAL_SERVICE_URL as DEFAULT_PORTAL_SERVICE_URL,
} from "./secrets.js";

export const PORT = SECRETS_PORT || 4000;

// Environment-aware project name — isolates data between dev and prod
export const PROJECT_NAME = "portal";

// ── Portal API URL ─────────────────────────────────────────────
// Derives from the browser's current origin, swapping the port
// to the portal-service port (4001). Falls back to the env var
// in SSR / Node contexts.
function resolveServiceUrl() {
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:4001`;
  }
  return DEFAULT_PORTAL_SERVICE_URL;
}

export const PORTAL_SERVICE_URL = resolveServiceUrl();
