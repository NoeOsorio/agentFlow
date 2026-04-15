import pytest
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine

from agentflow_api.config import settings


@pytest.mark.asyncio
async def test_all_tables_exist(db_engine):
    """All 7 expected tables exist after create_all."""
    async with db_engine.connect() as conn:
        table_names = await conn.run_sync(
            lambda sync_conn: inspect(sync_conn).get_table_names()
        )
    expected = {"companies", "agents", "agent_budgets", "api_keys", "pipelines", "runs", "agent_executions"}
    assert expected.issubset(set(table_names)), f"Missing tables: {expected - set(table_names)}"


@pytest.mark.asyncio
async def test_run_has_timing_columns(db_engine):
    """Run table has started_at and finished_at."""
    async with db_engine.connect() as conn:
        cols = await conn.run_sync(
            lambda c: [col["name"] for col in inspect(c).get_columns("runs")]
        )
    assert "started_at" in cols
    assert "finished_at" in cols


@pytest.mark.asyncio
async def test_agent_execution_has_snapshot_columns(db_engine):
    """AgentExecution has input_snapshot and output_snapshot."""
    async with db_engine.connect() as conn:
        cols = await conn.run_sync(
            lambda c: [col["name"] for col in inspect(c).get_columns("agent_executions")]
        )
    assert "input_snapshot" in cols
    assert "output_snapshot" in cols


@pytest.mark.asyncio
async def test_cascade_delete_agents(db_session):
    """Deleting a Company cascades to Agent rows."""
    import uuid
    from agentflow_api.models import Company, Agent

    company = Company(name=f"test-co-{uuid.uuid4()}", namespace="test", yaml_spec="kind: Company")
    db_session.add(company)
    await db_session.flush()

    agent = Agent(
        company_id=company.id,
        name="alice",
        role="engineer",
        yaml_spec="kind: Agent",
    )
    db_session.add(agent)
    await db_session.commit()

    await db_session.delete(company)
    await db_session.commit()

    from sqlalchemy import select
    result = await db_session.execute(select(Agent).where(Agent.company_id == company.id))
    assert result.scalar_one_or_none() is None
