#!/bin/bash
# ============================================================
# Portal Client — Build & Deploy to Synology NAS
#
# Thin wrapper — all logic lives in ../deploy-kit/lib.sh
# Hook: passes VAULT_SERVICE_URL and AUTH_URL as build args and
#       VAULT_SERVICE_TOKEN as a BuildKit secret (Next.js resolves
#       its service URLs from the vault at build time). URLs not set
#       in deploy-kit/.env.deploy are derived from
#       vault-service/projects.json — never hardcoded here.
# Extra: --network=host for build, 30 tail lines
#
# Usage:
#   npm run deploy              # full deploy
#   npm run deploy -- --dry-run # validate without deploying
#   npm run deploy -- --skip-pull
#   npm run deploy -- --no-cache
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE_NAME="portal-client"
DISPLAY_NAME="🖥️ Portal Client"
BUILD_EXTRA_FLAGS="--network=host"
BUILD_TAIL_LINES=30

# ── Inject Vault credentials for Docker build ─────────────────
PRE_BUILD() {
  local CENTRAL_ENV="${DEPLOY_KIT_DIR}/.env.deploy"
  if [ -f "$CENTRAL_ENV" ]; then
    set -a; source "$CENTRAL_ENV"; set +a
    info "Loaded deploy-kit/.env.deploy"
  fi
  # KEY=VALUE lines derived from the registry (the Dockerfile requires both).
  local REGISTRY_URLS
  REGISTRY_URLS="$(node "${SCRIPT_DIR}/scripts/registry-service-urls.mjs" vault-service portal-client)"
  registry_url() { printf '%s\n' "$REGISTRY_URLS" | sed -n "s/^$1=//p"; }

  VAULT_SERVICE_URL="${VAULT_SERVICE_URL:-$(registry_url VAULT_SERVICE_URL)}"
  AUTH_URL="${AUTH_URL:-$(registry_url PORTAL_CLIENT_PUBLIC_URL)}"
  [ -n "$VAULT_SERVICE_URL" ] || fail "VAULT_SERVICE_URL unresolved — set it in deploy-kit/.env.deploy or check vault-service/projects.json"
  [ -n "$AUTH_URL" ] || fail "AUTH_URL unresolved — portal-client has no domain in vault-service/projects.json"

  BUILD_ARGS="--build-arg VAULT_SERVICE_URL=${VAULT_SERVICE_URL} --build-arg AUTH_URL=${AUTH_URL}"
  info "Vault URL: ${VAULT_SERVICE_URL}"
  info "Auth URL: ${AUTH_URL}"
  if [ -n "${VAULT_SERVICE_TOKEN:-}" ]; then
    BUILD_SECRETS="--secret id=VAULT_SERVICE_TOKEN,env=VAULT_SERVICE_TOKEN"
    info "Vault token: ****${VAULT_SERVICE_TOKEN: -8}"
  fi
}

source "${SCRIPT_DIR}/../deploy-kit/lib.sh"
