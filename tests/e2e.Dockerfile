# tests/e2e.Dockerfile

FROM python:3.11-slim

# Install Chrome and system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    curl \
    unzip \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' \
    && apt-get update && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements from the project root (requires specific build context)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt selenium webdriver-manager

# Copy the actual test files
COPY tests/ /app/tests/

# Set Python path so it can find modules if needed
ENV PYTHONPATH=/app

CMD ["python", "tests/e2e_test.py"]