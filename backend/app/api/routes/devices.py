from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.schemas.devices import (
    DeviceCommandRequest,
    DeviceCreate,
    DeviceResponse,
    DeviceStateResponse,
    DeviceUpdate,
)
from app.services import device_service
from app.services.auth_service import get_current_user
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/devices", tags=["Devices"])


@router.get("", response_model=List[DeviceResponse], status_code=status.HTTP_200_OK)
async def list_devices(
    room_id: Optional[uuid.UUID] = Query(default=None, description="Filter by room ID."),
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    return await device_service.get_all_devices(db, room_id=room_id)


@router.post("", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_device(
    body: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    return await device_service.create_device(db, body)


@router.get("/{device_id}", response_model=DeviceResponse, status_code=status.HTTP_200_OK)
async def get_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    return await device_service.get_device(db, device_id)


@router.put("/{device_id}", response_model=DeviceResponse, status_code=status.HTTP_200_OK)
async def update_device(
    device_id: uuid.UUID,
    body: DeviceUpdate,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    return await device_service.update_device(db, device_id, body)


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    await device_service.delete_device(db, device_id)
    return None


@router.get(
    "/{device_id}/state",
    response_model=Optional[DeviceStateResponse],
    status_code=status.HTTP_200_OK,
)
async def get_device_state(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    return await device_service.get_device_state(db, device_id)


@router.get(
    "/{device_id}/history",
    response_model=List[DeviceStateResponse],
    status_code=status.HTTP_200_OK,
)
async def get_device_history(
    device_id: uuid.UUID,
    from_dt: Optional[datetime] = Query(default=None, alias="from"),
    to_dt: Optional[datetime] = Query(default=None, alias="to"),
    limit: int = Query(default=100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    return await device_service.get_device_history(db, device_id, from_dt, to_dt, limit)


@router.post("/{device_id}/command", status_code=status.HTTP_202_ACCEPTED)
async def send_command(
    device_id: uuid.UUID,
    body: DeviceCommandRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    """Send a command to the device via MQTT."""
    from app.db.models import Device
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Device).options(selectinload(Device.room)).where(Device.id == device_id)
    )
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Device not found."
        )

    mqtt_client = getattr(request.app.state, "mqtt_client", None)
    if mqtt_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MQTT broker not connected.",
        )

    await device_service.send_command(device, body.command, body.topic_suffix, mqtt_client)
    return {"status": "queued", "topic": device.mqtt_topic}
