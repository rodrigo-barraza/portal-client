// ============================================================
// Web Portal — Runtime Configuration
// ============================================================
// Typed accessor layer over process.env. The Vault service is
// the single source of truth — next.config.mjs hydrates
// process.env from the Vault before any module imports run.
//
// This file contains NO defaults and NO secrets.
//
// Browser requests must NEVER hit localhost or LAN IPs when loaded
// from a public domain — that triggers Chrome's Private Network
// Access (PNA) prompt and mixed-content blocks.
//
// Strategy:
//   Production (*.rod.dev):
//     • PORTAL_SERVICE_URL → PORTAL_SERVICE_PUBLIC_URL from vault
//
//   Local dev (localhost):
//     • PORTAL_SERVICE_URL → vault value (LAN IP — same network)
//
//   Server-side (SSR):
//     • All URLs use full values from vault (LAN IPs for Docker)
// ============================================================

export const PORT = process.env.PORTAL_CLIENT_PORT;

// Environment-aware project name — isolates data between dev and prod
export const PROJECT_NAME = "portal";

const IS_BROWSER = typeof window !== "undefined";

// ── Raw values from process.env ────────────────────────────────
const RAW_PORTAL_SERVICE_URL = process.env.PORTAL_SERVICE_URL;

// ── Public URL from vault (browser production override) ────────
const PUBLIC_PORTAL_SERVICE_URL = process.env.PORTAL_SERVICE_PUBLIC_URL;

// ── Portal API URL ─────────────────────────────────────────────
function resolvePortalServiceUrl() {
  if (!IS_BROWSER) return RAW_PORTAL_SERVICE_URL;
  const isProduction = window.location.hostname.endsWith(".dev");
  if (isProduction && PUBLIC_PORTAL_SERVICE_URL) return PUBLIC_PORTAL_SERVICE_URL;
  return RAW_PORTAL_SERVICE_URL;
}

export const PORTAL_SERVICE_URL = resolvePortalServiceUrl();
