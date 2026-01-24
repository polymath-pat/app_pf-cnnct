# Variables
APP_NAME := cnnct
COMPOSE  := podman-compose
VENV     := venv
# Direct paths to venv binaries for macOS and Linux runners
PYTHON   := $(VENV)/bin/python3
PIP      := $(VENV)/bin/pip3
BANDIT   := $(VENV)/bin/bandit

.PHONY: help install build up down restart test-security test-e2e test-all validate-spec fix-mac-security clean

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

$(VENV)/bin/activate: ## Create virtualenv and install dependencies
	@echo "🌱 Creating Virtual Environment..."
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt
	$(PIP) install -r requirements-dev.txt
	@touch $(VENV)/bin/activate

install: $(VENV)/bin/activate ## Install dependencies into venv

# --- Container Lifecycle ---

build: ## Build images using podman-compose
	$(COMPOSE) build --no-cache

up: ## Start the local stack
	$(COMPOSE) up -d

down: ## Stop and remove containers
	$(COMPOSE) down

restart: down up ## Restart the stack

# --- Quality Assurance & Testing ---

test-security: install ## Run Bandit security audit
	@echo "🛡️  Running Security Audit..."
	$(BANDIT) -r . -x ./$(VENV)

validate-spec: ## Validate DigitalOcean App Spec
	@echo "🔍 Validating App Spec..."
	doctl apps spec validate .do/app.yaml

fix-mac-security: ## Remove macOS quarantine from downloaded drivers
	@echo "🔓 Removing macOS quarantine flags..."
	-find ~/.wdm/drivers -name "chromedriver" -exec xattr -d com.apple.quarantine {} + 2>/dev/null || true

test-e2e: up install fix-mac-security ## Run Selenium E2E tests
	@echo "🚀 Running E2E Tests..."
	@sleep 7
	$(PYTHON) tests/e2e_test.py

test-all: test-security validate-spec test-e2e ## Run full suite (Security + Spec + E2E)
	@echo "✅ All tests passed!"

# --- Maintenance ---

clean: down