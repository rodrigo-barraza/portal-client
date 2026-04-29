// ============================================================
// Web Portal — Next.js Configuration
// ============================================================
// Bootstraps secrets from Vault (or .env fallback) at startup
// and injects them into process.env for the app.
// ============================================================

import { createVaultClient } from "@rodrigo-barraza/utilities/node";

// ── Bootstrap secrets at build/dev time ────────────────────────
const vault = createVaultClient({
  localEnvFile: "./.env",
  fallbackEnvFile: "../vault-service/.env",
});

const secrets = await vault.fetch();

// Inject into process.env so secrets.js can read them
Object.assign(process.env, secrets);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  allowedDevOrigins: [],
  turbopack: {},
  transpilePackages: ["@rodrigo-barraza/components", "@rodrigo-barraza/utilities"],

  env: {
    PORTAL_CLIENT_PORT: secrets.PORTAL_CLIENT_PORT || "4000",
    PORTAL_SERVICE_URL: secrets.PORTAL_SERVICE_URL || "http://localhost:4001",
  },
};

export default nextConfig;
