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

It looks like there was a rendering issue with the Markdown block. Here is the full, updated **README.md** for your repository, including the build status badge and the project details.

```markdown
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
```

2. **Spin up the environment**:
```bash
make test-all
```

*This modular command handles: virtual environment setup (`virt-env`), container builds, infrastructure startup, security audits, and E2E testing.*
3. **Access the app**:
Open [http://localhost:8081](https://www.google.com/search?q=http://localhost:8081) in your browser.

## 🧪 Testing

The project uses a modular testing suite defined in the `Makefile`:

* **Virtual Env**: `make virt-env`
* **Security Audit**: `make test-security` (using Bandit)
* **E2E Execution**: `make run-e2e` (using Selenium/ChromeDriver)
* **Full Clean**: `make clean`

## 🌐 Deployment

The app is automatically deployed to [cnnct.metaciety.net](https://cnnct.metaciety.net) upon a successful "Quality Gate" pass on the `main` branch.

**Preview Environments:** Every Pull Request generates an ephemeral DigitalOcean environment for testing features before they are merged.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.
