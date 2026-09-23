# Portal Client

Infrastructure dashboard for the **Sun** ecosystem — containers, projects,
devices, topology, logs, object storage, web analytics and the shared
component library, backed by [portal-service](../portal-service).

**Live:** [portal.rod.dev](https://portal.rod.dev)

## Pages

| Section        | Route                                          | What it shows                                                        |
| -------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| Infrastructure | `/containers`                                  | Docker containers per device: health, CPU/memory, actions, rollback |
|                | `/projects`                                    | Registry projects as cards or a table, repo sizes and languages     |
|                | `/devices`                                     | Physical devices, live hardware specs and hosted services           |
|                | `/topology`                                    | Dependency graph between services                                    |
|                | `/object-store`                                | MinIO buckets, object browser, search and previews                   |
| Observability  | `/logs`                                        | Live container log streaming (SSE)                                   |
|                | `/web-analytics` (admin)                       | GA4 reports plus first-party session analytics, replays, heatmaps   |
| Integrations   | `/integrations`, `/external-apis`              | Configured API keys; third-party API usage and cost                 |
| Developer      | `/components`, `/hooks`, `/providers`, `/services-library`, `/utilities` | Catalog of `@rodrigo-barraza/components-library`, with live previews |
| System         | `/settings`                                    | Theme and preferences (stored in this browser)                      |

`/` redirects to the landing page chosen in Settings.

## Stack

| Dependency                            | Purpose                              |
| ------------------------------------- | ------------------------------------ |
| Next.js 16 (App Router)               | Framework — standalone output        |
| React 19                              | UI                                   |
| `@rodrigo-barraza/components-library` | Shared components and theme system   |
| `@rodrigo-barraza/utilities-library`  | HTTP client, formatters, vault client |
| Auth.js (next-auth v5)                | Google SSO                           |
| Recharts, rrweb-player                | Charts, session replay               |
| TypeScript 7, oxlint, Vitest          | Type checking, linting, tests        |

## Getting started

```bash
pnpm install
pnpm dev          # http://localhost:4000
```

Configuration comes from the vault; nothing is hardcoded.

- `next.config.ts` loads secrets from vault-service (`VAULT_SERVICE_URL`,
  `VAULT_SERVICE_TOKEN`, or the workspace's `vault-service/vault.key`).
- When the vault is unreachable (common in WSL), the service URLs are derived
  from `../vault-service/projects.json` (`http://<defaultHost>:<port>` and
  `https://<domain>`), via `scripts/registry-service-urls.mjs`.
- A production build that resolves no portal-service URL fails, because the
  browser bundle inlines that URL at build time.
- In the container, `boot.js` fetches the vault's secrets into
  `process.env` before starting the standalone server. It is synced from
  `deploy-kit/templates/client-boot.js`, so edit it there.

| Variable                                               | Used for                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| `PORTAL_SERVICE_URL` / `PORTAL_SERVICE_PUBLIC_URL`     | portal-service, internal (private hosts) / public (the domain) |
| `SESSIONS_SERVICE_URL` / `SESSIONS_SERVICE_PUBLIC_URL` | `/api/sessions/*` proxy for the session tracker              |
| `ACCOUNTS_SERVICE_URL`, `ACCOUNTS_SERVICE_API_SECRET`  | Admin-role lookup at sign-in                                 |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`  | Google SSO (auth is off when the Google pair is unset)       |
| `AUTH_ALLOWED_EMAILS`                                  | Comma-separated emails allowed to sign in                    |

## Auth

- Private-network hosts (localhost, LAN IPs) bypass auth entirely (`src/proxy.ts`).
- On the public domain, pages are viewable signed out. Signing in is limited
  to `AUTH_ALLOWED_EMAILS`.
- `/web-analytics` requires the `admin` role from accounts-service
  (`src/utils/adminAccess.ts`).

## Scripts

```bash
pnpm dev               # dev server on :4000
pnpm build             # production build (prebuild generates the component catalog)
pnpm start             # serve the build on :4000
pnpm typecheck         # tsc (needs the catalog: pnpm catalog:generate)
pnpm lint              # oxlint
pnpm test              # vitest
pnpm format            # prettier
pnpm catalog:generate  # regenerate src/generated/component-catalog.json
pnpm deploy            # build and deploy through ../deploy-kit
```

## Layout

```
portal-client/
├── src/
│   ├── app/
│   │   ├── (portal)/          # every page; its layout mounts the sidebar once
│   │   ├── api/auth/          # Auth.js handlers
│   │   ├── api/sessions/      # proxy to sessions-service
│   │   ├── layout.tsx         # root: theme script, providers, session tracker
│   │   └── page.tsx           # redirect to the chosen landing page
│   ├── components/            # page components and their subfolders
│   ├── lib/                   # settings store, catalog, formatting, storage keys
│   ├── services/              # ApiService (portal-service client), role lookup
│   ├── types/                 # domain types
│   ├── utils/                 # admin access policy
│   ├── auth.ts                # Auth.js config
│   ├── config.ts              # service URLs from the environment
│   └── proxy.ts               # auth gate (Next 16 proxy)
├── scripts/                   # component catalog + registry URL derivation
├── tests/                     # vitest setup and script tests
├── boot.js                    # container entry: vault → env → server
├── Dockerfile, deploy.sh, docker-compose.yml
└── next.config.ts
```

## Related

- **portal-service** — backend API: registry health, Docker, MinIO, GA4, session analytics.
- **vault-service** — secrets and the project registry (`projects.json`).
- **components-library** — shared UI. The Developer pages catalog it.
