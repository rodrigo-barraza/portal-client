// ============================================================
// Portal Client — Standalone Boot Script
// ============================================================
// Bootstraps secrets from Vault into process.env before
// starting the Next.js standalone server.
//
// In standalone mode, next.config.mjs does NOT run at startup,
// so runtime secrets (like auth credentials) must be fetched
// here. Uses only Node.js built-ins — no external dependencies.
//
// Required env vars (from .env.deploy → Docker .env):
//   VAULT_SERVICE_URL    — e.g. http://192.168.86.2:5599
//   VAULT_SERVICE_TOKEN  — bearer token for vault auth
// ============================================================

const VAULT_URL = process.env.VAULT_SERVICE_URL;
const VAULT_TOKEN = process.env.VAULT_SERVICE_TOKEN;
const FETCH_TIMEOUT_MS = 5_000;

async function bootstrap() {
  if (VAULT_URL && VAULT_TOKEN) {
    try {
      const res = await fetch(`${VAULT_URL}/secrets`, {
        headers: { Authorization: `Bearer ${VAULT_TOKEN}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} — ${res.statusText}`);
      }

      const secrets = await res.json();
      let injected = 0;

      for (const [key, value] of Object.entries(secrets)) {
        // Don't overwrite values already set by Docker env / .env
        if (process.env[key] === undefined || process.env[key] === "") {
          process.env[key] = value;
          injected++;
        }
      }

      console.log(`🔐 Vault → injected ${injected} secrets (${Object.keys(secrets).length} total)`);
    } catch (err) {
      console.warn(`⚠️  Vault unreachable (${err.message}) — continuing with env vars only`);
    }
  } else {
    console.warn("⚠️  No VAULT_SERVICE_URL/TOKEN — skipping vault bootstrap");
  }

  // Start the Next.js standalone server
  await import("./server.js");
}

bootstrap();
