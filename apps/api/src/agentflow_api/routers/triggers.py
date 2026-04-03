import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from ..database import get_db
from ..models import Pipeline, Run, RunStatus
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
    await db.refresh(run)

    # TODO: dispatch to Celery worker
    # background_tasks.add_task(dispatch_run, run.id)

    return run
