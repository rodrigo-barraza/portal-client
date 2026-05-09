# Portal Client

Infrastructure monitoring dashboard for the **Sun** ecosystem — displays real-time service health, response times, topology maps, and analytics across all deployed services.

**Live:** [portal.rod.dev](https://portal.rod.dev)

## Features

- **Service Dashboard** — Card and table views of all services with health status, response times, ports, and domains
- **Topology Map** — Visual dependency graph of inter-service connections
- **Analytics** — Usage and performance charts across the ecosystem
- **Devices** — Device monitoring and management
- **Integrations** — External integration status
- **Logs** — Centralized log viewer
- **Google SSO** — Auth via NextAuth.js with allowed-email gating

## Stack

| Dependency | Purpose |
|---|---|
| Next.js 16 | React framework (App Router) |
| React 19 | UI library |
| `@rodrigo-barraza/components-library` | Shared component library |
| `@rodrigo-barraza/utilities-library` | Shared utility functions |
| Lucide React | Icons |
| Luxon | Date/time formatting |
| NextAuth.js | Google SSO authentication |
| Recharts | Analytics charts |

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment
cp .env.example .env

# 3. Start development server
npm run dev
```

## Environment

Secrets are resolved in priority order:

1. `process.env` (manual env vars, Docker `--env`)
2. Local `.env` file
3. Vault service (`VAULT_SERVICE_URL` + `VAULT_SERVICE_TOKEN`)
4. Shared `../vault-service/.env` fallback

| Variable | Description |
|---|---|
| `PORTAL_PORT` | Dev server port |
| `VAULT_SERVICE_URL` | Vault service endpoint |
| `PORTAL_API_URL` | Portal service backend URL |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_SECRET` | NextAuth.js session secret |
| `AUTH_ALLOWED_EMAILS` | Comma-separated allowed emails |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on configured port |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |
| `npm run deploy` | Build & deploy to Synology NAS |
| `npm run deploy:dry` | Dry-run deploy (validate only) |

## Architecture

```
portal-client/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── analytics/          # Analytics dashboard page
│   │   ├── api/auth/           # NextAuth.js route handler
│   │   ├── devices/            # Devices page
│   │   ├── integrations/       # Integrations page
│   │   ├── logs/               # Log viewer page
│   │   ├── services/           # Service detail page
│   │   └── topology/           # Topology map page
│   ├── components/             # React components
│   ├── constants/              # Service type definitions
│   └── services/               # API service layer
├── boot.js                     # Vault bootstrap
├── config.js                   # Runtime configuration
├── secrets.js                  # Secret resolution (gitignored)
├── next.config.mjs             # Next.js + Vault bootstrap
└── deploy.sh                   # Synology NAS deploy script
```

## Related Services

- **portal-service** (`:4001`) — Backend API for project registry, health checks, and analytics
- **vault-service** (`:5599`) — Centralized secrets and project registry
