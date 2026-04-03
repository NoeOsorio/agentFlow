# Stage 1: Build
FROM python:3.12-slim AS builder
WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Copy project files
COPY apps/api/pyproject.toml apps/api/uv.lock* ./

# Install dependencies
RUN uv sync --frozen --no-dev 2>/dev/null || uv sync --no-dev

# Stage 2: Runtime
FROM python:3.12-slim AS runner
WORKDIR /app

# Copy uv and venv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/
COPY --from=builder /app/.venv /app/.venv

# Copy source
COPY apps/api/src ./src

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app/src"

EXPOSE 8000
CMD ["uvicorn", "agentflow_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
