import hashlib
import hmac
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ..database import get_db
from ..models import Company, Pipeline, Run, RunStatus
from ..run_read import run_to_read
from ..schemas import RunRead

router = APIRouter(tags=["triggers"])

DB = Annotated[AsyncSession, Depends(get_db)]


def _verify_hmac(source: str, payload: bytes, signature: str, secret: str) -> bool:
    """Verify HMAC signature. Uses hmac.compare_digest (timing-safe)."""
    if not secret:
        return True  # No secret configured — allow through (for testing)
    if source == "github":
        expected = "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)
    elif source == "stripe":
        # Stripe uses t=timestamp,v1=signature format
        parts = {k: v for item in signature.split(",") for k, v in [item.split("=", 1)]}
        t = parts.get("t", "")
        v1 = parts.get("v1", "")
        signed_payload = f"{t}.{payload.decode()}"
        expected = hmac.new(secret.encode(), signed_payload.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, v1)
    else:
        # Generic: X-Signature header
        expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)


@router.post("/webhooks/{pipeline_id}/{source}", response_model=RunRead, status_code=202)
async def webhook_trigger(
    pipeline_id: uuid.UUID,
    source: str,
    request: Request,
    db: DB,
):
    """Webhook trigger with HMAC verification. Sources: stripe, github, generic."""
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    payload = await request.body()
    secret = pipeline.webhook_secret or os.environ.get("WEBHOOK_SECRET", "")

    # Get signature from appropriate header
    if source == "github":
        signature = request.headers.get("X-Hub-Signature-256", "")
    elif source == "stripe":
        signature = request.headers.get("Stripe-Signature", "")
    else:
        signature = request.headers.get("X-Signature", "")

    if secret and not _verify_hmac(source, payload, signature, secret):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        trigger_data = json.loads(payload) if payload else {}
    except Exception:
        trigger_data = {}

    run = Run(
        pipeline_id=pipeline_id,
        status=RunStatus.pending,
        trigger_data=json.dumps({"source": source, "data": trigger_data}),
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    await db.commit()

    # Dispatch Celery
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
            trigger_data=trigger_data,
        )
    except ImportError:
        pass

    loaded = await db.execute(
        select(Run).options(joinedload(Run.pipeline)).where(Run.id == run.id)
    )
    return run_to_read(loaded.unique().scalar_one())


@router.post("/pipelines/{pipeline_id}/schedule")
async def create_schedule(pipeline_id: uuid.UUID, body: dict, db: DB):
    """Create a cron schedule for a pipeline. Body: { cron: str }"""
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    cron = body.get("cron", "")
    if not cron:
        raise HTTPException(status_code=422, detail="cron expression is required")
    # TODO: wire into Celery Beat dynamic schedules
    return {"pipeline_id": str(pipeline_id), "cron": cron, "status": "scheduled"}


@router.delete("/pipelines/{pipeline_id}/schedule", status_code=204)
async def delete_schedule(pipeline_id: uuid.UUID, db: DB):
    """Remove a cron schedule from a pipeline."""
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    # TODO: remove from Celery Beat
