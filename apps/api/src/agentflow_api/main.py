from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine
from .routers import pipelines, runs, triggers


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
    from sqlalchemy import text
    from .database import SessionLocal

    checks: dict[str, str] = {}

    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as exc:
        checks["postgres"] = f"error: {exc}"

    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url)
        await r.ping()
        await r.aclose()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"error: {exc}"

    all_ok = all(v == "ok" for v in checks.values())
    from starlette.responses import JSONResponse
    return JSONResponse(
        content={"status": "ready" if all_ok else "not_ready", "checks": checks},
        status_code=200 if all_ok else 503,
    )
