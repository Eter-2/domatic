"""Tests for authentication endpoints."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import TEST_EMAIL, TEST_PASSWORD, TEST_USERNAME


pytestmark = pytest.mark.asyncio


async def test_login_success(client: AsyncClient):
    """POST /auth/login with valid credentials returns 200 and tokens."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0


async def test_login_wrong_password(client: AsyncClient):
    """POST /auth/login with wrong password returns 401."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": TEST_USERNAME, "password": "wrong-password"},
    )
    assert response.status_code == 401


async def test_login_nonexistent_user(client: AsyncClient):
    """POST /auth/login with non-existent username returns 401."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "nobody", "password": "anything"},
    )
    assert response.status_code == 401


async def test_get_me_authenticated(client: AsyncClient, auth_headers: dict):
    """GET /auth/me with valid token returns user data."""
    response = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == TEST_USERNAME
    assert data["email"] == TEST_EMAIL
    assert data["is_active"] is True
    assert "id" in data


async def test_get_me_unauthenticated(client: AsyncClient):
    """GET /auth/me without token returns 401."""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


async def test_refresh_token(client: AsyncClient):
    """POST /auth/refresh with valid refresh token returns new access token."""
    # Get a refresh token first
    login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
    )
    assert login_response.status_code == 200
    refresh_token = login_response.json()["refresh_token"]

    # Use the refresh token
    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


async def test_refresh_token_invalid(client: AsyncClient):
    """POST /auth/refresh with invalid token returns 401."""
    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "invalid.jwt.token"},
    )
    assert response.status_code == 401


async def test_logout(client: AsyncClient, auth_headers: dict):
    """POST /auth/logout returns 204."""
    response = await client.post("/api/v1/auth/logout", headers=auth_headers)
    assert response.status_code == 204
