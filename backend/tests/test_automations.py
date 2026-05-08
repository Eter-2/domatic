"""Tests for automation CRUD endpoints."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio

AUTOMATION_PAYLOAD = {
    "name": "Turn off lights at midnight",
    "enabled": True,
    "trigger": {
        "type": "mqtt_topic",
        "topic": "tele/+/SENSOR",
    },
    "conditions": [],
    "actions": [
        {
            "type": "mqtt_publish",
            "topic": "cmnd/living-light/POWER",
            "payload": "OFF",
            "qos": 0,
        }
    ],
}


async def _create_automation(
    client: AsyncClient, auth_headers: dict, payload: dict | None = None
) -> dict:
    resp = await client.post(
        "/api/v1/automations",
        json=payload or AUTOMATION_PAYLOAD,
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_create_automation(client: AsyncClient, auth_headers: dict):
    """POST /automations creates an automation and returns 201."""
    data = await _create_automation(client, auth_headers)
    assert data["name"] == AUTOMATION_PAYLOAD["name"]
    assert data["enabled"] is True
    assert "id" in data
    assert isinstance(data["actions"], list)
    assert len(data["actions"]) == 1


async def test_list_automations(client: AsyncClient, auth_headers: dict):
    """GET /automations returns 200 with a list."""
    await _create_automation(client, auth_headers)
    response = await client.get("/api/v1/automations", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_get_automation(client: AsyncClient, auth_headers: dict):
    """GET /automations/{id} returns 200."""
    created = await _create_automation(client, auth_headers)
    automation_id = created["id"]

    response = await client.get(f"/api/v1/automations/{automation_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == automation_id


async def test_get_automation_not_found(client: AsyncClient, auth_headers: dict):
    """GET /automations/{id} with unknown ID returns 404."""
    fake_id = str(uuid.uuid4())
    response = await client.get(f"/api/v1/automations/{fake_id}", headers=auth_headers)
    assert response.status_code == 404


async def test_toggle_automation(client: AsyncClient, auth_headers: dict):
    """POST /automations/{id}/toggle flips enabled status."""
    created = await _create_automation(client, auth_headers)
    automation_id = created["id"]
    original_enabled = created["enabled"]

    response = await client.post(
        f"/api/v1/automations/{automation_id}/toggle",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["enabled"] is not original_enabled

    # Toggle back
    response2 = await client.post(
        f"/api/v1/automations/{automation_id}/toggle",
        headers=auth_headers,
    )
    assert response2.status_code == 200
    assert response2.json()["enabled"] == original_enabled


async def test_update_automation(client: AsyncClient, auth_headers: dict):
    """PUT /automations/{id} updates name and returns 200."""
    created = await _create_automation(client, auth_headers)
    automation_id = created["id"]

    response = await client.put(
        f"/api/v1/automations/{automation_id}",
        json={"name": "Updated Automation Name", "enabled": False},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Automation Name"
    assert data["enabled"] is False


async def test_delete_automation(client: AsyncClient, auth_headers: dict):
    """DELETE /automations/{id} returns 204 and the automation is gone."""
    payload = {**AUTOMATION_PAYLOAD, "name": "Temporary Automation"}
    created = await _create_automation(client, auth_headers, payload)
    automation_id = created["id"]

    del_response = await client.delete(
        f"/api/v1/automations/{automation_id}", headers=auth_headers
    )
    assert del_response.status_code == 204

    get_response = await client.get(
        f"/api/v1/automations/{automation_id}", headers=auth_headers
    )
    assert get_response.status_code == 404


async def test_automations_require_auth(client: AsyncClient):
    """GET /automations without token returns 401."""
    response = await client.get("/api/v1/automations")
    assert response.status_code == 401


async def test_create_automation_requires_at_least_one_action(
    client: AsyncClient, auth_headers: dict
):
    """POST /automations with empty actions list returns 422."""
    payload = {**AUTOMATION_PAYLOAD, "actions": []}
    response = await client.post("/api/v1/automations", json=payload, headers=auth_headers)
    assert response.status_code == 422
