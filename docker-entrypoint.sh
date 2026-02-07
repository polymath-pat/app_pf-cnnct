#!/bin/bash
set -e

if [ -n "$DATABASE_URL" ]; then
    echo "Running database migrations..."
    flask db upgrade || echo "Migration failed or no migrations to run"
fi

exec "$@"
