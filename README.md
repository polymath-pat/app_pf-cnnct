# CNNCT | Modern Network Connectivity Tester
[![CI/CD Pipeline](https://github.com/polymath-pat/doap-cnnct/actions/workflows/ci.yaml/badge.svg)](https://github.com/polymath-pat/doap-cnnct/actions/workflows/ci.yaml)

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/polymath-pat/doap-cnnct/tree/main)

A glassmorphic web application for probing network connectivity and diagnostics. CNNCT tests TCP port connectivity, resolves DNS records, runs HTTP diagnostics, and reports backend health — all from a single UI.

## Features
- **Port Check** — TCP connectivity probe on port 443 with latency measurement
- **DNS Lookup** — A record resolution for any domain
- **HTTP Diagnostics** — Status codes, response times, download speed, redirects, and content type
- **Backend Status** — Redis/Valkey health, memory usage, connected clients, and uptime
- **Quick-Test Presets** — One-click preset targets for fast probing
- **Export Results** — Copy any result as formatted JSON
- **Test History** — Recent tests saved to localStorage

## Tech Stack
- **Frontend**: TypeScript, Vite, Tailwind CSS
- **Backend**: Python 3.11 (Flask + Gunicorn)
- **Rate Limiting**: Managed Valkey (Redis-compatible) via flask-limiter
- **Containers**: Podman / Docker with multi-stage builds
- **Infrastructure**: DigitalOcean App Platform, managed via Pulumi
- **CI/CD**: GitHub Actions (security scan, unit tests, E2E browser tests, auto-deploy)

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
