#!/usr/bin/env sh
# Production start script for the API service.
# Runs DB migrations, then launches the web server bound to Railway's $PORT.
set -e

echo "==> Running database migrations..."
python -m app.db.migrate

echo "==> Starting API server on port ${PORT:-8080}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8080}"
