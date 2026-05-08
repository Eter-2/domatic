from __future__ import annotations

import asyncio
import json
import logging
from typing import Dict, Optional

from fastapi import WebSocket
from redis.asyncio import Redis

logger = logging.getLogger(__name__)

# Redis channels that carry real-time events
SUBSCRIBED_CHANNELS = ("mqtt:events", "security:alerts", "automation:fired")


class WebSocketManager:
    """
    Manages active WebSocket connections and fans out Redis pub/sub messages
    to all connected browser clients.
    """

    def __init__(self) -> None:
        # Maps user_id → WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket, user_id: str) -> None:
        await ws.accept()
        async with self._lock:
            # Close any stale connection for the same user
            if user_id in self.active_connections:
                try:
                    await self.active_connections[user_id].close()
                except Exception:
                    pass
            self.active_connections[user_id] = ws
        logger.info("WebSocket connected: user_id=%s (total=%d)", user_id, len(self.active_connections))

    async def disconnect(self, user_id: str) -> None:
        async with self._lock:
            self.active_connections.pop(user_id, None)
        logger.info("WebSocket disconnected: user_id=%s", user_id)

    async def send_personal(self, user_id: str, message: dict) -> None:
        ws = self.active_connections.get(user_id)
        if ws is not None:
            try:
                await ws.send_json(message)
            except Exception as exc:
                logger.warning("Failed to send to user %s: %s", user_id, exc)
                await self.disconnect(user_id)

    async def broadcast(self, message: dict) -> None:
        """Send message to all connected clients; prune dead connections."""
        dead: list[str] = []
        async with self._lock:
            connections = dict(self.active_connections)

        for user_id, ws in connections.items():
            try:
                await ws.send_json(message)
            except Exception as exc:
                logger.warning("Broadcast failed for user %s: %s", user_id, exc)
                dead.append(user_id)

        for user_id in dead:
            await self.disconnect(user_id)

    async def redis_listener(self, redis_url: str) -> None:
        """
        Subscribe to Redis pub/sub channels and broadcast each message
        to all connected WebSocket clients.

        This runs as an infinite background task.
        """
        while True:
            try:
                redis: Redis = Redis.from_url(redis_url, decode_responses=True)
                async with redis.pubsub() as pubsub:
                    await pubsub.subscribe(*SUBSCRIBED_CHANNELS)
                    logger.info(
                        "Redis listener subscribed to channels: %s",
                        SUBSCRIBED_CHANNELS,
                    )
                    async for raw_message in pubsub.listen():
                        if raw_message["type"] != "message":
                            continue
                        channel: str = raw_message["channel"]
                        data_str: str = raw_message["data"]
                        try:
                            data = json.loads(data_str)
                        except (json.JSONDecodeError, TypeError):
                            data = {"raw": data_str}

                        envelope = {"channel": channel, "data": data}
                        await self.broadcast(envelope)

            except asyncio.CancelledError:
                logger.info("Redis listener task cancelled.")
                break
            except Exception as exc:
                logger.error(
                    "Redis listener error: %s — reconnecting in 5s …", exc, exc_info=True
                )
                await asyncio.sleep(5)


# Singleton instance shared across the application
ws_manager = WebSocketManager()
