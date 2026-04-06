"""Health check utilities for the AgentFlow runtime service."""

import os

import redis


def check_redis() -> dict[str, str]:
    """Check Redis connectivity."""
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    try:
        r = redis.from_url(redis_url)
        r.ping()
        r.close()
        return {"redis": "ok"}
    except Exception as exc:
        return {"redis": f"error: {exc}"}


def health() -> dict:
    """Return overall health status."""
    checks = check_redis()
    all_ok = all(v == "ok" for v in checks.values())
    return {
        "status": "healthy" if all_ok else "unhealthy",
        "service": "agentflow-runtime",
        "checks": checks,
    }


if __name__ == "__main__":
    import json
    import sys

    result = health()
    print(json.dumps(result))
    sys.exit(0 if result["status"] == "healthy" else 1)
