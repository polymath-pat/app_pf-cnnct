# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CNNCT is a network connectivity tester — a full-stack web application for probing network connectivity and diagnostics. It consists of a Flask backend, vanilla TypeScript/Vite frontend, managed Valkey (Redis) for rate limiting, PostgreSQL for webhook storage, optional OpenSearch for logging, and is deployed to DigitalOcean via Pulumi.

## Build & Test Commands

All automation is managed through the Makefile:

```bash
make test-all         # Full pipeline: security → unit → infra → e2e → cleanup
make test-security    # Bandit security audit on ./src
make test-unit        # Pytest unit tests (PYTHONPATH=. pytest tests/unit_test.py)
make build-frontend   # Build frontend with Vite (standalone, not needed for infra-up)
make infra-up         # Build containers and start docker-compose (frontend builds inside container)
make infra-down       # Stop containers
make test-e2e         # Run Selenium browser tests (requires infra-up first)
make push-tester      # Push E2E test image to DOCR
make clean            # Full cleanup (venv + containers + cache)
```

Frontend-specific commands (run from `frontend/` directory):
```bash
npm run dev           # Vite dev server with hot reload
npm run build         # TypeScript compile + Vite bundle
npm run lint          # ESLint (--max-warnings 0)
npm run typecheck     # TypeScript type checking (tsc --noEmit)
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│         FRONTEND (Vite + TypeScript + Tailwind CSS)         │
│  - Vanilla TS, no framework (direct DOM manipulation)       │
│  - 3 tabs: DNS Lookup, HTTP Diagnostic, Status/Webhook Feed │
│  - localStorage for test history                            │
│  - Cyberpunk theme: glassmorphism, neon borders, scanlines  │
└────────────────────────┬────────────────────────────────────┘
                         │
              [DO App Platform Ingress]
              /api/* → backend-api:8080
              /*     → frontend static site
                         │
┌────────────────────────┴────────────────────────────────────┐
│              BACKEND (Flask + Gunicorn, 2 workers)          │
│  Routes:                                                    │
│    /healthz              - Liveness probe (rate-limit exempt)│
│    /health               - Consolidated health check        │
│    /cnnct?target=        - TCP port 443 connectivity probe  │
│    /dns/<domain>         - DNS resolution + A records       │
│    /diag?url=            - HTTP diagnostic + speed test     │
│    /status               - Valkey/Redis health              │
│    /db-status            - PostgreSQL health                │
│    /webhook-receive/<s>  - Incoming webhook receiver (POST) │
│    /webhook-results      - Stored webhook events (JSON)     │
│    /webhook-results/rss  - Webhook events as RSS 2.0 feed  │
│                                                             │
│  Rate Limiting: 100/hour, 20/minute (flask-limiter)         │
│  Custom per-endpoint limits (e.g., /dns 10/min, /diag 5/min)│
└──────────┬─────────────────────────────┬────────────────────┘
           │                             │
┌──────────┴──────────┐    ┌─────────────┴───────────┐
│   Managed Valkey    │    │   Managed PostgreSQL    │
│   (DO Database)     │    │   (DO Database)         │
│   Rate limit state  │    │   Webhook event storage │
└─────────────────────┘    └─────────────────────────┘
```

## Local Development

- `make infra-up` builds and starts all containers (frontend builds inside its multi-stage Dockerfile)
- Frontend URL: http://localhost:3000 (Nginx)
- Backend URL: http://localhost:8081 (Flask via Docker)
- Vite dev proxy forwards `/api/*` to `http://127.0.0.1:8080`
- Containers use podman/podman-compose
- Docker Compose runs: backend, frontend (Nginx), redis, postgres

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `REDIS_URL` | Valkey/Redis connection string | `memory://` (in-memory fallback) |
| `DATABASE_URL` | PostgreSQL connection string | None (optional, memory fallback) |
| `WEBHOOK_SECRET` | Secret token for webhook endpoint | None (webhook disabled if unset) |
| `WEBHOOK_DNS_TARGET` | Domain for webhook DNS lookups | `example.com` |
| `WEBHOOK_TIMER_INTERVAL` | Seconds between webhook self-pings | None (disabled if unset) |
| `OPENSEARCH_URL` | OpenSearch connection for request logs | None (logging disabled if unset) |
| `CANARY_DOMAIN` | Domain for DNS canary health check | `cnnct.metaciety.net` |
| `GITHUB_SHA` | Git commit SHA for version tracking | None |
| `HOST` / `PORT` | Server binding | `0.0.0.0` / `8080` |

