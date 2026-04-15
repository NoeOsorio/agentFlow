import uuid
import pytest


PIPELINE_YAML_TEMPLATE = """
kind: Pipeline
metadata:
  name: exec-test-{uid}
  namespace: test
spec:
  nodes: []
  edges: []
"""


@pytest.mark.asyncio
async def test_execute_pipeline_queues_run(app_client):
    uid = uuid.uuid4().hex[:8]
    yaml_spec = PIPELINE_YAML_TEMPLATE.replace("{uid}", uid)
    create_resp = await app_client.post("/api/pipelines/", json={"yaml_spec": yaml_spec})
    assert create_resp.status_code == 201
    pipeline_id = create_resp.json()["id"]

    resp = await app_client.post(
        f"/api/pipelines/{pipeline_id}/execute",
        json={"inputs": {"key": "value"}, "response_mode": "blocking"},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert "id" in data
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_stop_run_sets_cancelled(app_client):
    uid = uuid.uuid4().hex[:8]
    yaml_spec = PIPELINE_YAML_TEMPLATE.replace("{uid}", uid)
    create_resp = await app_client.post("/api/pipelines/", json={"yaml_spec": yaml_spec})
    pipeline_id = create_resp.json()["id"]

    run_resp = await app_client.post(
        f"/api/pipelines/{pipeline_id}/execute",
        json={"inputs": {}},
    )
    run_id = run_resp.json()["id"]

    stop_resp = await app_client.post(f"/api/runs/{run_id}/stop")
    assert stop_resp.status_code == 200
    assert stop_resp.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_get_run_nodes_empty(app_client):
    uid = uuid.uuid4().hex[:8]
    yaml_spec = PIPELINE_YAML_TEMPLATE.replace("{uid}", uid)
    create_resp = await app_client.post("/api/pipelines/", json={"yaml_spec": yaml_spec})
    pipeline_id = create_resp.json()["id"]

    run_resp = await app_client.post(f"/api/pipelines/{pipeline_id}/execute", json={"inputs": {}})
    run_id = run_resp.json()["id"]

    resp = await app_client.get(f"/api/runs/{run_id}/nodes")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
