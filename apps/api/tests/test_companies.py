import uuid
import pytest


COMPANY_YAML = """
kind: Company
metadata:
  name: acme-corp
  namespace: test
spec:
  description: ACME Corporation
  agents:
    - name: alice
      role: engineer
    - name: bob
      role: manager
      reports_to: alice
"""

COMPANY_YAML_UPDATED = """
kind: Company
metadata:
  name: acme-corp
  namespace: test
spec:
  description: ACME Corporation Updated
  agents:
    - name: alice
      role: senior-engineer
    - name: carol
      role: designer
"""


@pytest.mark.asyncio
async def test_create_company(app_client):
    resp = await app_client.post("/api/companies/", json={"yaml_spec": COMPANY_YAML})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "acme-corp"
    assert len(data["agents"]) == 2
    agent_names = {a["name"] for a in data["agents"]}
    assert agent_names == {"alice", "bob"}


@pytest.mark.asyncio
async def test_update_company_syncs_agents(app_client):
    # Create
    create_resp = await app_client.post("/api/companies/", json={"yaml_spec": COMPANY_YAML.replace("acme-corp", f"acme-{uuid.uuid4().hex[:8]}")})
    assert create_resp.status_code == 201
    company_id = create_resp.json()["id"]

    # Update with different agents
    updated_yaml = COMPANY_YAML_UPDATED.replace("acme-corp", create_resp.json()["name"])
    update_resp = await app_client.put(f"/api/companies/{company_id}", json={"yaml_spec": updated_yaml})
    assert update_resp.status_code == 200
    data = update_resp.json()
    agent_names = {a["name"] for a in data["agents"]}
    assert "alice" in agent_names
    assert "carol" in agent_names
    assert "bob" not in agent_names  # removed


@pytest.mark.asyncio
async def test_get_org_structure(app_client):
    unique_name = f"org-test-{uuid.uuid4().hex[:8]}"
    yaml_with_hierarchy = COMPANY_YAML.replace("acme-corp", unique_name)
    create_resp = await app_client.post("/api/companies/", json={"yaml_spec": yaml_with_hierarchy})
    assert create_resp.status_code == 201
    company_id = create_resp.json()["id"]

    resp = await app_client.get(f"/api/companies/{company_id}/org-structure")
    assert resp.status_code == 200
    # alice has no reports_to, bob reports to alice
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_delete_company_cascades(app_client, db_session):
    unique_name = f"del-test-{uuid.uuid4().hex[:8]}"
    yaml = COMPANY_YAML.replace("acme-corp", unique_name)
    create_resp = await app_client.post("/api/companies/", json={"yaml_spec": yaml})
    assert create_resp.status_code == 201
    company_id = create_resp.json()["id"]

    del_resp = await app_client.delete(f"/api/companies/{company_id}")
    assert del_resp.status_code == 204

    get_resp = await app_client.get(f"/api/companies/{company_id}")
    assert get_resp.status_code == 404