## Key Files

| File | Purpose |
|------|---------|
| `src/app.py` | Core backend API (9+ endpoints, ~594 lines) |
| `src/models.py` | SQLAlchemy models: User, WebhookEvent |
| `src/opensearch_handler.py` | Buffered logging handler for OpenSearch |
| `src/webhook_timer.py` | Background webhook self-pinger (file-locked, one per worker) |
| `src/migrations/` | Flask-Migrate (Alembic) schema migrations |
| `frontend/src/main.ts` | Frontend UI logic and state (~509 lines) |
| `frontend/index.html` | HTML entry point (cyberpunk themed) |
| `frontend/nginx.conf` | Nginx reverse proxy config (SPA fallback + /api/ proxy) |
| `frontend/Dockerfile` | Multi-stage build: Node 20 (build) → Nginx (serve) |
| `backend.Dockerfile` | Python 3.11-slim + Gunicorn |
| `docker-entrypoint.sh` | Flask migration runner (strict mode) |
| `docker-compose.yaml` | Local dev: backend, frontend, redis, postgres |
| `Makefile` | Build automation and local dev |
| `.github/workflows/ci.yaml` | Main CI/CD pipeline |
| `.github/workflows/deploy.yaml` | Manual Pulumi deploy trigger (workflow_dispatch) |
| `index.ts` | Pulumi infrastructure definition (~150+ lines) |
| `Pulumi.yaml` | Pulumi project config (runtime: nodejs) |
| `Pulumi.prod.yaml` | Pulumi prod stack config (encrypted secrets) |
| `package.json` | Root package.json for Pulumi dependencies |
| `tests/unit_test.py` | API unit tests (pytest + requests-mock + unittest.mock) |
| `tests/e2e_test.py` | Selenium headless Chrome browser tests |
| `tests/e2e.Dockerfile` | Selenium + Python container for CI E2E tests |
| `API.md` | API endpoint documentation |

## Code Conventions

### Python (Backend)
- **Imports**: Conditional try/except for `src.models` vs `models` (supports running from different contexts)
- **Logging**: Standard `logging` module to stdout; optional OpenSearch forwarding
- **Error handling**: Try/except with logging; graceful fallbacks for all external services
- **Naming**: snake_case for functions/variables, PascalCase for classes, UPPER_CASE for constants
- **Security**: Bandit scan in CI; `# nosec` comments for intentional exceptions (e.g., B104 binding 0.0.0.0)
- **Rate limiting**: Global defaults + custom per-endpoint decorators

### TypeScript (Frontend)
- **Framework**: None — vanilla TypeScript with direct DOM manipulation
- **Strict mode**: `tsconfig.json` has `strict: true`
- **Styling**: Tailwind CSS v4 (utility-first), cyberpunk theme with custom CSS classes
- **State**: Global variables + localStorage (no state management library)
- **Linting**: ESLint with `--max-warnings 0`

### Database
- **Table names**: snake_case plural (`users`, `webhook_events`)
- **Primary keys**: UUID (`as_uuid=True`)
- **Timestamps**: `DateTime(timezone=True)` with UTC default
- **JSON fields**: PostgreSQL JSONB for flexible payload storage

### General
- **Files**: snake_case (`app.py`, `unit_test.py`, `docker-entrypoint.sh`)
- **DOM IDs**: kebab-case (`probe-form`, `status-meta`, `webhook-results-area`)
- **CSS classes**: Tailwind utilities + custom names (`cyber-card`, `neon-border`, `terminal-ok`)

## Resilience Patterns

