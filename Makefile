# Variables
COMPOSE = podman-compose
PYTHON = python3
NPM = npm

.PHONY: help dev build down logs clean shell-backend validate lint-backend lint-frontend validate-spec check

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# --- VALIDATION & LINTING ---

validate: lint-backend lint-frontend validate-spec ## Run all local linters and validations

lint-backend: ## Lint Python code and run security audit
	@echo "🔍 Auditing Backend..."
	flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
	bandit -r . -x ./venv

lint-frontend: ## Check TypeScript types by running a build
	@echo "🔍 Checking Frontend Types..."
	cd frontend && $(NPM) install && $(NPM) run build

validate-spec: ## Validate DigitalOcean App Spec
	@echo "🔍 Validating App Spec..."
	doctl apps spec validate spec.yaml

# --- INFRASTRUCTURE ---

dev: ## Start stack and wait for health
	$(COMPOSE) up -d --build
	@echo "⏳ Waiting for services to initialize..."
	@sleep 5
	@make check
	@echo "🚀 App fully ready at http://localhost"

check: ## Verify health of all services
	@echo "🔍 Checking Redis..."
	@$(COMPOSE) exec redis redis-cli ping | grep -q "PONG" && echo "✅ Redis is online" || echo "❌ Redis is offline"
	
	@echo "🔍 Checking Backend API (Healthz)..."
	@curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/healthz | grep -q "200" && echo "✅ Backend is responding" || echo "❌ Backend is failing"
	
	@echo "🔍 Checking Frontend UI..."
	@curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "200" && echo "✅ Frontend is serving" || echo "❌ Frontend is failing"

build: ## Rebuild all containers without starting them
	$(COMPOSE) build

down: ## Stop and remove all containers
	$(COMPOSE) down

logs: ## Follow logs from all containers (explicitly named to avoid Podman remote errors)
	$(COMPOSE) logs -f backend frontend redis

clean: ## Remove containers and delete volumes (wipes Redis data)
	$(COMPOSE) down -v
	@echo "🧹 Environment cleaned."

shell-backend: ## Jump into the running backend container for debugging
	$(COMPOSE) exec backend /bin/bash
