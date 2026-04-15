import json
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ..database import get_db
from ..models import AgentExecution, Company, Pipeline, Run, RunStatus
from ..run_read import run_to_read
from ..schemas import RunRead

router = APIRouter(tags=["runs"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/runs", response_model=list[RunRead])
async def list_runs(
    db: DB,
    pipeline_id: uuid.UUID | None = Query(default=None),
    pipeline_name: str | None = Query(default=None),
    company_id: uuid.UUID | None = Query(default=None),
    status: str | None = Query(default=None),
):
    query = select(Run).options(joinedload(Run.pipeline)).order_by(Run.created_at.desc())
    if pipeline_name:
        pipeline_result = await db.execute(
            select(Pipeline)
            .where(Pipeline.name == pipeline_name)
            .order_by(Pipeline.created_at.desc()),
        )
        pipeline = pipeline_result.scalars().first()
        if pipeline:
            query = query.where(Run.pipeline_id == pipeline.id)
    elif pipeline_id:
        query = query.where(Run.pipeline_id == pipeline_id)
    if company_id:
        query = query.join(Pipeline).where(Pipeline.company_id == company_id)
    if status:
        query = query.where(Run.status == status)
    result = await db.execute(query)
    runs = result.unique().scalars().all()
    return [run_to_read(r) for r in runs]


@router.get("/runs/{run_id}", response_model=RunRead)
async def get_run(run_id: uuid.UUID, db: DB):
    result = await db.execute(
        select(Run).options(joinedload(Run.pipeline)).where(Run.id == run_id)
    )
    run = result.unique().scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run_to_read(run)


@router.get("/runs/{run_id}/nodes")
async def get_run_nodes(run_id: uuid.UUID, db: DB):
    """List AgentExecution records for a run with agent_name, role, cost."""
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    result = await db.execute(
        select(AgentExecution).where(AgentExecution.run_id == run_id).order_by(AgentExecution.started_at)
    )
    executions = result.scalars().all()
    return [
        {
            "id": str(e.id),
            "agent_name": e.agent_name,
            "status": e.status,
            "tokens_used": e.tokens_used,
            "output": e.output,
            "error": e.error,
            "started_at": e.started_at.isoformat() if e.started_at else None,
            "finished_at": e.finished_at.isoformat() if e.finished_at else None,
            "input_snapshot": e.input_snapshot,
            "output_snapshot": e.output_snapshot,
        }
        for e in executions
    ]


@router.post("/pipelines/{pipeline_id}/execute", response_model=RunRead, status_code=202)
async def execute_pipeline(pipeline_id: uuid.UUID, body: dict, db: DB):
    """Trigger a pipeline run. response_mode: 'blocking' | 'streaming'"""
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    run = Run(
        pipeline_id=pipeline_id,
        status=RunStatus.pending,
        trigger_data=json.dumps(body.get("inputs", {})),
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    await db.commit()

    try:
        from agentflow_runtime.tasks import execute_pipeline as celery_task
        company_yaml = None
        if pipeline.company_id:
            company = await db.get(Company, pipeline.company_id)
            company_yaml = company.yaml_spec if company else None
        celery_task.delay(
            run_id=str(run.id),
            pipeline_yaml=pipeline.yaml_spec,
            company_yaml=company_yaml,
            trigger_data=body.get("inputs", {}),
        )
    except ImportError:
        pass

    result = await db.execute(
        select(Run).options(joinedload(Run.pipeline)).where(Run.id == run.id)
    )
    run_loaded = result.unique().scalar_one()
    return run_to_read(run_loaded)


@router.post("/runs/{run_id}/pause")
async def pause_run(run_id: uuid.UUID, db: DB):
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    await _publish_control(run_id, "pause")
    return {"run_id": str(run_id), "command": "pause"}


@router.post("/runs/{run_id}/resume")
async def resume_run(run_id: uuid.UUID, db: DB):
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    await _publish_control(run_id, "resume")
    return {"run_id": str(run_id), "command": "resume"}


@router.post("/runs/{run_id}/stop")
async def stop_run(run_id: uuid.UUID, db: DB):
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    run.status = RunStatus.cancelled
    run.finished_at = datetime.now(timezone.utc)
    await db.commit()
    await _publish_control(run_id, "stop")
    return {"run_id": str(run_id), "status": "cancelled"}


@router.post("/runs/{run_id}/approve/{node_id}")
async def approve_run_node(run_id: uuid.UUID, node_id: str, body: dict, db: DB):
    """Submit a human approval response for a waiting node."""
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    try:
        import redis.asyncio as aioredis
        from ..config import settings
        r = aioredis.from_url(settings.redis_url)
        payload = json.dumps({
            "type": "human_approval",
            "node_id": node_id,
            "approved": body.get("approved", True),
            "response": body.get("response", ""),
        })
        await r.publish(f"agentflow:approval:{run_id}:{node_id}", payload)
        await r.aclose()
    except Exception:
        pass
    return {"run_id": str(run_id), "node_id": node_id, "approved": body.get("approved", True)}


async def _publish_control(run_id: uuid.UUID, command: str) -> None:
    try:
        import redis.asyncio as aioredis
        from ..config import settings
        r = aioredis.from_url(settings.redis_url)
        await r.publish(f"agentflow:control:{run_id}", command)
        await r.aclose()
    except Exception:
        pass
