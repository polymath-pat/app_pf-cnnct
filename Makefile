# Variables
APP_NAME := cnnct
COMPOSE  := podman-compose
VENV     := venv
PYTHON   := $(VENV)/bin/python3
PIP      := $(VENV)/bin/pip3
BANDIT   := $(VENV)/bin/bandit

.PHONY: help install build up down test-security test-e2e test-all clean fix-mac-security

help: ## Show help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

$(VENV)/bin/activate:
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt
	$(PIP) install -r requirements-dev.txt
	@touch $(VENV)/bin/activate

install: $(VENV)/bin/activate ## Create venv and install dependencies

test-security: ## Run Bandit security audit (Modular: requires install)
	@echo "🛡️  Running Security Audit..."
	$(BANDIT) -r . -x ./$(VENV)

fix-mac-security: ## Remove quarantine flags (macOS only)
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

run-e2e: fix-mac-security ## Execute Selenium script (Modular: assumes env is up)
	@echo "🚀 Executing E2E Script..."
	$(PYTHON) tests/e2e_test.py

test-all: install build up ## Run full suite locally
	@echo "⏳ Waiting for services..."
	@sleep 10
	$(MAKE) test-security
	$(MAKE) run-e2e
	@echo "✅ All tests passed!"

clean: down ## Clean environment
	rm -rf $(VENV)
	podman system prune -f