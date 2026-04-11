import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ..database import get_db
from ..models import Pipeline, Run
from ..run_read import run_to_read
from ..schemas import RunRead

router = APIRouter(prefix="/runs", tags=["runs"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/", response_model=list[RunRead])
async def list_runs(
    db: DB,
    pipeline_name: str | None = None,
    pipeline_id: uuid.UUID | None = None,
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
    result = await db.execute(query)
    runs = result.unique().scalars().all()
    return [run_to_read(r) for r in runs]


@router.get("/{run_id}", response_model=RunRead)
async def get_run(run_id: uuid.UUID, db: DB):
    result = await db.execute(select(Run).options(joinedload(Run.pipeline)).where(Run.id == run_id))
    run = result.unique().scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run_to_read(run)
