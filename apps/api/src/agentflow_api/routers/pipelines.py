import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Pipeline
from ..schemas import PipelineCreate, PipelineRead

router = APIRouter(prefix="/pipelines", tags=["pipelines"])

DB = Annotated[AsyncSession, Depends(get_db)]


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


@router.get("/{pipeline_id}", response_model=PipelineRead)
async def get_pipeline(pipeline_id: uuid.UUID, db: DB):
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


@router.delete("/{pipeline_id}", status_code=204)
async def delete_pipeline(pipeline_id: uuid.UUID, db: DB):
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    await db.delete(pipeline)
    await db.commit()
