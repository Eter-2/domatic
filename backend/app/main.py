from __future__ import annotations

import asyncio
import logging
import logging.config
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings
from app.db.base import close_db, init_db
from app.mqtt_bridge import mqtt_bridge_task
from app.websocket_manager import ws_manager

# ── Rate limiter (shared singleton, imported by route modules) ─────────────────
limiter = Limiter(key_func=get_remote_address)

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage startup and shutdown of background services."""

    # ── Startup ───────────────────────────────────────────────────────────────
    logger.info("Dom'Atic backend starting up …")

    # Initialise database (creates tables if not already present)
    await init_db()

    # Connect Redis client
    redis: Redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    app.state.redis = redis
    app.state.mqtt_client = None  # populated by mqtt_bridge_task

    # Start MQTT bridge as a background asyncio Task
    mqtt_task = asyncio.create_task(mqtt_bridge_task(app), name="mqtt-bridge")
    app.state.mqtt_task = mqtt_task

    # Start Redis → WebSocket fan-out listener
    ws_task = asyncio.create_task(
        ws_manager.redis_listener(settings.REDIS_URL), name="ws-redis-listener"
    )
    app.state.ws_task = ws_task

    logger.info("All background services started.")
    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("Dom'Atic backend shutting down …")

    mqtt_task.cancel()
    ws_task.cancel()
    await asyncio.gather(mqtt_task, ws_task, return_exceptions=True)

    await redis.aclose()
    await close_db()
    logger.info("Shutdown complete.")


# ── Application factory ───────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(
        title="Dom'Atic API",
        description=(
            "Local IoT home automation hub — privacy-first, cloud-free, "
            "MQTT-native. Built with FastAPI."
        ),
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # ── Rate limiter ──────────────────────────────────────────────────────────
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ── Security headers ──────────────────────────────────────────────────────
    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ───────────────────────────────────────────────────────────────
    from app.api.routes import (
        auth,
        automations,
        dashboard,
        devices,
        firmware,
        mqtt,
        rooms,
        security,
        ws,
    )

    PREFIX = "/api/v1"

    app.include_router(auth.router, prefix=PREFIX)
    app.include_router(devices.router, prefix=PREFIX)
    app.include_router(rooms.router, prefix=PREFIX)
    app.include_router(security.router, prefix=PREFIX)
    app.include_router(automations.router, prefix=PREFIX)
    app.include_router(mqtt.router, prefix=PREFIX)
    app.include_router(firmware.router, prefix=PREFIX)
    app.include_router(dashboard.router, prefix=PREFIX)
    # WebSocket is registered at /api/v1/ws (not under a sub-prefix)
    app.include_router(ws.router, prefix=PREFIX)

    # ── Health check ──────────────────────────────────────────────────────────
    @app.get("/health", tags=["Health"], include_in_schema=True)
    async def health() -> dict:
        return {
            "status": "ok",
            "mqtt_connected": app.state.mqtt_client is not None,
        }

    return app


app: FastAPI = create_app()
