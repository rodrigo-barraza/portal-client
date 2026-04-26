// ============================================================
// Web Portal — Secrets Template
// ============================================================
// Secrets are resolved from (in priority order):
//   1. process.env (manual env vars, Docker --env)
//   2. Vault service (via next.config.mjs → VAULT_URL + VAULT_TOKEN)
//   3. Fallback .env file (../vault/.env)
//
// See vault/.env.example for the full list of variables.
// ============================================================

// PORTAL_PORT=4000
// PORTAL_API_URL=http://localhost:4001
