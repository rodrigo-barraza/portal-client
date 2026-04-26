// ============================================================
// Web Portal — Next.js Configuration
// ============================================================
// Bootstraps secrets from Vault (or .env fallback) at startup
// and injects them into process.env for the app.
// ============================================================

import { createVaultClient } from "./utils/vault-client.js";

// ── Bootstrap secrets at build/dev time ────────────────────────
const vault = createVaultClient({
  fallbackEnvFile: "../vault/.env",
});

const secrets = await vault.fetch();

// Inject into process.env so secrets.js can read them
Object.assign(process.env, secrets);

/**
 * Replace private-network hostnames with `localhost` so the browser
 * (running on Windows) can reach the service via port-forwarding.
 */
function normaliseForBrowser(urlStr) {
  try {
    const u = new URL(urlStr);
    if (/^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(u.hostname)) {
      u.hostname = "localhost";
    }
    return u.toString().replace(/\/$/, ""); // strip trailing slash
  } catch {
    return urlStr;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["portal.clankerbox.com"],
  turbopack: {},

  // Expose resolved values to both server and client bundles.
  // The browser runs on Windows and can't reach WSL's internal LAN IP
  // (e.g. 192.168.86.99), so we normalise the URL to localhost — Windows
  // port-forwarding routes it into WSL transparently.
  env: {
    PORTAL_PORT: secrets.PORTAL_PORT || "4000",
    PORTAL_API_URL: normaliseForBrowser(
      secrets.PORTAL_API_URL || "http://localhost:4001",
    ),
  },
};

export default nextConfig;
