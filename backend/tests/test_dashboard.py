"""Tests for dashboard endpoints."""
from __future__ import annotations

import pytest
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio


async def test_dashboard_summary(client: AsyncClient, auth_headers: dict):
    """GET /dashboard/summary returns 200 with all required fields."""
    response = await client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_devices" in data
    assert "online_devices" in data
    assert "offline_devices" in data
    assert "security_alerts_unresolved" in data
    assert "automations_total" in data
    assert "automations_enabled" in data
    assert isinstance(data["total_devices"], int)
    assert isinstance(data["online_devices"], int)
    assert isinstance(data["offline_devices"], int)
    # offline = total - online
    assert data["offline_devices"] == data["total_devices"] - data["online_devices"]


async def test_dashboard_summary_requires_auth(client: AsyncClient):
    """GET /dashboard/summary without token returns 401."""
    response = await client.get("/api/v1/dashboard/summary")
    assert response.status_code == 401


async def test_network_map(client: AsyncClient, auth_headers: dict):
    """GET /dashboard/network-map returns 200 with expected structure."""
    response = await client.get("/api/v1/dashboard/network-map", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "rooms" in data
    assert "unassigned_devices" in data
    assert "total_devices" in data
    assert "online_count" in data
    assert isinstance(data["rooms"], list)
    assert isinstance(data["unassigned_devices"], list)
    assert isinstance(data["total_devices"], int)
    assert isinstance(data["online_count"], int)


async def test_network_map_requires_auth(client: AsyncClient):
    """GET /dashboard/network-map without token returns 401."""
    response = await client.get("/api/v1/dashboard/network-map")
    assert response.status_code == 401
