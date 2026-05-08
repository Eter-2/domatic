from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import aiomqtt
from fastapi import FastAPI
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.base import async_session_maker
from app.db.models import Device, DeviceState, MqttMessage
from app.services import automation_service, security_service

logger = logging.getLogger(__name__)

# ── Topic utilities ───────────────────────────────────────────────────────────

_STATE_TOPIC_KEYWORDS = ("tele/", "stat/", "/state", "/sensor", "/STATUS", "/LWT")


def _is_state_topic(topic: str) -> bool:
    return any(kw in topic for kw in _STATE_TOPIC_KEYWORDS)


def _parse_payload(payload: bytes) -> str:
    try:
        return payload.decode("utf-8", errors="replace")
    except Exception:
        return str(payload)


# ── Row-cap enforcement ───────────────────────────────────────────────────────

async def _enforce_mqtt_cap(db: AsyncSession) -> None:
    """Delete oldest rows when mqtt_messages exceeds MQTT_MESSAGE_MAX_ROWS."""
    count_result = await db.execute(select(func.count(MqttMessage.id)))
    count: int = count_result.scalar_one()
    overflow = count - settings.MQTT_MESSAGE_MAX_ROWS
    if overflow <= 0:
        return

    oldest_result = await db.execute(
        select(MqttMessage.id)
        .order_by(MqttMessage.received_at.asc())
        .limit(overflow)
    )
    ids_to_delete = [row[0] for row in oldest_result.all()]
    if ids_to_delete:
        for msg_id in ids_to_delete:
            result = await db.execute(select(MqttMessage).where(MqttMessage.id == msg_id))
            obj = result.scalar_one_or_none()
            if obj:
                await db.delete(obj)
        logger.debug("Pruned %d old MQTT messages.", len(ids_to_delete))


# ── State persistence ─────────────────────────────────────────────────────────

async def _maybe_persist_state(
    db: AsyncSession, topic: str, payload_str: str, device_id: Optional[uuid.UUID]
) -> None:
    """If the topic looks like a state/sensor topic, insert a DeviceState row."""
    if not _is_state_topic(topic):
        return
    if device_id is None:
        return

    state_data: Any = None
    try:
        state_data = json.loads(payload_str)
    except (json.JSONDecodeError, ValueError):
        state_data = {"raw": payload_str}

    if not isinstance(state_data, dict):
        state_data = {"value": state_data}

    ds = DeviceState(device_id=device_id, state=state_data)
    db.add(ds)
    await db.flush()


# ── Core message processor ────────────────────────────────────────────────────

async def process_mqtt_message(message: aiomqtt.Message, app: FastAPI) -> None:
    topic = str(message.topic)
    payload_str = _parse_payload(message.payload)
    now = datetime.now(timezone.utc)

    async with async_session_maker() as db:
        try:
            # 1. Persist to mqtt_messages ring-buffer
            mqtt_msg = MqttMessage(
                topic=topic,
                payload=payload_str,
                qos=message.qos,
                retained=bool(message.retain),
                received_at=now,
            )
            db.add(mqtt_msg)
            await db.flush()
            await _enforce_mqtt_cap(db)

            # 2. Update device last_seen / is_online
            from app.services.device_service import update_online_status

            device = await update_online_status(db, topic, is_online=True, last_seen=now)
            device_id: Optional[uuid.UUID] = device.id if device else None

            # Also check if the topic's base path matches a registered device topic
            if device_id is None:
                # Strip trailing segments to find base topic (e.g. "tele/device/SENSOR" → "device")
                parts = topic.split("/")
                for i in range(len(parts), 0, -1):
                    candidate = "/".join(parts[:i])
                    dev = await update_online_status(
                        db, candidate, is_online=True, last_seen=now
                    )
                    if dev:
                        device_id = dev.id
                        break

            # 3. Persist state if applicable
            await _maybe_persist_state(db, topic, payload_str, device_id)

            # 4. Evaluate automations
            await automation_service.evaluate(db, device_id, topic, payload_str, app.state.mqtt_client)

            # 5. Security inspection
            anomaly = security_service.inspect_mqtt_payload(topic, payload_str)
            if anomaly is not None:
                await security_service.log_event(
                    db=db,
                    event_type=anomaly.event_type,
                    description=anomaly.description,
                    severity=anomaly.severity,
                    device_id=device_id,
                    source_ip=anomaly.source_ip,
                    dest_ip=anomaly.destination_ip,
                    blocked=anomaly.blocked,
                )

            await db.commit()

            # 6. Publish to Redis pub/sub for WebSocket fan-out
            envelope = json.dumps({
                "type": "mqtt_message",
                "topic": topic,
                "payload": payload_str,
                "device_id": str(device_id) if device_id else None,
                "timestamp": now.isoformat(),
            })
            redis_client = app.state.redis
            await redis_client.publish("mqtt:events", envelope)

        except Exception as exc:
            logger.error("Error processing MQTT message on topic '%s': %s", topic, exc, exc_info=True)
            await db.rollback()


# ── Background task entry point ────────────────────────────────────────────────

async def mqtt_bridge_task(app: FastAPI) -> None:
    """
    Long-running background task that connects to the MQTT broker and
    forwards all messages through process_mqtt_message.
    """
    mqtt_kwargs = {
        "hostname": settings.MQTT_HOST,
        "port": settings.MQTT_PORT,
        "identifier": settings.MQTT_CLIENT_ID,
    }
    if settings.MQTT_USERNAME:
        mqtt_kwargs["username"] = settings.MQTT_USERNAME
    if settings.MQTT_PASSWORD:
        mqtt_kwargs["password"] = settings.MQTT_PASSWORD

    reconnect_delay = 5  # seconds

    while True:
        try:
            logger.info(
                "MQTT bridge connecting to %s:%s …",
                settings.MQTT_HOST,
                settings.MQTT_PORT,
            )
            async with aiomqtt.Client(**mqtt_kwargs) as client:
                app.state.mqtt_client = client
                logger.info("MQTT bridge connected. Subscribing to '%s'.", settings.MQTT_SUBSCRIBE_TOPIC)
                await client.subscribe(settings.MQTT_SUBSCRIBE_TOPIC, qos=0)

                async with client.messages() as messages:
                    async for message in messages:
                        asyncio.ensure_future(process_mqtt_message(message, app))

        except aiomqtt.MqttError as exc:
            logger.warning(
                "MQTT connection lost: %s. Reconnecting in %ds …",
                exc,
                reconnect_delay,
            )
            app.state.mqtt_client = None
            await asyncio.sleep(reconnect_delay)
        except asyncio.CancelledError:
            logger.info("MQTT bridge task cancelled.")
            break
        except Exception as exc:
            logger.error("Unexpected MQTT bridge error: %s", exc, exc_info=True)
            await asyncio.sleep(reconnect_delay)
