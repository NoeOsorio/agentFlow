import yaml
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Company, Pipeline

router = APIRouter(tags=["resources"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.post("/apply")
async def apply_resources(request: Request, db: DB):
    """
    Apply multi-document YAML (like kubectl apply).
    Content-Type: text/yaml OR application/json with { yaml_content: str }
    """
    content_type = request.headers.get("content-type", "")

    if "text/yaml" in content_type or "application/x-yaml" in content_type:
        body_bytes = await request.body()
        yaml_text = body_bytes.decode("utf-8")
    else:
        # Fall back to JSON body { yaml_content: str }
        body = await request.json()
        yaml_text = body.get("yaml_content", body.get("yaml_spec", ""))

    if not yaml_text:
        raise HTTPException(status_code=422, detail="No YAML content provided")

    # Split multi-document YAML
    documents = list(yaml.safe_load_all(yaml_text))
    applied = []
    errors = []

    for doc in documents:
        if not doc:
            continue
        kind = doc.get("kind", "")
        meta = doc.get("metadata", {})
        name = meta.get("name")

        try:
            if kind == "Company":
                action = await _apply_company(db, doc, yaml_text if len(documents) == 1 else yaml.dump(doc))
                applied.append({"kind": "Company", "name": name, "action": action})
            elif kind == "Pipeline":
                action = await _apply_pipeline(db, doc, yaml.dump(doc))
                applied.append({"kind": "Pipeline", "name": name, "action": action})
            else:
                errors.append({"kind": kind or "Unknown", "name": name, "error": f"Unknown resource kind: {kind or '(empty)'}"})
        except Exception as exc:
            errors.append({"kind": kind, "name": name, "error": str(exc)})

    return {"applied": applied, "errors": errors}


async def _apply_company(db: AsyncSession, doc: dict, yaml_spec: str) -> str:
    meta = doc.get("metadata", {})
    name = meta.get("name")
    namespace = meta.get("namespace", "default")
    if not name:
        raise ValueError("metadata.name is required")

    result = await db.execute(
        select(Company).where(Company.name == name, Company.namespace == namespace)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.yaml_spec = yaml_spec
        existing.description = doc.get("spec", {}).get("description", existing.description)
        await _sync_company_agents(db, existing, doc)
        await db.commit()
        return "updated"
    else:
        from datetime import datetime, timezone
        company = Company(
            name=name,
            namespace=namespace,
            yaml_spec=yaml_spec,
            description=doc.get("spec", {}).get("description"),
        )
        db.add(company)
        await db.flush()
        await _sync_company_agents(db, company, doc)
        await db.commit()
        return "created"


async def _sync_company_agents(db: AsyncSession, company: Company, doc: dict) -> None:
    from ..models import Agent
    import yaml as _yaml

    spec_agents = doc.get("spec", {}).get("agents", []) or []
    spec_names = {a["name"] for a in spec_agents if "name" in a}

    result = await db.execute(select(Agent).where(Agent.company_id == company.id))
    existing = {a.name: a for a in result.scalars().all()}

    for agent_spec in spec_agents:
        aname = agent_spec.get("name")
        if not aname:
            continue
        role = agent_spec.get("role", "")
        agent_yaml = _yaml.dump({"kind": "Agent", "metadata": {"name": aname}, "spec": agent_spec})
        if aname in existing:
            existing[aname].role = role
            existing[aname].yaml_spec = agent_yaml
        else:
            agent = Agent(company_id=company.id, name=aname, role=role, yaml_spec=agent_yaml)
            db.add(agent)

    for aname, agent in existing.items():
        if aname not in spec_names:
            await db.delete(agent)


async def _apply_pipeline(db: AsyncSession, doc: dict, yaml_spec: str) -> str:
    meta = doc.get("metadata", {})
    name = meta.get("name")
    namespace = meta.get("namespace", "default")
    if not name:
        raise ValueError("metadata.name is required")

    # Resolve company_ref
    company_id = None
    company_ref = doc.get("spec", {}).get("company_ref")
    if company_ref:
        ref_name = company_ref if isinstance(company_ref, str) else company_ref.get("name")
        ref_ns = company_ref.get("namespace", "default") if isinstance(company_ref, dict) else "default"
        result = await db.execute(
            select(Company).where(Company.name == ref_name, Company.namespace == ref_ns)
        )
        company = result.scalar_one_or_none()
        if not company:
            raise ValueError(f"Company '{ref_name}' not found")
        company_id = company.id

    result = await db.execute(
        select(Pipeline).where(Pipeline.name == name, Pipeline.namespace == namespace)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.yaml_spec = yaml_spec
        existing.company_id = company_id or existing.company_id
        existing.version = existing.version + 1
        await db.commit()
        return "updated"
    else:
        pipeline = Pipeline(name=name, namespace=namespace, yaml_spec=yaml_spec, company_id=company_id)
        db.add(pipeline)
        await db.commit()
        return "created"


@router.get("/resources")
async def list_resources(
    db: DB,
    kind: str = Query(...),
    namespace: str = Query(default="default"),
):
    """List resources by kind and namespace."""
    if kind == "Company":
        result = await db.execute(
            select(Company).where(Company.namespace == namespace).order_by(Company.created_at.desc())
        )
        items = result.scalars().all()
        return [{"kind": "Company", "name": c.name, "namespace": c.namespace, "id": str(c.id)} for c in items]
    elif kind == "Pipeline":
        result = await db.execute(
            select(Pipeline).where(Pipeline.namespace == namespace).order_by(Pipeline.created_at.desc())
        )
        items = result.scalars().all()
        return [{"kind": "Pipeline", "name": p.name, "namespace": p.namespace, "id": str(p.id)} for p in items]
    else:
        raise HTTPException(status_code=422, detail=f"Unknown resource kind: {kind}")
