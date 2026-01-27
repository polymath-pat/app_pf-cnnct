# tests/e2e.Dockerfile
# Force AMD64 to allow Chrome to run on Apple Silicon via emulation
FROM --platform=linux/amd64 selenium/standalone-chrome:latest

USER root

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install requirements
COPY tests/requirements-e2e.txt .
RUN pip3 install --no-cache-dir selenium webdriver-manager pytest requests-mock --break-system-packages

COPY tests/ /app/tests/
COPY Makefile .

ENV PYTHONPATH=/app

CMD ["python3", "tests/e2e_test.py"]
