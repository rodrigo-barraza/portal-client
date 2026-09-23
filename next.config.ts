// ============================================================
// Web Portal — Next.js Configuration
// ============================================================
// Bootstraps secrets from Vault at build/dev time and injects
// them into process.env. Service URLs the vault did not return
// are derived from vault-service/projects.json when that file is
// on this machine (dev); a production build without them fails
// instead of shipping a bundle that cannot reach its API.
// ============================================================

import { createVaultClient } from "@rodrigo-barraza/utilities-library/node";
import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { readRegistryServiceUrls } from "./scripts/registry-service-urls.mjs";

/** Services whose URLs the portal needs (see src/config.ts, the sessions
 *  proxy route and the accounts role lookup). */
const SERVICE_PROJECT_IDS = [
  "portal-service",
  "sessions-service",
  "accounts-service",
];

const secrets: Record<string, string | undefined> = Object.fromEntries(
  Object.entries(createVaultClient().fetchSync()).map(([key, value]) => [
    key,
    typeof value === "string" ? value : undefined,
  ]),
);

for (const [key, value] of Object.entries(
  readRegistryServiceUrls(process.cwd(), SERVICE_PROJECT_IDS),
)) {
  secrets[key] ||= value;
}

// Inject into process.env so server code (and the sessions proxy, which
// reads its URLs by name at request time) sees them in dev. A variable
// already exported wins — `PORTAL_SERVICE_URL=http://localhost:<port>`
// points a dev client at a local portal-service.
for (const [key, value] of Object.entries(secrets)) {
  if (value !== undefined && !process.env[key]) process.env[key] = value;
}

const PORTAL_SERVICE_URL = process.env.PORTAL_SERVICE_URL;
const PORTAL_SERVICE_PUBLIC_URL = process.env.PORTAL_SERVICE_PUBLIC_URL;

export default function nextConfig(phase: string): NextConfig {
  if (
    phase === PHASE_PRODUCTION_BUILD &&
    !PORTAL_SERVICE_URL &&
    !PORTAL_SERVICE_PUBLIC_URL
  ) {
    throw new Error(
      "PORTAL_SERVICE_URL is unresolved: the vault was unreachable (check VAULT_SERVICE_URL/VAULT_SERVICE_TOKEN) and vault-service/projects.json is not on this machine. The browser bundle inlines the portal-service URL at build time, so this build could not reach its API.",
    );
  }

  return {
    output: "standalone",
    poweredByHeader: false,

    async redirects() {
      return [
        // Page renamed 2026-07: our consumption of third-party APIs.
        {
          source: "/cloud-usage",
          destination: "/external-apis",
          permanent: true,
        },
      ];
    },
    transpilePackages: [
      "@rodrigo-barraza/components-library",
      "@rodrigo-barraza/utilities-library",
    ],

    // Inlined into the browser bundle at build time — only the two URLs
    // the browser needs. Everything server-side (ACCOUNTS_SERVICE_URL, the
    // sessions proxy URLs, AUTH_*, secrets) is read from process.env at
    // runtime, which boot.js fills from the vault in the container.
    env: {
      NEXT_PUBLIC_PORTAL_SERVICE_URL: PORTAL_SERVICE_URL,
      NEXT_PUBLIC_PORTAL_SERVICE_PUBLIC_URL: PORTAL_SERVICE_PUBLIC_URL,
    },
  };
}