The backend is designed for graceful degradation:
- **Redis unavailable**: Falls back to in-memory rate limiting
- **PostgreSQL unavailable**: Falls back to in-memory webhook storage (FIFO, 50-item limit)
- **OpenSearch unavailable**: Request logging silently disabled
- **Webhook secret unset**: Webhook endpoint returns "not configured"

All external service dependencies are optional — the core connectivity tools (/cnnct, /dns, /diag) work with zero infrastructure beyond the Flask process.

## CI/CD Pipeline

GitHub Actions pipeline in `.github/workflows/ci.yaml`:

```
┌──────────────┐  ┌─────────────┐
│ Security Scan│  │ Unit Tests  │   ← Run in parallel
└──────┬───────┘  └──────┬──────┘
       └────────┬────────┘
                ▼
       ┌────────────────┐
       │ E2E Browser    │   ← Needs both to pass
       │ Tests          │
       └───────┬────────┘
               ▼
       ┌────────────────┐
       │ Build & Push   │   ← main branch only
       │ Backend Image  │
       └───────┬────────┘
               ▼
       ┌────────────────┐
       │ Pulumi Deploy  │   ← main branch only
       └────────────────┘
```

- Triggers on push to `main` and PRs to `main`, `feature/**`, `fix/**`, `bug/**`
- Security and unit tests run in parallel with pip caching
- E2E tests use podman for both infrastructure and Selenium test runner
- Build & Push tags backend image with git SHA, pushes to DOCR
- Deploy runs `pulumi up --stack prod`
- Separate `deploy.yaml` workflow allows manual deploys with custom image tags
- E2E failure screenshots uploaded to DO Spaces as artifacts

## Infrastructure (Pulumi)

All infrastructure is defined in `index.ts` and managed by Pulumi with a self-hosted S3 backend on DigitalOcean Spaces.

### Resources managed by Pulumi
- **DO App Platform** (`cnnct`) — Backend API service + frontend static site
- **Managed Valkey cluster** (v8, db-s-1vcpu-1gb) — Rate limiting state
- **Managed PostgreSQL** (v16, db-s-1vcpu-1gb) — Webhook event storage
- **DNS CNAME record** — `cnnct.metaciety.net` → app ingress URL
- **Database firewalls** — Restrict access to app + opensearch tag

### Pulumi State Backend
- Stored in DO Spaces bucket `doap-cnnct` (SFO3 region)
- Login: `pulumi login 's3://doap-cnnct?endpoint=sfo3.digitaloceanspaces.com'`
- Requires `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION=us-east-1`

### Pulumi Local Usage
```bash
# Set environment
export AWS_ACCESS_KEY_ID=<spaces-access-key>
export AWS_SECRET_ACCESS_KEY=<spaces-secret-key>
export AWS_REGION=us-east-1
export PULUMI_CONFIG_PASSPHRASE=<passphrase>
export DIGITALOCEAN_TOKEN=<do-api-token>

# Login to state backend
pulumi login 's3://doap-cnnct?endpoint=sfo3.digitaloceanspaces.com'

# Preview changes without applying
pulumi preview --stack prod

# Apply changes
pulumi up --stack prod
```

### GitHub Secrets Required
| Secret | Purpose |
|--------|---------|
| `DIGITALOCEAN_ACCESS_TOKEN` | DO API token (used by doctl and Pulumi provider) |
| `SPACES_ACCESS_KEY` | DO Spaces access key (Pulumi state backend auth) |
| `SPACES_SECRET_KEY` | DO Spaces secret key (Pulumi state backend auth) |
| `PULUMI_PASSPHRASE` | Decrypts Pulumi stack config encryption salt |

## Deployment

- **Production URL:** cnnct.metaciety.net
- **Platform:** DigitalOcean App Platform (SFO3)
- **Container Registry:** DigitalOcean Container Registry (`kadet-cantu`)
- **Databases:** Managed Valkey (SFO3) + Managed PostgreSQL (SFO3)
- **DNS:** Managed in DigitalOcean, CNAME created by Pulumi
- **Backend image tag:** Tagged with git SHA on each deploy
- **Frontend:** Built from GitHub source by DO App Platform (main branch, /frontend dir)
