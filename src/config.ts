// ============================================================
// Web Portal — Runtime Configuration
// ============================================================
// Typed accessor layer over process.env. The Vault service is
// the single source of truth — next.config.ts hydrates
// process.env from the Vault (falling back to URLs derived from
// vault-service/projects.json in dev) before any module runs,
// and fails a production build that could not resolve them.
//
// This file contains NO defaults, NO hosts and NO secrets.
//
// Browser requests must NEVER hit LAN addresses when the page is
// served from a public host — that triggers Chrome's Private
// Network Access prompt and mixed-content blocks. So:
//   • page on a private host (localhost / LAN IP) → internal URL
//   • page on a public host (the portal domain)   → public URL
//   • server-side (SSR, route handlers)           → internal URL
// ============================================================

import { isPrivateHost } from "@/utils/adminAccess";

/** projectId this client reports to sessions-service under. */
export const PROJECT_NAME = "portal";

// ── Raw values ─────────────────────────────────────────────────
// NEXT_PUBLIC_ vars are inlined at build time (next.config `env`); the
// unprefixed ones are the server's runtime environment (boot.js fills it
// from the vault inside the container).
const INTERNAL_PORTAL_SERVICE_URL =
  process.env.NEXT_PUBLIC_PORTAL_SERVICE_URL || process.env.PORTAL_SERVICE_URL;

const PUBLIC_PORTAL_SERVICE_URL =
  process.env.NEXT_PUBLIC_PORTAL_SERVICE_PUBLIC_URL ||
  process.env.PORTAL_SERVICE_PUBLIC_URL;

/**
 * Pick the portal-service base URL for where this code runs. Exported for
 * tests; the app uses {@link PORTAL_SERVICE_URL}.
 */
export function resolvePortalServiceUrl({
  pageHost,
  internalUrl,
  publicUrl,
}: {
  /** `location.host` of the page, or null on the server. */
  pageHost: string | null;
  internalUrl: string | undefined;
  publicUrl: string | undefined;
}): string {
  const preferPublic = pageHost !== null && !isPrivateHost(pageHost);
  const resolved = preferPublic
    ? publicUrl || internalUrl
    : internalUrl || publicUrl;
  return (resolved ?? "").replace(/\/+$/, "");
}

/** portal-service base URL, without a trailing slash ("" if unresolved). */
export const PORTAL_SERVICE_URL = resolvePortalServiceUrl({
  pageHost: typeof window === "undefined" ? null : window.location.host,
  internalUrl: INTERNAL_PORTAL_SERVICE_URL,
  publicUrl: PUBLIC_PORTAL_SERVICE_URL,
});

// ── Accounts service (role lookup at sign-in) ──────────────────
// Server-side only (NextAuth callbacks), read from the runtime
// environment. The URL may be public; the secret is not.
export const ACCOUNTS_SERVICE_URL = process.env.ACCOUNTS_SERVICE_URL;

// Server-only shared secret for accounts-service internal endpoints.
// NO NEXT_PUBLIC_ fallback — must never be inlined into a client bundle.
export const ACCOUNTS_SERVICE_API_SECRET =
  process.env.ACCOUNTS_SERVICE_API_SECRET || "";
