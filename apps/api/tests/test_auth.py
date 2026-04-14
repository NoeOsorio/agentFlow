import pytest


@pytest.mark.asyncio
async def test_create_api_key_returns_plain_key(app_client):
    resp = await app_client.post("/api/keys/", json={"name": "test-key", "scopes": ["pipelines:read"]})
    assert resp.status_code == 201
    data = resp.json()
    assert "plain_key" in data
    assert data["plain_key"]
    assert data["revoked"] is False


@pytest.mark.asyncio
async def test_list_keys_no_plain_key(app_client):
    # Create one
    await app_client.post("/api/keys/", json={"name": "list-test", "scopes": ["admin"]})
    resp = await app_client.get("/api/keys/")
    assert resp.status_code == 200
    for key in resp.json():
        assert "plain_key" not in key


@pytest.mark.asyncio
async def test_revoke_key(app_client):
    create_resp = await app_client.post("/api/keys/", json={"name": "revoke-me", "scopes": []})
    key_id = create_resp.json()["id"]

    del_resp = await app_client.delete(f"/api/keys/{key_id}")
    assert del_resp.status_code == 204
