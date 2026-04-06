#!/bin/sh
set -e

# Run migrations only when starting the API server (not celery workers/beat/flower)
if [ $# -eq 0 ] || [ "$1" = "uvicorn" ]; then
    echo "Running database migrations..."
    uv run alembic upgrade head
fi

# Default: start API server with no command args (production)
if [ $# -eq 0 ]; then
    exec uv run uvicorn agentflow_api.main:app --host 0.0.0.0 --port 8000 --workers 4
fi

exec "$@"
