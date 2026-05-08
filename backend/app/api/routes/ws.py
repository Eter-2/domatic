from __future__ import annotations

import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from jose import JWTError

from app.config import settings
from app.services.auth_service import verify_token
from app.websocket_manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token for authentication."),
):
    """
    WebSocket endpoint for real-time event streaming.

    Authenticate by passing ?token=<access_token> in the URL.
    After connection, the server streams JSON envelopes:
      {"channel": "mqtt:events"|"security:alerts"|"automation:fired", "data": {...}}

    Ping/pong keepalive is handled automatically by the ASGI server (uvicorn).
    """
    # Authenticate before accepting
    try:
        payload = verify_token(token, expected_type="access")
        user_id: str = payload["sub"]
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        logger.warning("WebSocket authentication failed — connection rejected.")
        return

    await ws_manager.connect(websocket, user_id)
    logger.info("WebSocket session opened for user %s", user_id)

    try:
        while True:
            # Keep the connection alive by waiting for client messages.
            # Clients may send {"type": "ping"} for application-level heartbeat.
            data = await websocket.receive_json()
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for user %s", user_id)
    except Exception as exc:
        logger.error("WebSocket error for user %s: %s", user_id, exc)
    finally:
        await ws_manager.disconnect(user_id)
