import uuid
import yaml as _yaml
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ..database import get_db
from ..models import Agent, Company, Pipeline, Run, AgentExecution
from ..run_read import run_to_read
from ..schemas import RunRead

router = APIRouter(prefix="/pipelines", tags=["pipelines"])

DB = Annotated[AsyncSession, Depends(get_db)]


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class PipelineRead(BaseModel):
    id: uuid.UUID
    name: str
    namespace: str
    company_id: uuid.UUID | None
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ValidationResult(BaseModel):
    valid: bool
    errors: list[str] = []


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_pipeline_yaml(yaml_spec: str) -> dict:
    try:
        doc = _yaml.safe_load(yaml_spec)
    except _yaml.YAMLError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid YAML: {exc}")
    if not doc or doc.get("kind") != "Pipeline":
        raise HTTPException(status_code=422, detail="YAML must have kind: Pipeline")
    meta = doc.get("metadata", {})
    if not meta.get("name"):
        raise HTTPException(status_code=422, detail="metadata.name is required")
    return doc


async def _resolve_company_ref(db: AsyncSession, spec: dict) -> Company | None:
    """Resolve company_ref from pipeline spec. Returns Company or raises 422."""
    company_ref = spec.get("spec", {}).get("company_ref")
    if not company_ref:
        return None
    ref_name = company_ref if isinstance(company_ref, str) else company_ref.get("name")
    ref_namespace = company_ref.get("namespace", "default") if isinstance(company_ref, dict) else "default"
    result = await db.execute(
        select(Company).where(Company.name == ref_name, Company.namespace == ref_namespace)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=422, detail=f"Company '{ref_name}' not found in namespace '{ref_namespace}'")
    return company


async def _validate_agent_refs(db: AsyncSession, spec: dict, company: Company) -> list[str]:
    """Check all agent_ref names in pipeline nodes exist in the company. Returns list of errors."""
    errors = []
    nodes = spec.get("spec", {}).get("nodes", []) or []
    # Get all agent names in this company
    result = await db.execute(select(Agent.name).where(Agent.company_id == company.id))
    company_agent_names = {row[0] for row in result.all()}

    for node in nodes:
        agent_ref = node.get("agent_ref")
        if not agent_ref:
            continue
        ref_name = agent_ref if isinstance(agent_ref, str) else agent_ref.get("name", "")
        if ref_name and ref_name not in company_agent_names:
            errors.append(f"Agent '{ref_name}' not found in company '{company.name}'")
    return errors


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[PipelineRead])
async def list_pipelines(
    db: DB,
    company_id: uuid.UUID | None = Query(default=None),
    namespace: str | None = Query(default=None),
):
    query = select(Pipeline).order_by(Pipeline.created_at.desc())
    if company_id:
        query = query.where(Pipeline.company_id == company_id)
    if namespace:
        query = query.where(Pipeline.namespace == namespace)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=PipelineRead, status_code=201)
async def create_pipeline(request_body: dict, db: DB):
    """Create pipeline from YAML. Body: { yaml_spec: str }"""
    yaml_spec = request_body.get("yaml_spec", "")
    doc = _parse_pipeline_yaml(yaml_spec)
    meta = doc.get("metadata", {})
    name = meta["name"]
    namespace = meta.get("namespace", "default")

    company = await _resolve_company_ref(db, doc)
    if company:
        errors = await _validate_agent_refs(db, doc, company)
        if errors:
            raise HTTPException(status_code=422, detail="; ".join(errors))

    pipeline = Pipeline(
        name=name,
        namespace=namespace,
        yaml_spec=yaml_spec,
        company_id=company.id if company else None,
        webhook_secret=meta.get("webhook_secret"),
    )
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


