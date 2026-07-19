// ============================================================
// Web Portal — Next.js Configuration
// ============================================================
// Bootstraps secrets from Vault at startup
// and injects them into process.env for the app.
// ============================================================

import { createVaultClient } from "@rodrigo-barraza/utilities-library/node";
import type { NextConfig } from "next";

// ── Bootstrap secrets at build/dev time ────────────────────────
const vault = createVaultClient();

const secrets = vault.fetchSync();

// Inject into process.env so secrets.js can read them
Object.assign(process.env, secrets);

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [],
  turbopack: {},

  async redirects() {
    return [
      // Page renamed 2026-07: our consumption of third-party APIs.
      { source: "/cloud-usage", destination: "/external-apis", permanent: true },
    ];
  },
  transpilePackages: [
    "@rodrigo-barraza/components-library",
    "@rodrigo-barraza/utilities-library",
  ],

  env: {
    // ── Sessions ──────────────────────────────────────────────
    SESSIONS_SERVICE_URL: secrets.SESSIONS_SERVICE_URL,
    SESSIONS_SERVICE_PUBLIC_URL: secrets.SESSIONS_SERVICE_PUBLIC_URL,
    PORTAL_CLIENT_PORT: secrets.PORTAL_CLIENT_PORT,
    PORTAL_SERVICE_URL: secrets.PORTAL_SERVICE_URL,
    PORTAL_SERVICE_PUBLIC_URL: secrets.PORTAL_SERVICE_PUBLIC_URL,
    NEXT_PUBLIC_PORTAL_SERVICE_URL: secrets.PORTAL_SERVICE_URL,
    NEXT_PUBLIC_PORTAL_SERVICE_PUBLIC_URL: secrets.PORTAL_SERVICE_PUBLIC_URL,
  },
};

export default nextConfig;
