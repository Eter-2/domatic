"""Tests for security event endpoints."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import security_service


pytestmark = pytest.mark.asyncio


async def _seed_event(db: AsyncSession, severity: str = "medium") -> str:
    """Insert a security event and return its string ID."""
    event = await security_service.log_event(
        db=db,
        event_type="test_event",
        description="Test security event",
        severity=severity,
    )
    await db.commit()
    return str(event.id)


async def test_list_security_events(client: AsyncClient, auth_headers: dict, test_db: AsyncSession):
    """GET /security/events returns 200."""
    await _seed_event(test_db)
    response = await client.get("/api/v1/security/events", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_list_security_events_requires_auth(client: AsyncClient):
    """GET /security/events without token returns 401."""
    response = await client.get("/api/v1/security/events")
    assert response.status_code == 401


async def test_get_security_stats(client: AsyncClient, auth_headers: dict, test_db: AsyncSession):
    """GET /security/stats returns 200 with required count fields."""
    await _seed_event(test_db, "high")
    await _seed_event(test_db, "critical")
    response = await client.get("/api/v1/security/stats", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_events" in data
    assert "unresolved_events" in data
    assert "by_severity" in data
    assert "recent_critical" in data
    assert "recent_high" in data
    assert isinstance(data["total_events"], int)
    assert isinstance(data["by_severity"], dict)


async def test_resolve_event(client: AsyncClient, auth_headers: dict, test_db: AsyncSession):
    """POST /security/events/{id}/resolve returns 200 with resolved=True."""
    event_id = await _seed_event(test_db)
    response = await client.post(
        f"/api/v1/security/events/{event_id}/resolve",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["resolved"] is True
    assert data["resolved_at"] is not None


async def test_resolve_event_not_found(client: AsyncClient, auth_headers: dict):
    """POST /security/events/{id}/resolve with unknown ID returns 404."""
    fake_id = str(uuid.uuid4())
    response = await client.post(
        f"/api/v1/security/events/{fake_id}/resolve",
        headers=auth_headers,
    )
    assert response.status_code == 404


async def test_list_events_filter_by_severity(client: AsyncClient, auth_headers: dict, test_db: AsyncSession):
    """GET /security/events?severity=critical filters correctly."""
    await _seed_event(test_db, "critical")
    response = await client.get(
        "/api/v1/security/events?severity=critical", headers=auth_headers
    )
    assert response.status_code == 200
    events = response.json()
    assert all(e["severity"] == "critical" for e in events)


async def test_list_events_filter_by_resolved(client: AsyncClient, auth_headers: dict, test_db: AsyncSession):
    """GET /security/events?resolved=false returns only unresolved events."""
    response = await client.get(
        "/api/v1/security/events?resolved=false", headers=auth_headers
    )
    assert response.status_code == 200
    events = response.json()
    assert all(e["resolved"] is False for e in events)
