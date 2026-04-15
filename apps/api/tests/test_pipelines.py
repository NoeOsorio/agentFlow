import uuid
import pytest

PIPELINE_YAML = """
kind: Pipeline
metadata:
  name: test-pipeline-{uid}
  namespace: test
spec:
  nodes:
    - id: node1
      type: llm
    - id: node2
      type: llm
  edges:
    - from: node1
      to: node2
"""


@pytest.mark.asyncio
async def test_create_pipeline_without_company(app_client):
    uid = uuid.uuid4().hex[:8]
    yaml_spec = PIPELINE_YAML.replace("{uid}", uid)
    resp = await app_client.post("/api/pipelines/", json={"yaml_spec": yaml_spec})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == f"test-pipeline-{uid}"
    assert data["company_id"] is None


@pytest.mark.asyncio
async def test_get_compiled_pipeline(app_client):
    uid = uuid.uuid4().hex[:8]
    yaml_spec = PIPELINE_YAML.replace("{uid}", uid)
    create_resp = await app_client.post("/api/pipelines/", json={"yaml_spec": yaml_spec})
    assert create_resp.status_code == 201
    pipeline_id = create_resp.json()["id"]

    resp = await app_client.get(f"/api/pipelines/{pipeline_id}/compiled")
    assert resp.status_code == 200
    data = resp.json()
    assert "adjacency" in data
    assert "entry_points" in data
    assert "exit_points" in data
    assert data["node_count"] == 2


@pytest.mark.asyncio
async def test_validate_pipeline(app_client):
    uid = uuid.uuid4().hex[:8]
    yaml_spec = PIPELINE_YAML.replace("{uid}", uid)
    create_resp = await app_client.post("/api/pipelines/", json={"yaml_spec": yaml_spec})
    pipeline_id = create_resp.json()["id"]

    resp = await app_client.get(f"/api/pipelines/{pipeline_id}/validate")
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is True
    assert data["errors"] == []
