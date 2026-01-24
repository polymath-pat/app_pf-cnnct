# Variables
APP_NAME := cnnct
COMPOSE  := podman-compose
PYTHON   := python3
PIP      := $(PYTHON) -m pip

# Colors for help documentation
BLUE   := \033[36m
RESET  := \033[0m

.PHONY: help install build up down restart test-security test-e2e test-all validate-spec clean

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(BLUE)%-20s$(RESET) %s\n", $$1, $$2}'

# --- Environment Setup ---

install: ## Install production and dev dependencies
	$(PIP) install -r requirements.txt
	$(PIP) install -r requirements-dev.txt

# --- Container Lifecycle ---

build: ## Build images using podman-compose
	$(COMPOSE) build --no-cache

up: ## Spin up the full stack (Frontend, Backend, Redis)
	$(COMPOSE) up -d

down: ## Stop and remove containers and networks
	$(COMPOSE) down

restart: down up ## Restart the local stack

# --- Quality Assurance & Testing ---

test-security: ## Run Bandit security audit (CWE-605 checks)
	@echo "🛡️  Running Bandit Security Audit..."
	bandit -r . -x ./venv

validate-spec: ## Validate DigitalOcean App Spec (.do/app.yaml)
	@echo "🔍 Validating DigitalOcean App Spec..."
	doctl apps spec validate .do/app.yaml

test-e2e: up ## Run Headless Selenium E2E tests against local stack
	@echo "🚀 Running Selenium E2E Tests..."
	@sleep 7  # Wait for Podman networking to settle
	$(PYTHON) tests/e2e_test.py

test-all: test-security validate-spec test-e2e ## Run the full local audit and test suite
	@echo "✅ All local checks and E2E tests passed!"

# --- Maintenance ---

clean: down ## Remove containers and prune unused podman resources
	podman system prune -f
	rm -rf .pytest_cache
	rm -f e2e_error.png