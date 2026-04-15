"""Helper to convert a Run ORM object to a RunRead Pydantic schema."""
from .models import Run
from .schemas import RunRead


def run_to_read(run: Run) -> RunRead:
    return RunRead(
        id=run.id,
        pipeline_id=run.pipeline_id,
        status=run.status if isinstance(run.status, str) else run.status.value,
        created_at=run.created_at,
        updated_at=run.updated_at,
    )
