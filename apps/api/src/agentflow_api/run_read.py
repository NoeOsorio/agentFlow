"""Serialize Run ORM rows to RunRead (includes pipeline name when relationship is loaded)."""

from .models import Run, RunStatus
from .schemas import RunRead


def run_to_read(run: Run) -> RunRead:
    p = run.pipeline
    status = run.status.value if isinstance(run.status, RunStatus) else str(run.status)
    return RunRead(
        id=run.id,
        pipeline_id=run.pipeline_id,
        status=status,
        created_at=run.created_at,
        updated_at=run.updated_at,
        pipeline_name=p.name if p is not None else None,
        pipeline_namespace=p.namespace if p is not None else None,
    )
