import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete as sql_delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import AgentExecution, Pipeline, Run, RunStatus
from ..schemas import PipelineCreate, PipelineRead, RunRead

router = APIRouter(prefix="/pipelines", tags=["pipelines"])

DB = Annotated[AsyncSession, Depends(get_db)]


async def _pipeline_by_name(db: AsyncSession, name: str) -> Pipeline | None:
    """`Pipeline.name` is not unique; prefer the newest row when names collide."""
    result = await db.execute(
        select(Pipeline).where(Pipeline.name == name).order_by(Pipeline.created_at.desc()),
    )
    return result.scalars().first()


@router.get("/", response_model=list[PipelineRead])
async def list_pipelines(db: DB):
    result = await db.execute(select(Pipeline).order_by(Pipeline.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=PipelineRead, status_code=201)
async def create_pipeline(payload: PipelineCreate, db: DB):
    pipeline = Pipeline(**payload.model_dump())
    db.add(pipeline)
    await db.commit()
    await db.refresh(pipeline)
    return pipeline


@router.get("/{name}", response_model=PipelineRead)
async def get_pipeline(name: str, db: DB):
    pipeline = await _pipeline_by_name(db, name)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


@router.delete("/{name}", status_code=204)
async def delete_pipeline(name: str, db: DB):
    pipeline = await _pipeline_by_name(db, name)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    run_ids = select(Run.id).where(Run.pipeline_id == pipeline.id)
    await db.execute(sql_delete(AgentExecution).where(AgentExecution.run_id.in_(run_ids)))
    await db.execute(sql_delete(Run).where(Run.pipeline_id == pipeline.id))
    await db.delete(pipeline)
    await db.commit()


@router.post("/{name}/execute", response_model=RunRead, status_code=202)
async def execute_pipeline(name: str, body: dict, db: DB):
    pipeline = await _pipeline_by_name(db, name)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    run = Run(
        pipeline_id=pipeline.id,
        status=RunStatus.pending,
        trigger_data=json.dumps(body.get("trigger_data", {})),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run
