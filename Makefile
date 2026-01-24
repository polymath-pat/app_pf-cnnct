# Variables
APP_NAME := cnnct
COMPOSE  := podman-compose
VENV     := venv
PYTHON   := $(VENV)/bin/python3
PIP      := $(VENV)/bin/pip3
BANDIT   := $(VENV)/bin/bandit

.PHONY: help install build up down test-security test-e2e test-all validate-spec clean

help: ## Show help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

$(VENV)/bin/activate:
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt
	$(PIP) install -r requirements-dev.txt
	@touch $(VENV)/bin/activate

install: $(VENV)/bin/activate ## Create venv and install dependencies

test-security: install ## Run Bandit security audit
	@echo "🛡️  Running Security Audit..."
	$(BANDIT) -r . -x ./$(VENV)

# This target ensures the driver is executable on macOS - ignored on Linux/CI
fix-mac-security: 
	@echo "🔓 Checking for macOS security flags..."
	@if [ "$$(uname)" = "Darwin" ]; then \
		find ~/.wdm/drivers -name "chromedriver" -exec xattr -d com.apple.quarantine {} + 2>/dev/null || true; \
	fi

build: ## Build images
	$(COMPOSE) build --no-cache

up: ## Start stack
	$(COMPOSE) up -d

down: ## Stop stack
	$(COMPOSE) down

test-e2e: up install fix-mac-security ## Run Selenium E2E tests
	@echo "🚀 Running E2E Tests..."
	@sleep 10
	$(PYTHON) tests/e2e_test.py

test-all: test-security test-e2e ## Run full suite
	@echo "✅ All tests passed!"

clean: down
	rm -rf $(VENV)
	podman system prune -f