@router.put("/{pipeline_id}", response_model=PipelineRead)
async def update_pipeline(pipeline_id: uuid.UUID, request_body: dict, db: DB):
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    yaml_spec = request_body.get("yaml_spec", "")
    doc = _parse_pipeline_yaml(yaml_spec)
    meta = doc.get("metadata", {})

    company = await _resolve_company_ref(db, doc)
    if company:
        errors = await _validate_agent_refs(db, doc, company)
        if errors:
            raise HTTPException(status_code=422, detail="; ".join(errors))

    pipeline.yaml_spec = yaml_spec
    pipeline.name = meta["name"]
    pipeline.namespace = meta.get("namespace", pipeline.namespace)
    pipeline.company_id = company.id if company else pipeline.company_id
    pipeline.version = pipeline.version + 1
    pipeline.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(pipeline)
    return pipeline


@router.delete("/{pipeline_id}", status_code=204)
async def delete_pipeline(pipeline_id: uuid.UUID, db: DB):
    from sqlalchemy import delete as sql_delete
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    run_ids = select(Run.id).where(Run.pipeline_id == pipeline_id)
    await db.execute(sql_delete(AgentExecution).where(AgentExecution.run_id.in_(run_ids)))
    await db.execute(sql_delete(Run).where(Run.pipeline_id == pipeline_id))
    await db.delete(pipeline)
    await db.commit()


@router.get("/{pipeline_id}/validate", response_model=ValidationResult)
async def validate_pipeline(pipeline_id: uuid.UUID, db: DB):
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    errors = []
    try:
        doc = _parse_pipeline_yaml(pipeline.yaml_spec)
        company = await _resolve_company_ref(db, doc)
        if company:
            agent_errors = await _validate_agent_refs(db, doc, company)
            errors.extend(agent_errors)
    except HTTPException as exc:
        errors.append(exc.detail)

    return ValidationResult(valid=len(errors) == 0, errors=errors)


@router.get("/{pipeline_id}/compiled")
async def get_compiled_pipeline(pipeline_id: uuid.UUID, db: DB):
    """Returns a simple compiled representation of the pipeline DAG."""
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    try:
        doc = _yaml.safe_load(pipeline.yaml_spec) or {}
    except Exception:
        raise HTTPException(status_code=422, detail="Could not parse pipeline YAML")

    nodes = doc.get("spec", {}).get("nodes", []) or []
    edges = doc.get("spec", {}).get("edges", []) or []

    # Build adjacency map
    adjacency: dict[str, list[str]] = {n["id"]: [] for n in nodes if "id" in n}
    for edge in edges:
        src = edge.get("from") or edge.get("source")
        dst = edge.get("to") or edge.get("target")
        if src and dst and src in adjacency:
            adjacency[src].append(dst)

    # Find entry and exit points
    all_targets = {dst for targets in adjacency.values() for dst in targets}
    entry_points = [nid for nid in adjacency if nid not in all_targets]
    exit_points = [nid for nid, targets in adjacency.items() if not targets]

    return {
        "pipeline_id": str(pipeline_id),
        "name": pipeline.name,
        "adjacency": adjacency,
        "entry_points": entry_points,
        "exit_points": exit_points,
        "node_count": len(nodes),
        "edge_count": len(edges),
    }


@router.post("/{pipeline_id}/execute", response_model=RunRead, status_code=202)
async def execute_pipeline_endpoint(pipeline_id: uuid.UUID, body: dict, db: DB):
    """Trigger a pipeline run. Dispatches Celery task if available."""
    import json
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    run = Run(
        pipeline_id=pipeline_id,
        status="pending",
        trigger_data=json.dumps(body.get("inputs", {})),
    )
    db.add(run)
    await db.commit()

    # Dispatch Celery task if available
    try:
        from agentflow_runtime.tasks import execute_pipeline
        company_yaml = None
        if pipeline.company_id:
            company = await db.get(Company, pipeline.company_id)
            company_yaml = company.yaml_spec if company else None
        execute_pipeline.delay(
            run_id=str(run.id),
            pipeline_yaml=pipeline.yaml_spec,
            company_yaml=company_yaml,
            trigger_data=body.get("inputs", {}),
        )
    except ImportError:
        pass  # Runtime not available in this environment

    loaded = await db.execute(
        select(Run).options(joinedload(Run.pipeline)).where(Run.id == run.id)
    )
    run_loaded = loaded.unique().scalar_one()
    return run_to_read(run_loaded)
