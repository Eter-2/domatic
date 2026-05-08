"""
Test configuration and fixtures for Dom'Atic backend.

Uses an in-memory SQLite database to avoid requiring PostgreSQL, Redis, or MQTT
during CI / local test runs.

IMPORTANT: Environment variables must be set before ANY app module is imported
because app.config.settings uses @lru_cache (read once at import time).
We achieve this via the module-level os.environ assignments below AND by
ensuring pytest loads this file before test collection (it always does).
"""
from __future__ import annotations

import os

# ── Must happen BEFORE any app import ────────────────────────────────────────
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["SECRET_KEY"] = "test-secret-key-at-least-32-chars-long-ok"
os.environ["LOG_LEVEL"] = "WARNING"
# Alias used by Settings model
os.environ["CORS_ORIGINS"] = "http://localhost:3000"
os.environ["SECURITY_CLOUD_DOMAINS"] = "amazonaws.com,cloud.tuya.com,iot.tuya.com"

import uuid
from typing import AsyncGenerator
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# ── Now safe to import app modules ────────────────────────────────────────────
from app.db.base import Base
from app.db.models import User
from app.services.auth_service import hash_password

# Disable slowapi rate limiter globally during tests
from app.main import limiter as _limiter
_limiter.enabled = False


# ── In-memory SQLite engine / session factory ─────────────────────────────────

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

TestSessionMaker = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ── Schema creation (once per session) ───────────────────────────────────────

@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_tables():
    """Create all tables in the in-memory SQLite database once per test session."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ── Admin user (once per session) ─────────────────────────────────────────────

TEST_USERNAME = "admin"
TEST_PASSWORD = "testpassword123"
TEST_EMAIL = "admin@domatic.test"


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_admin_user(create_tables):
    """Create the test admin user once for the whole test session."""
    async with TestSessionMaker() as session:
        from sqlalchemy import select

        result = await session.execute(
            select(User).where(User.username == TEST_USERNAME)
        )
        existing = result.scalar_one_or_none()
        if existing is None:
            user = User(
                username=TEST_USERNAME,
                email=TEST_EMAIL,
                hashed_password=hash_password(TEST_PASSWORD),
                is_active=True,
            )
            session.add(user)
            await session.commit()


# ── Per-test DB session (shared connection to same in-memory DB) ──────────────

@pytest_asyncio.fixture()
async def test_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async DB session for the in-memory SQLite database."""
    async with TestSessionMaker() as session:
        yield session
        await session.rollback()


# ── DB dependency override (points to the same in-memory DB) ─────────────────

async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionMaker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ── Async HTTP client with mocked lifespan ────────────────────────────────────

@pytest_asyncio.fixture()
async def client() -> AsyncGenerator[AsyncClient, None]:
    """
    Async HTTP test client backed by the FastAPI app.
    Redis, MQTT, and WebSocket fan-out are patched so no external
    services are required.
    """
    from app.main import create_app
    from app.db.base import get_db

    app = create_app()
    app.dependency_overrides[get_db] = _override_get_db

    mock_redis = AsyncMock()
    mock_redis.aclose = AsyncMock()

    async def _noop(*args, **kwargs):
        pass

    with (
        patch("app.main.Redis.from_url", return_value=mock_redis),
        patch("app.main.mqtt_bridge_task", new=AsyncMock(return_value=None)),
        patch(
            "app.websocket_manager.ws_manager.redis_listener",
            new=_noop,
        ),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as ac:
            yield ac


# ── Authenticated headers fixture ─────────────────────────────────────────────

@pytest_asyncio.fixture()
async def auth_headers(client: AsyncClient) -> dict:
    """Log in as the test admin and return Bearer auth headers."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
