import os
import uuid
import pytest

INTERNAL_SECRET = "test-secret-123"

PIPELINE_YAML_TEMPLATE = """
kind: Pipeline
metadata:
  name: internal-test-{uid}
  namespace: test
spec:
  nodes: []
  edges: []
"""


@pytest.fixture(autouse=True)
def set_internal_secret(monkeypatch):
    monkeypatch.setenv("INTERNAL_SECRET", INTERNAL_SECRET)


async def _create_run(app_client):
    uid = uuid.uuid4().hex[:8]
    yaml_spec = PIPELINE_YAML_TEMPLATE.replace("{uid}", uid)
    create_resp = await app_client.post("/api/pipelines/", json={"yaml_spec": yaml_spec})
    pipeline_id = create_resp.json()["id"]
    run_resp = await app_client.post(f"/api/pipelines/{pipeline_id}/execute", json={"inputs": {}})
    return run_resp.json()["id"]


@pytest.mark.asyncio
async def test_report_event_creates_execution(app_client):
    run_id = await _create_run(app_client)

    resp = await app_client.post(
        f"/api/internal/runs/{run_id}/events",
        json={
            "node_id": "node1",
            "agent_name": "alice",
            "event_type": "node_complete",
            "status": "completed",
            "tokens_used": 100,
            "cost_usd": 0.003,
            "output_snapshot": {"text": "done"},
        },
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    nodes_resp = await app_client.get(f"/api/runs/{run_id}/nodes")
    assert nodes_resp.status_code == 200
    nodes = nodes_resp.json()
    assert len(nodes) == 1
    assert nodes[0]["agent_name"] == "alice"


@pytest.mark.asyncio
async def test_complete_run(app_client):
    run_id = await _create_run(app_client)

    resp = await app_client.post(
        f"/api/internal/runs/{run_id}/complete",
        json={"status": "completed"},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_internal_requires_secret(app_client):
    resp = await app_client.post(
        "/api/internal/runs/00000000-0000-0000-0000-000000000000/events",
        json={},
        headers={"X-Internal-Secret": "wrong-secret"},
    )
    assert resp.status_code == 401
