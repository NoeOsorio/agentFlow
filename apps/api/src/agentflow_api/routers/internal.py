import json
import os
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Agent, AgentBudget, AgentExecution, Run, RunStatus

router = APIRouter(prefix="/internal", tags=["internal"])

DB = Annotated[AsyncSession, Depends(get_db)]


def _check_internal_secret(x_internal_secret: str | None) -> None:
    expected = os.environ.get("INTERNAL_SECRET", "")
    if not expected or x_internal_secret != expected:
        raise HTTPException(status_code=401, detail="Invalid internal secret")


@router.post("/runs/{run_id}/events")
async def report_run_event(
    run_id: uuid.UUID,
    body: dict,
    db: DB,
    x_internal_secret: Annotated[str | None, Header()] = None,
):
    _check_internal_secret(x_internal_secret)

    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    agent_name = body.get("agent_name", "")
    status = body.get("status", "completed")
    tokens_used = int(body.get("tokens_used", 0))
    cost_usd = float(body.get("cost_usd", 0.0))
    output_snapshot = body.get("output_snapshot")
    input_snapshot = body.get("input_snapshot")
    error = body.get("error")
    node_id = body.get("node_id", "")
    ts_str = body.get("timestamp")
    try:
        ts = datetime.fromisoformat(ts_str) if ts_str else datetime.now(timezone.utc)
    except Exception:
        ts = datetime.now(timezone.utc)

    # Upsert AgentExecution
    result = await db.execute(
        select(AgentExecution).where(
            AgentExecution.run_id == run_id,
            AgentExecution.agent_name == agent_name,
        )
    )
    execution = result.scalar_one_or_none()
    if execution:
        execution.status = status
        execution.tokens_used = (execution.tokens_used or 0) + tokens_used
        execution.output_snapshot = output_snapshot
        execution.input_snapshot = input_snapshot
        execution.error = error
        execution.finished_at = ts
    else:
        execution = AgentExecution(
            run_id=run_id,
            agent_name=agent_name,
            status=status,
            tokens_used=tokens_used,
            output_snapshot=output_snapshot,
            input_snapshot=input_snapshot,
            error=error,
            started_at=ts,
            finished_at=ts,
        )
        db.add(execution)

    # Update AgentBudget
    if cost_usd > 0 and agent_name:
        current_month = datetime.now(timezone.utc).strftime("%Y-%m")
        agent_result = await db.execute(select(Agent).where(Agent.name == agent_name))
        agent = agent_result.scalars().first()
        if agent:
            budget_result = await db.execute(
                select(AgentBudget).where(
                    AgentBudget.agent_id == agent.id,
                    AgentBudget.month == current_month,
                )
            )
            budget = budget_result.scalar_one_or_none()
            if budget:
                budget.spent_usd = float(budget.spent_usd) + cost_usd
                budget.token_count = budget.token_count + tokens_used
                budget.updated_at = datetime.now(timezone.utc)
            else:
                db.add(AgentBudget(
                    agent_id=agent.id,
                    month=current_month,
                    spent_usd=cost_usd,
                    token_count=tokens_used,
                ))

    await db.commit()

    # Publish to Redis
    try:
        import redis.asyncio as aioredis
        from ..config import settings
        r = aioredis.from_url(settings.redis_url)
        await r.publish(f"agentflow:stream:{run_id}", json.dumps({
            "event": body.get("event_type", "node_complete"),
            "node_id": node_id,
            "agent_name": agent_name,
            "status": status,
            "cost_usd": cost_usd,
            "timestamp": ts.isoformat(),
        }))
        await r.aclose()
    except Exception:
        pass

    return {"ok": True, "run_id": str(run_id), "agent_name": agent_name}


@router.post("/runs/{run_id}/complete")
async def complete_run(
    run_id: uuid.UUID,
    body: dict,
    db: DB,
    x_internal_secret: Annotated[str | None, Header()] = None,
):
    _check_internal_secret(x_internal_secret)

    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    final_status = body.get("status", "completed")
    run.status = RunStatus.completed if final_status == "completed" else RunStatus.failed
    run.finished_at = datetime.now(timezone.utc)
    await db.commit()

    try:
        import redis.asyncio as aioredis
        from ..config import settings
        r = aioredis.from_url(settings.redis_url)
        await r.publish(f"agentflow:stream:{run_id}", json.dumps({
            "event": "pipeline_complete" if final_status == "completed" else "pipeline_error",
            "run_id": str(run_id),
            "status": final_status,
        }))
        await r.aclose()
    except Exception:
        pass

    return {"run_id": str(run_id), "status": run.status}
