// ============================================================
// Web Portal — Secrets Template
// ============================================================
// Secrets are resolved from (in priority order):
//   1. process.env (manual env vars, Docker --env)
//   2. Vault service (via next.config.mjs → VAULT_SERVICE_URL + VAULT_SERVICE_TOKEN)
//   3. Fallback .env file (../vault-service/.env)
//
// See vault-service/.env.example for the full list of variables.
// ============================================================

// PORTAL_CLIENT_PORT=4000
// PORTAL_SERVICE_URL=https://api.portal.rod.dev
