import json
import uuid

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ..database import get_db
from ..models import Pipeline, Run, RunStatus
from ..run_read import run_to_read
from ..schemas import TriggerPayload, RunRead

router = APIRouter(prefix="/triggers", tags=["triggers"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.post("/{pipeline_id}", response_model=RunRead, status_code=202)
async def trigger_pipeline(
    pipeline_id: uuid.UUID,
    payload: TriggerPayload,
    db: DB,
):
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    run = Run(
        pipeline_id=pipeline_id,
        status=RunStatus.pending,
        trigger_data=json.dumps({"source": payload.source, "data": payload.data}),
    )
    db.add(run)
    await db.commit()

    # TODO: dispatch to Celery worker
    # background_tasks.add_task(dispatch_run, run.id)

    loaded = await db.execute(
        select(Run).options(joinedload(Run.pipeline)).where(Run.id == run.id),
    )
    run_loaded = loaded.unique().scalar_one()
    return run_to_read(run_loaded)
