"""Tests for device CRUD endpoints."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio

DEVICE_PAYLOAD = {
    "name": "Living Room Light",
    "protocol": "wifi",
    "chip_type": "esp32",
    "firmware_type": "tasmota",
    "mqtt_topic": "tele/living-light/SENSOR",
}


async def _create_device(client: AsyncClient, auth_headers: dict, payload: dict | None = None) -> dict:
    resp = await client.post(
        "/api/v1/devices",
        json=payload or DEVICE_PAYLOAD,
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_create_device(client: AsyncClient, auth_headers: dict):
    """POST /devices creates a device and returns 201."""
    data = await _create_device(client, auth_headers)
    assert data["name"] == DEVICE_PAYLOAD["name"]
    assert data["protocol"] == DEVICE_PAYLOAD["protocol"]
    assert data["chip_type"] == DEVICE_PAYLOAD["chip_type"]
    assert "id" in data


async def test_list_devices(client: AsyncClient, auth_headers: dict):
    """GET /devices returns 200 with a list."""
    await _create_device(client, auth_headers)
    response = await client.get("/api/v1/devices", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_get_device(client: AsyncClient, auth_headers: dict):
    """GET /devices/{id} returns 200 with device data."""
    created = await _create_device(client, auth_headers)
    device_id = created["id"]

    response = await client.get(f"/api/v1/devices/{device_id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == device_id
    assert data["name"] == DEVICE_PAYLOAD["name"]


async def test_get_device_not_found(client: AsyncClient, auth_headers: dict):
    """GET /devices/{id} with unknown ID returns 404."""
    fake_id = str(uuid.uuid4())
    response = await client.get(f"/api/v1/devices/{fake_id}", headers=auth_headers)
    assert response.status_code == 404


async def test_update_device(client: AsyncClient, auth_headers: dict):
    """PUT /devices/{id} updates device name and returns 200."""
    created = await _create_device(client, auth_headers)
    device_id = created["id"]

    response = await client.put(
        f"/api/v1/devices/{device_id}",
        json={"name": "Updated Light"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Light"


async def test_delete_device(client: AsyncClient, auth_headers: dict):
    """DELETE /devices/{id} returns 204 and the device is gone."""
    payload = {**DEVICE_PAYLOAD, "mac_address": "AA:BB:CC:DD:EE:01"}
    created = await _create_device(client, auth_headers, payload)
    device_id = created["id"]

    del_response = await client.delete(
        f"/api/v1/devices/{device_id}", headers=auth_headers
    )
    assert del_response.status_code == 204

    # Verify it's gone
    get_response = await client.get(
        f"/api/v1/devices/{device_id}", headers=auth_headers
    )
    assert get_response.status_code == 404


async def test_device_requires_auth(client: AsyncClient):
    """GET /devices without token returns 401."""
    response = await client.get("/api/v1/devices")
    assert response.status_code == 401


async def test_device_state_not_found_device(client: AsyncClient, auth_headers: dict):
    """GET /devices/{id}/state with unknown device returns 404."""
    fake_id = str(uuid.uuid4())
    response = await client.get(
        f"/api/v1/devices/{fake_id}/state", headers=auth_headers
    )
    assert response.status_code == 404


async def test_device_history_not_found_device(client: AsyncClient, auth_headers: dict):
    """GET /devices/{id}/history with unknown device returns 404."""
    fake_id = str(uuid.uuid4())
    response = await client.get(
        f"/api/v1/devices/{fake_id}/history", headers=auth_headers
    )
    assert response.status_code == 404


async def test_device_state_empty(client: AsyncClient, auth_headers: dict):
    """GET /devices/{id}/state returns 200 with null when no state exists."""
    payload = {**DEVICE_PAYLOAD, "mac_address": "AA:BB:CC:DD:EE:02"}
    created = await _create_device(client, auth_headers, payload)
    device_id = created["id"]

    response = await client.get(
        f"/api/v1/devices/{device_id}/state", headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json() is None


async def test_device_history_empty(client: AsyncClient, auth_headers: dict):
    """GET /devices/{id}/history returns 200 with empty list when no history."""
    payload = {**DEVICE_PAYLOAD, "mac_address": "AA:BB:CC:DD:EE:03"}
    created = await _create_device(client, auth_headers, payload)
    device_id = created["id"]

    response = await client.get(
        f"/api/v1/devices/{device_id}/history", headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json() == []
