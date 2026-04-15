import pytest

MULTI_YAML = """
kind: Company
metadata:
  name: apply-test-corp
  namespace: apply-test
spec:
  agents:
    - name: alice
      role: engineer
---
kind: Pipeline
metadata:
  name: apply-test-pipeline
  namespace: apply-test
spec:
  company_ref:
    name: apply-test-corp
    namespace: apply-test
  nodes: []
  edges: []
"""

COMPANY_ONLY_YAML = """
kind: Company
metadata:
  name: idempotent-corp
  namespace: apply-test
spec:
  agents:
    - name: alice
      role: engineer
"""

UNKNOWN_KIND_YAML = """
kind: Company
metadata:
  name: mixed-test-corp
  namespace: apply-test
spec:
  agents: []
---
kind: Deployment
metadata:
  name: bad-resource
spec: {}
"""


@pytest.mark.asyncio
async def test_apply_multi_document(app_client):
    resp = await app_client.post(
        "/api/apply",
        json={"yaml_content": MULTI_YAML},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["applied"]) == 2
    kinds = {a["kind"] for a in data["applied"]}
    assert "Company" in kinds
    assert "Pipeline" in kinds
    assert len(data["errors"]) == 0


@pytest.mark.asyncio
async def test_apply_is_idempotent(app_client):
    # First apply
    await app_client.post("/api/apply", json={"yaml_content": COMPANY_ONLY_YAML})
    # Second apply — should be "updated"
    resp = await app_client.post("/api/apply", json={"yaml_content": COMPANY_ONLY_YAML})
    assert resp.status_code == 200
    data = resp.json()
    assert data["applied"][0]["action"] == "updated"


@pytest.mark.asyncio
async def test_apply_unknown_kind_partial(app_client):
    resp = await app_client.post("/api/apply", json={"yaml_content": UNKNOWN_KIND_YAML})
    assert resp.status_code == 200
    data = resp.json()
    # Company should succeed, Deployment should error
    assert any(a["kind"] == "Company" for a in data["applied"])
    assert any(e["kind"] == "Deployment" for e in data["errors"])


@pytest.mark.asyncio
async def test_list_resources(app_client):
    resp = await app_client.get("/api/resources?kind=Company&namespace=apply-test")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
