import os
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Agent, AgentBudget

router = APIRouter(tags=["agents"])

DB = Annotated[AsyncSession, Depends(get_db)]


def _current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


@router.get("/companies/{company_id}/agents")
async def list_agents(company_id: uuid.UUID, db: DB):
    result = await db.execute(select(Agent).where(Agent.company_id == company_id))
    agents = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "name": a.name,
            "role": a.role,
            "health_status": a.health_status,
            "last_heartbeat_at": a.last_heartbeat_at.isoformat() if a.last_heartbeat_at else None,
        }
        for a in agents
    ]


@router.get("/companies/{company_id}/agents/{agent_name}")
async def get_agent(company_id: uuid.UUID, agent_name: str, db: DB):
    result = await db.execute(
        select(Agent).where(Agent.company_id == company_id, Agent.name == agent_name)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    month = _current_month()
    budget_result = await db.execute(
        select(AgentBudget).where(AgentBudget.agent_id == agent.id, AgentBudget.month == month)
    )
    budget = budget_result.scalar_one_or_none()

    return {
        "id": str(agent.id),
        "name": agent.name,
        "role": agent.role,
        "health_status": agent.health_status,
        "last_heartbeat_at": agent.last_heartbeat_at.isoformat() if agent.last_heartbeat_at else None,
        "budget": {
            "month": month,
            "spent_usd": float(budget.spent_usd) if budget else 0.0,
            "token_count": budget.token_count if budget else 0,
        },
    }


@router.get("/companies/{company_id}/agents/{agent_name}/budget")
async def get_agent_budget(company_id: uuid.UUID, agent_name: str, db: DB):
    result = await db.execute(
        select(Agent).where(Agent.company_id == company_id, Agent.name == agent_name)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    month = _current_month()
    budget_result = await db.execute(
        select(AgentBudget).where(AgentBudget.agent_id == agent.id, AgentBudget.month == month)
    )
    budget = budget_result.scalar_one_or_none()
    spent = float(budget.spent_usd) if budget else 0.0

    # budget_monthly_usd could come from agent YAML spec — default 10.0 for now
    import yaml as _yaml
    try:
        spec = _yaml.safe_load(agent.yaml_spec) or {}
        budget_monthly_usd = float(spec.get("spec", {}).get("budget_monthly_usd", 10.0))
    except Exception:
        budget_monthly_usd = 10.0

    return {
        "agent_name": agent.name,
        "month": month,
        "spent_usd": spent,
        "budget_monthly_usd": budget_monthly_usd,
        "remaining_usd": max(0.0, budget_monthly_usd - spent),
        "pct_used": round(spent / budget_monthly_usd * 100, 1) if budget_monthly_usd > 0 else 0.0,
    }


@router.get("/agents/{agent_name}/status")
async def get_agent_status(agent_name: str, db: DB):
    result = await db.execute(select(Agent).where(Agent.name == agent_name))
    agent = result.scalars().first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {
        "agent_name": agent.name,
        "health_status": agent.health_status,
        "last_heartbeat_at": agent.last_heartbeat_at.isoformat() if agent.last_heartbeat_at else None,
    }


@router.post("/internal/agents/{agent_name}/heartbeat")
async def agent_heartbeat(
    agent_name: str,
    body: dict,
    db: DB,
    x_internal_secret: Annotated[str | None, Header()] = None,
):
    expected_secret = os.environ.get("INTERNAL_SECRET", "")
    if not expected_secret or x_internal_secret != expected_secret:
        raise HTTPException(status_code=401, detail="Invalid internal secret")

    result = await db.execute(select(Agent).where(Agent.name == agent_name))
    agent = result.scalars().first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.last_heartbeat_at = datetime.now(timezone.utc)
    agent.health_status = "healthy"
    await db.commit()

    # Publish to Redis pub/sub if available
    try:
        import redis.asyncio as aioredis
        from ..config import settings
        r = aioredis.from_url(settings.redis_url)
        import json
        await r.publish(f"agentflow:heartbeat:{agent_name}", json.dumps({
            "agent_name": agent_name,
            "status": body.get("status", "idle"),
            "run_id": body.get("run_id"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }))
        await r.aclose()
    except Exception:
        pass  # Redis optional — don't fail heartbeat if Redis is down

    return {"ok": True, "agent_name": agent_name, "health_status": "healthy"}
