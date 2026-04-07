import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Pipeline, Run
from ..schemas import RunRead

router = APIRouter(prefix="/runs", tags=["runs"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/", response_model=list[RunRead])
async def list_runs(
    db: DB,
    pipeline_name: str | None = None,
    pipeline_id: uuid.UUID | None = None,
):
    query = select(Run).order_by(Run.created_at.desc())
    if pipeline_name:
        pipeline_result = await db.execute(
            select(Pipeline).where(Pipeline.name == pipeline_name)
        )
        pipeline = pipeline_result.scalar_one_or_none()
        if pipeline:
            query = query.where(Run.pipeline_id == pipeline.id)
    elif pipeline_id:
        query = query.where(Run.pipeline_id == pipeline_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{run_id}", response_model=RunRead)
async def get_run(run_id: uuid.UUID, db: DB):
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run
