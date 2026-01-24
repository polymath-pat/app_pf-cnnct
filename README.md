# CNNCT | Modern Network Connectivity Tester
[![CI/CD Pipeline](https://github.com/polymath-pat/doap-cnnct/actions/workflows/ci.yaml/badge.svg)](https://github.com/polymath-pat/doap-cnnct/actions/workflows/ci.yaml)

A modern, glassmorphic web application for probing network connectivity. Designed for reliability and speed, CNNCT provides real-time status updates for common service ports (80, 443) and HTTP availability.

## 🚀 Features
- **Modern Glassmorphic UI**: High-contrast, interactive interface with real-time feedback and backdrop blur effects.
- **Automated Probing**: Tests TCP connectivity and HTTP status codes via a Flask backend.
- **Scalable Architecture**: Built with Node.js, Python, and Valkey (Redis successor) for rate-limiting.
- **Full CI/CD**: Modular testing pipeline with automated E2E validation and deployment to DigitalOcean.

## 🛠 Tech Stack
- **Frontend**: Vite, React, Tailwind CSS
- **Backend**: Python (Flask), Valkey/Redis
- **Containerization**: Podman-Compose / Docker-Compose
- **Infrastructure**: DigitalOcean App Platform

## 📦 Getting Started

### Prerequisites
- [Podman](https://podman.io/) or Docker
- [Podman-compose](https://github.com/containers/podman-compose) or Docker-compose
- Python 3.11+ (for local virtual environment)

### Local Development
1. **Clone the repository**:
   ```bash
   git clone [https://github.com/polymath-pat/doap-cnnct.git](https://github.com/polymath-pat/doap-cnnct.git)
   cd doap-cnnct