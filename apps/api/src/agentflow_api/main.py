from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import settings
from .database import engine
from .routers import companies, pipelines, runs, triggers, api_keys, agents


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

app.include_router(companies.router, prefix="/api")
app.include_router(pipelines.router, prefix="/api")
app.include_router(runs.router, prefix="/api")
app.include_router(triggers.router, prefix="/api")
app.include_router(api_keys.router, prefix="/api")
app.include_router(agents.router, prefix="/api")


class ApplyPayload(BaseModel):
    yaml_content: str


@app.post("/api/apply")
async def apply_manifest(payload: ApplyPayload):
    """Apply a YAML manifest — creates or updates a company or pipeline."""
    import yaml
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import select

    try:
        manifest = yaml.safe_load(payload.yaml_content)
    except yaml.YAMLError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid YAML: {exc}")

    kind = (manifest or {}).get("kind", "").lower()
    metadata = (manifest or {}).get("metadata", {})
    name = metadata.get("name")

    if not name:
        raise HTTPException(status_code=422, detail="manifest.metadata.name is required")

    from .database import SessionLocal
    from .models import Company, Pipeline

    if kind == "company":
        async with SessionLocal() as db:
            result = await db.execute(select(Company).where(Company.name == name))
            existing = result.scalar_one_or_none()
            if existing:
                existing.yaml_spec = payload.yaml_content
                existing.namespace = metadata.get("namespace", existing.namespace)
                await db.commit()
                return {"action": "updated", "kind": "Company", "name": name}
            else:
                company = Company(
                    name=name,
                    namespace=metadata.get("namespace", "default"),
                    yaml_spec=payload.yaml_content,
                )
                db.add(company)
                await db.commit()
                return {"action": "created", "kind": "Company", "name": name}

    elif kind == "pipeline":
        async with SessionLocal() as db:
            result = await db.execute(select(Pipeline).where(Pipeline.name == name))
            existing = result.scalar_one_or_none()
            if existing:
                existing.yaml_spec = payload.yaml_content
                existing.namespace = metadata.get("namespace", existing.namespace)
                existing.version = existing.version + 1
                await db.commit()
                return {"action": "updated", "kind": "Pipeline", "name": name, "version": existing.version}
            else:
                pipeline = Pipeline(
                    name=name,
                    namespace=metadata.get("namespace", "default"),
                    yaml_spec=payload.yaml_content,
                )
                db.add(pipeline)
                await db.commit()
                return {"action": "created", "kind": "Pipeline", "name": name, "version": 1}

    else:
        raise HTTPException(status_code=422, detail=f"Unknown kind: '{kind}'. Expected 'Company' or 'Pipeline'")


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
