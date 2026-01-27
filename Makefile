# Variables
VENV := venv
PYTHON := $(VENV)/bin/python3
PIP := $(VENV)/bin/pip
BIN := $(VENV)/bin

.PHONY: help venv test-security test-unit test-e2e test-all infra-up infra-down build-frontend clean

help:
	@echo "Available commands:"
	@echo "  make test-security  - Run Bandit (scans ./src only)"
	@echo "  make test-unit      - Run Unit Tests (sets PYTHONPATH)"
	@echo "  make infra-up       - Build frontend, start containers, and wait for health"
	@echo "  make test-e2e       - Run Selenium tests against port 3000"
	@echo "  make test-all       - Full pipeline: Security -> Unit -> Infra -> E2E -> Cleanup"

$(VENV)/bin/activate:
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt
	$(PIP) install bandit pytest requests-mock selenium webdriver-manager

# --- STEP 1: Security ---
test-security: $(VENV)/bin/activate
	@echo ">>> Running Security Audit..."
	$(BIN)/bandit -r ./src

# --- STEP 2: Unit Tests ---
test-unit: $(VENV)/bin/activate
	@echo ">>> Running Unit Tests..."
	PYTHONPATH=. $(BIN)/pytest tests/unit_test.py

# --- STEP 3: Frontend Build (Required for Compose Volumes) ---
build-frontend:
	@echo ">>> Building Frontend Assets..."
	cd frontend && npm install && npm run build

# --- STEP 4: Infrastructure with Health Wait ---
infra-up: build-frontend
	@echo ">>> Starting Infrastructure..."
	podman-compose build
	podman-compose up -d
	@echo ">>> Waiting for Frontend to be ready on port 3000..."
	@until $$(curl --output /dev/null --silent --head --fail http://localhost:3000); do \
		printf '.'; \
		sleep 1; \
	done
	@echo " Ready!"

infra-down:
	@echo ">>> Stopping Infrastructure..."
	podman-compose down

# --- STEP 5: E2E Testing ---
test-e2e: $(VENV)/bin/activate
	@echo ">>> Running E2E Tests..."
	$(PYTHON) tests/e2e_test.py

# --- STEP 6: Combined Pipeline ---
test-all: 
	@$(MAKE) test-security
	@$(MAKE) test-unit
	@echo ">>> Logic tests passed. Moving to Integration..."
	@$(MAKE) infra-up
	@$(MAKE) test-e2e || ( $(MAKE) infra-down && exit 1 )
	@$(MAKE) infra-down
	@echo ">>> [SUCCESS] All stages passed."

clean:
	@$(MAKE) infra-down || true
	rm -rf $(VENV)
	find . -type d -name "__pycache__" -exec rm -rf {} +
	rm -rf frontend/dist