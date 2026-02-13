# CNNCT | Modern Network Connectivity Tester
[![CI/CD Pipeline](https://github.com/polymath-pat/doap-cnnct/actions/workflows/ci.yaml/badge.svg)](https://github.com/polymath-pat/doap-cnnct/actions/workflows/ci.yaml)

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/polymath-pat/doap-cnnct/tree/main)

A cyberpunk-themed web application for probing network connectivity and diagnostics. CNNCT resolves DNS records, runs HTTP diagnostics, monitors backend health via a consolidated `/health` endpoint, and captures webhook events — all from a multi-panel dashboard UI.

## Features
- **DNS Lookup** — A record resolution for any domain
- **HTTP Diagnostics** — Status codes, response times, download speed, redirects, and content type
- **Consolidated Health** — `/health` endpoint with Valkey, PostgreSQL, OpenSearch, DNS canary, and rate limiter status
- **System Status Terminal** — Always-visible terminal-style card showing real-time service health
- **Webhook Events** — Always-visible live-polling webhook feed with pagination and RSS
- **Webhook Timer** — Background self-ping that round-robins through DNS and HTTP diag tests
- **Shareable URLs** — Query params (`?tab=dns&target=google.com`) auto-fill and submit tests
- **Quick-Test Presets** — Per-tab preset targets (domains for DNS, URLs for HTTP Diag)
- **Export Results** — Copy any result as formatted JSON
- **Test History** — Recent tests saved to localStorage
- **Cyberpunk UI** — Neon glow borders, glitch title animation, scanline overlay, clipped corner cards, terminal status panel

## Tech Stack
- **Frontend**: TypeScript, Vite, Tailwind CSS, Press Start 2P / Orbitron / Share Tech Mono fonts
- **Backend**: Python 3.11 (Flask + Gunicorn)
- **Rate Limiting**: Managed Valkey (Redis-compatible) via flask-limiter
- **Database**: Managed PostgreSQL for webhook event storage
- **Logging**: OpenSearch for application logs, request logs, and database log forwarding
- **Containers**: Podman / Docker with multi-stage builds
- **Infrastructure**: DigitalOcean App Platform, managed via Pulumi
- **CI/CD**: GitHub Actions (security scan, unit tests, E2E Selenium browser tests, auto-deploy)

## Architecture

```
                    ┌──────────────────────────┐
                    │     DO App Platform       │
                    │                           │
                    │  frontend (static site)   │
                    │  backend-api (Gunicorn)   │
                    └─────┬──────┬──────┬───────┘
                          │      │      │
              ┌───────────┘      │      └───────────┐
              ▼                  ▼                  ▼
      ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
      │ Managed       │  │ Managed      │  │ OpenSearch        │
      │ Valkey        │  │ PostgreSQL   │  │ Droplet           │
      │ (rate limits) │  │ (webhooks)   │  │ (logs)            │
      └──────────────┘  └──────────────┘  └──────────────────┘
```

- **DNS**: `cnnct.metaciety.net` CNAME managed by Pulumi
- **Trusted Sources**: Database firewalls restrict access to the app and OpenSearch droplet via tags
- **Log Forwarding**: PostgreSQL and Valkey logs forwarded to OpenSearch via DO native logsinks

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/healthz` | GET | Lightweight liveness probe (rate-limit exempt) |
| `/health` | GET | Consolidated health check for all backend services |
| `/dns/<domain>` | GET | DNS A record resolution |
| `/diag?url=` | GET | HTTP diagnostic (status, timing, speed, redirects) |
| `/status` | GET | Valkey/Redis connection status |
| `/db-status` | GET | PostgreSQL connection status |
| `/webhook-receive/<secret>` | POST | Receive incoming webhooks |
| `/webhook-results` | GET | Retrieve stored webhook results |
| `/webhook-results/rss` | GET | Webhook results as RSS feed |

## Getting Started

### Prerequisites
- [Podman](https://podman.io/) (or Docker) + podman-compose (or docker-compose)
- Python 3.11+

### Local Development
```bash
git clone https://github.com/polymath-pat/doap-cnnct.git
cd doap-cnnct
make infra-up
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8081

### Testing
```bash
make test-security    # Bandit security audit
make test-unit        # Pytest unit tests
make test-e2e         # Selenium browser tests (requires infra-up)
make test-all         # Full pipeline: security, unit, infra, e2e, cleanup
make clean            # Stop containers and remove caches
```

## Deployment

Merges to `main` automatically build, push, and deploy to [cnnct.metaciety.net](https://cnnct.metaciety.net) via GitHub Actions and Pulumi.

## License

MIT
