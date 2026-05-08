"""Tests for room CRUD endpoints."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio

ROOM_PAYLOAD = {
    "name": "Living Room",
    "icon": "sofa",
    "floor": 0,
}


async def _create_room(client: AsyncClient, auth_headers: dict, payload: dict | None = None) -> dict:
    resp = await client.post(
        "/api/v1/rooms",
        json=payload or ROOM_PAYLOAD,
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_create_room(client: AsyncClient, auth_headers: dict):
    """POST /rooms creates a room and returns 201."""
    data = await _create_room(client, auth_headers)
    assert data["name"] == ROOM_PAYLOAD["name"]
    assert data["icon"] == ROOM_PAYLOAD["icon"]
    assert data["floor"] == ROOM_PAYLOAD["floor"]
    assert "id" in data
    assert "device_count" in data


async def test_list_rooms(client: AsyncClient, auth_headers: dict):
    """GET /rooms returns 200 with a list."""
    await _create_room(client, auth_headers)
    response = await client.get("/api/v1/rooms", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_get_room(client: AsyncClient, auth_headers: dict):
    """GET /rooms/{id} returns 200 with room data."""
    created = await _create_room(client, auth_headers)
    room_id = created["id"]

    response = await client.get(f"/api/v1/rooms/{room_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == room_id


async def test_get_room_not_found(client: AsyncClient, auth_headers: dict):
    """GET /rooms/{id} with unknown ID returns 404."""
    fake_id = str(uuid.uuid4())
    response = await client.get(f"/api/v1/rooms/{fake_id}", headers=auth_headers)
    assert response.status_code == 404


async def test_update_room(client: AsyncClient, auth_headers: dict):
    """PUT /rooms/{id} updates the room and returns 200."""
    created = await _create_room(client, auth_headers)
    room_id = created["id"]

    response = await client.put(
        f"/api/v1/rooms/{room_id}",
        json={"name": "Master Bedroom", "floor": 1},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Master Bedroom"
    assert data["floor"] == 1


async def test_delete_room(client: AsyncClient, auth_headers: dict):
    """DELETE /rooms/{id} returns 204 and the room is gone."""
    created = await _create_room(client, auth_headers, {"name": "Temp Room", "icon": "home", "floor": 2})
    room_id = created["id"]

    del_response = await client.delete(f"/api/v1/rooms/{room_id}", headers=auth_headers)
    assert del_response.status_code == 204

    get_response = await client.get(f"/api/v1/rooms/{room_id}", headers=auth_headers)
    assert get_response.status_code == 404


async def test_room_requires_auth(client: AsyncClient):
    """GET /rooms without token returns 401."""
    response = await client.get("/api/v1/rooms")
    assert response.status_code == 401
