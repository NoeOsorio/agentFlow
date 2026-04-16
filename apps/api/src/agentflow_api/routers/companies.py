import uuid
import yaml
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Agent, AgentBudget, Company

router = APIRouter(prefix="/companies", tags=["companies"])

DB = Annotated[AsyncSession, Depends(get_db)]


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class AgentRead(BaseModel):
    id: uuid.UUID
    name: str
    role: str
    health_status: str
    last_heartbeat_at: datetime | None

    model_config = {"from_attributes": True}


class BudgetSummary(BaseModel):
    agent_name: str
    month: str
    spent_usd: float
    token_count: int


class CompanyRead(BaseModel):
    id: uuid.UUID
    name: str
    namespace: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    agents: list[AgentRead] = []

    model_config = {"from_attributes": True}


class OrgNode(BaseModel):
    name: str
    role: str
    reports_to: str | None
    direct_reports: list["OrgNode"] = []


OrgNode.model_rebuild()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_company_yaml(yaml_spec: str) -> dict:
    """Parse and validate Company YAML. Returns the parsed dict."""
    try:
        doc = yaml.safe_load(yaml_spec)
    except yaml.YAMLError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid YAML: {exc}")
    if not doc or doc.get("kind") != "Company":
        raise HTTPException(status_code=422, detail="YAML must have kind: Company")
    meta = doc.get("metadata", {})
    if not meta.get("name"):
        raise HTTPException(status_code=422, detail="metadata.name is required")
    return doc


async def _resolve_company(identifier: str, db: AsyncSession) -> Company:
    """Resolve company by UUID or name."""
    try:
        uid = uuid.UUID(identifier)
        company = await db.get(Company, uid)
    except ValueError:
        result = await db.execute(
            select(Company).where(Company.name == identifier)
        )
        company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


async def _sync_agents(db: AsyncSession, company: Company, spec: dict) -> None:
    """Sync Agent rows from YAML spec. Insert new, update existing, delete removed."""
    spec_agents = spec.get("spec", {}).get("agents", []) or []
    spec_names = {a["name"] for a in spec_agents if "name" in a}

    # Load existing agents
    result = await db.execute(select(Agent).where(Agent.company_id == company.id))
    existing = {a.name: a for a in result.scalars().all()}

    # Upsert
    for agent_spec in spec_agents:
        name = agent_spec.get("name")
        if not name:
            continue
        role = agent_spec.get("role", "")
        agent_yaml = yaml.dump({"kind": "Agent", "metadata": {"name": name}, "spec": agent_spec})
        if name in existing:
            existing[name].role = role
            existing[name].yaml_spec = agent_yaml
        else:
            agent = Agent(
                company_id=company.id,
                name=name,
                role=role,
                yaml_spec=agent_yaml,
            )
            db.add(agent)

    # Delete removed agents
    for name, agent in existing.items():
        if name not in spec_names:
            await db.delete(agent)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[CompanyRead])
async def list_companies(db: DB, namespace: str | None = None):
    query = select(Company).order_by(Company.created_at.desc())
    if namespace:
        query = query.where(Company.namespace == namespace)
    result = await db.execute(query)
    companies = result.scalars().all()
    # Load agents for each
    for company in companies:
        await db.refresh(company, ["agents"])
    return companies


@router.post("/", response_model=CompanyRead, status_code=201)
async def create_company(request_body: dict, db: DB):
    """Create Company from raw YAML dict. Body: { yaml_spec: str }"""
    yaml_spec = request_body.get("yaml_spec", "")
    doc = _parse_company_yaml(yaml_spec)
    meta = doc.get("metadata", {})
    name = meta["name"]
    namespace = meta.get("namespace", "default")

    # Check uniqueness
    existing = await db.execute(select(Company).where(Company.name == name, Company.namespace == namespace))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Company '{name}' already exists in namespace '{namespace}'")

    company = Company(
        name=name,
        namespace=namespace,
        yaml_spec=yaml_spec,
        description=doc.get("spec", {}).get("description"),
    )
    db.add(company)
    await db.flush()
    await _sync_agents(db, company, doc)
    await db.commit()
    await db.refresh(company, ["agents"])
    return company


@router.get("/{company_id}", response_model=CompanyRead)
async def get_company(company_id: str, db: DB):
    company = await _resolve_company(company_id, db)
    await db.refresh(company, ["agents"])
    return company


@router.put("/{company_id}", response_model=CompanyRead)
async def update_company(company_id: str, request_body: dict, db: DB):
    """Full YAML update — re-validates and re-syncs agents."""
    company = await _resolve_company(company_id, db)
    yaml_spec = request_body.get("yaml_spec", "")
    doc = _parse_company_yaml(yaml_spec)
    meta = doc.get("metadata", {})
    company.yaml_spec = yaml_spec
    company.name = meta["name"]
    company.namespace = meta.get("namespace", company.namespace)
    company.description = doc.get("spec", {}).get("description", company.description)
    company.updated_at = datetime.now(timezone.utc)
    await _sync_agents(db, company, doc)
    await db.commit()
    await db.refresh(company, ["agents"])
    return company


@router.delete("/{company_id}", status_code=204)
async def delete_company(company_id: str, db: DB):
    company = await _resolve_company(company_id, db)
    await db.delete(company)
    await db.commit()


@router.get("/{company_id}/org-structure", response_model=list[OrgNode])
async def get_org_structure(company_id: str, db: DB):
    """Returns org tree based on reports_to field in agent YAML spec."""
    company = await _resolve_company(company_id, db)
    await db.refresh(company, ["agents"])

    # Parse reports_to from each agent's yaml_spec
    agent_nodes: dict[str, OrgNode] = {}
    children: dict[str, list[str]] = {}

    for agent in company.agents:
        try:
            spec = yaml.safe_load(agent.yaml_spec) or {}
        except Exception:
            spec = {}
        reports_to = spec.get("spec", {}).get("reports_to")
        node = OrgNode(name=agent.name, role=agent.role, reports_to=reports_to)
        agent_nodes[agent.name] = node
        if reports_to:
            children.setdefault(reports_to, []).append(agent.name)

    # Build tree
    def build_tree(name: str) -> OrgNode:
        node = agent_nodes[name]
        node.direct_reports = [build_tree(child) for child in children.get(name, [])]
        return node

    roots = [name for name, node in agent_nodes.items() if not node.reports_to]
    return [build_tree(r) for r in roots]


@router.get("/{company_id}/budget")
async def get_company_budget(company_id: str, db: DB):
    company = await _resolve_company(company_id, db)
    await db.refresh(company, ["agents"])

    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    agent_budgets = []
    for agent in company.agents:
        result = await db.execute(
            select(AgentBudget).where(AgentBudget.agent_id == agent.id, AgentBudget.month == current_month)
        )
        budget = result.scalar_one_or_none()
        agent_budgets.append({
            "agent_name": agent.name,
            "month": current_month,
            "spent_usd": float(budget.spent_usd) if budget else 0.0,
            "token_count": budget.token_count if budget else 0,
        })

    return {"company_name": company.name, "agents": agent_budgets}
