from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import settings
from .database import engine
from .logging_config import RequestLoggingMiddleware, setup_logging
from .routers import pipelines, runs, triggers

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(
    title="AgentFlow API",
    version="0.0.1",
    description="AI agent pipeline orchestration backend",
    lifespan=lifespan,
)

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pipelines.router, prefix="/api")
app.include_router(runs.router, prefix="/api")
app.include_router(triggers.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "agentflow-api"}


@app.get("/ready")
async def readiness():
    """Readiness probe — checks that Postgres and Redis are reachable."""
    from .database import SessionLocal

    checks: dict[str, str] = {}

    # Postgres
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as exc:
        checks["postgres"] = f"error: {exc}"

    # Redis
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(settings.redis_url)
        await r.ping()
        await r.aclose()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"error: {exc}"

    all_ok = all(v == "ok" for v in checks.values())
    status_code = 200 if all_ok else 503
    from starlette.responses import JSONResponse

    return JSONResponse(
        content={"status": "ready" if all_ok else "not_ready", "checks": checks},
        status_code=status_code,
    )


@app.get("/metrics")
async def metrics():
    """Basic metrics endpoint (placeholder for Prometheus integration)."""
    import time

    return {
        "service": "agentflow-api",
        "uptime_seconds": time.time() - _start_time,
        "version": "0.0.1",
    }


_start_time: float = 0


@app.on_event("startup")
async def _record_start_time():
    global _start_time
    import time

    _start_time = time.time()
