FROM python:3.11-slim

WORKDIR /app

# Install dependencies including libpq-dev for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy everything from local src/ into container /app/
COPY src/ .

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Ensure the container sees the current dir as a python package
ENV PYTHONPATH=/app
ENV FLASK_APP=app.py

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "app:app"]