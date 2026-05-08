from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Device, DeviceState, Room
from app.schemas.devices import DeviceCreate, DeviceResponse, DeviceStateResponse, DeviceUpdate

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_device_response(device: Device) -> DeviceResponse:
    return DeviceResponse(
        id=device.id,
        name=device.name,
        room_id=device.room_id,
        room_name=device.room.name if device.room else None,
        protocol=device.protocol,
        chip_type=device.chip_type,
        ip_address=device.ip_address,
        mac_address=device.mac_address,
        firmware_type=device.firmware_type,
        firmware_version=device.firmware_version,
        last_seen=device.last_seen,
        is_online=device.is_online,
        is_cloud_dependent=device.is_cloud_dependent,
        mqtt_topic=device.mqtt_topic,
        metadata_=device.metadata_,
        created_at=device.created_at,
    )


async def _get_device_or_404(db: AsyncSession, device_id: uuid.UUID) -> Device:
    from fastapi import HTTPException, status

    result = await db.execute(
        select(Device)
        .options(selectinload(Device.room))
        .where(Device.id == device_id)
    )
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Device not found."
        )
    return device


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def get_all_devices(
    db: AsyncSession, room_id: Optional[uuid.UUID] = None
) -> List[DeviceResponse]:
    stmt = select(Device).options(selectinload(Device.room))
    if room_id is not None:
        stmt = stmt.where(Device.room_id == room_id)
    stmt = stmt.order_by(Device.name)
    result = await db.execute(stmt)
    devices = result.scalars().all()
    return [_build_device_response(d) for d in devices]


async def get_device(db: AsyncSession, device_id: uuid.UUID) -> DeviceResponse:
    device = await _get_device_or_404(db, device_id)
    return _build_device_response(device)


async def create_device(db: AsyncSession, data: DeviceCreate) -> DeviceResponse:
    device = Device(
        name=data.name,
        room_id=data.room_id,
        protocol=data.protocol,
        chip_type=data.chip_type,
        ip_address=data.ip_address,
        mac_address=data.mac_address,
        firmware_type=data.firmware_type,
        firmware_version=data.firmware_version,
        is_cloud_dependent=data.is_cloud_dependent,
        mqtt_topic=data.mqtt_topic,
        metadata_=data.metadata,
    )
    db.add(device)
    await db.flush()
    await db.refresh(device, attribute_names=["room"])
    logger.info("Device created: %s (%s)", device.name, device.id)
    return _build_device_response(device)


async def update_device(
    db: AsyncSession, device_id: uuid.UUID, data: DeviceUpdate
) -> DeviceResponse:
    device = await _get_device_or_404(db, device_id)
    update_data = data.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(device, field, value)
    await db.flush()
    await db.refresh(device, attribute_names=["room"])
    logger.info("Device updated: %s", device_id)
    return _build_device_response(device)


async def delete_device(db: AsyncSession, device_id: uuid.UUID) -> None:
    from fastapi import HTTPException, status

    device = await _get_device_or_404(db, device_id)
    await db.delete(device)
    logger.info("Device deleted: %s", device_id)


# ── State ─────────────────────────────────────────────────────────────────────

async def get_device_state(
    db: AsyncSession, device_id: uuid.UUID
) -> Optional[DeviceStateResponse]:
    await _get_device_or_404(db, device_id)  # 404 if not found
    result = await db.execute(
        select(DeviceState)
        .where(DeviceState.device_id == device_id)
        .order_by(DeviceState.recorded_at.desc())
        .limit(1)
    )
    state = result.scalar_one_or_none()
    if state is None:
        return None
    return DeviceStateResponse.model_validate(state)


async def get_device_history(
    db: AsyncSession,
    device_id: uuid.UUID,
    from_dt: Optional[datetime] = None,
    to_dt: Optional[datetime] = None,
    limit: int = 100,
) -> List[DeviceStateResponse]:
    await _get_device_or_404(db, device_id)
    stmt = (
        select(DeviceState)
        .where(DeviceState.device_id == device_id)
        .order_by(DeviceState.recorded_at.desc())
    )
    # Partition pruning: explicit range filters allow PG to skip irrelevant partitions
    if from_dt is not None:
        stmt = stmt.where(DeviceState.recorded_at >= from_dt)
    if to_dt is not None:
        stmt = stmt.where(DeviceState.recorded_at <= to_dt)
    stmt = stmt.limit(max(1, min(limit, 1000)))
    result = await db.execute(stmt)
    states = result.scalars().all()
    return [DeviceStateResponse.model_validate(s) for s in states]


# ── MQTT command ──────────────────────────────────────────────────────────────

async def send_command(
    device: Device, command: str, topic_suffix: Optional[str], mqtt_client
) -> None:
    """Publish a command to the device's MQTT topic."""
    if not device.mqtt_topic:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Device has no MQTT topic configured.",
        )
    base_topic = device.mqtt_topic.rstrip("/")
    publish_topic = (
        f"{base_topic}/{topic_suffix.strip('/')}" if topic_suffix else base_topic
    )
    await mqtt_client.publish(publish_topic, payload=command, qos=0)
    logger.info("Command sent to %s on topic %s", device.id, publish_topic)


# ── Online status (called by MQTT bridge) ─────────────────────────────────────

async def update_online_status(
    db: AsyncSession,
    mqtt_topic: str,
    is_online: bool,
    last_seen: datetime,
) -> Optional[Device]:
    """Find a device by mqtt_topic and update its online status + last_seen."""
    result = await db.execute(
        select(Device).where(Device.mqtt_topic == mqtt_topic)
    )
    device = result.scalar_one_or_none()
    if device is None:
        return None
    device.is_online = is_online
    device.last_seen = last_seen
    await db.flush()
    return device
