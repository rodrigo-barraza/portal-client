// ============================================================
// Web Portal — Runtime Configuration
// ============================================================
// All values are resolved from the Vault via secrets.js.
// No hardcoded URLs — the Vault serves the correct values
// for each deployment context.
// ============================================================

import {
  PORTAL_CLIENT_PORT as SECRETS_PORT,
  PORTAL_SERVICE_URL as SECRETS_PORTAL_SERVICE_URL,
} from "./secrets.js";

export const PORT = SECRETS_PORT || 4000;

// Environment-aware project name — isolates data between dev and prod
export const PROJECT_NAME = "portal";

// ── Portal API URL ─────────────────────────────────────────────
// Resolved from Vault in all contexts (browser + SSR).
// The Vault serves the correct URL for each environment.
export const PORTAL_SERVICE_URL = SECRETS_PORTAL_SERVICE_URL;
