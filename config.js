// ============================================================
// Web Portal — Runtime Configuration
// ============================================================
// Typed accessor layer over process.env. The Vault service is
// the single source of truth — next.config.mjs hydrates
// process.env from the Vault before any module imports run.
//
// This file contains NO defaults and NO secrets.
// ============================================================

export const PORT = process.env.PORTAL_CLIENT_PORT;

// Environment-aware project name — isolates data between dev and prod
export const PROJECT_NAME = "portal";

// ── Portal API URL ─────────────────────────────────────────────
export const PORTAL_SERVICE_URL = process.env.PORTAL_SERVICE_URL;
