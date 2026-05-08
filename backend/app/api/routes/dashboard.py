from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.base import get_db
from app.db.models import Automation, Device, DeviceState, MqttMessage, Room, SecurityEvent
from app.schemas.auth import UserResponse
from app.schemas.dashboard import (
    DashboardSummary,
    NetworkMapDevice,
    NetworkMapResponse,
    NetworkMapRoom,
)
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/summary",
    response_model=DashboardSummary,
    status_code=status.HTTP_200_OK,
)
async def get_summary(
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    # Total / online / offline devices
    total_result = await db.execute(select(func.count(Device.id)))
    total: int = total_result.scalar_one()

    online_result = await db.execute(
        select(func.count(Device.id)).where(Device.is_online == True)  # noqa: E712
    )
    online: int = online_result.scalar_one()

    # Unresolved security alerts
    alerts_result = await db.execute(
        select(func.count(SecurityEvent.id)).where(SecurityEvent.resolved == False)  # noqa: E712
    )
    alerts: int = alerts_result.scalar_one()

    # Automation counts
    auto_total_result = await db.execute(select(func.count(Automation.id)))
    auto_total: int = auto_total_result.scalar_one()

    auto_enabled_result = await db.execute(
        select(func.count(Automation.id)).where(Automation.enabled == True)  # noqa: E712
    )
    auto_enabled: int = auto_enabled_result.scalar_one()

    # Last MQTT message
    last_msg_result = await db.execute(
        select(MqttMessage.received_at, MqttMessage.topic)
        .order_by(MqttMessage.received_at.desc())
        .limit(1)
    )
    last_msg = last_msg_result.first()

    return DashboardSummary(
        total_devices=total,
        online_devices=online,
        offline_devices=total - online,
        security_alerts_unresolved=alerts,
        automations_total=auto_total,
        automations_enabled=auto_enabled,
        last_mqtt_message_at=last_msg[0] if last_msg else None,
        last_mqtt_topic=last_msg[1] if last_msg else None,
    )


@router.get(
    "/network-map",
    response_model=NetworkMapResponse,
    status_code=status.HTTP_200_OK,
)
async def get_network_map(
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    # Fetch all devices with their rooms in one query
    devices_result = await db.execute(
        select(Device).options(selectinload(Device.room)).order_by(Device.name)
    )
    devices: List[Device] = list(devices_result.scalars().all())

    # Bulk fetch latest state per device using a subquery approach
    # (one extra query vs N queries — acceptable for typical hub scale)
    device_ids = [d.id for d in devices]
    latest_states: Dict[uuid.UUID, Dict[str, Any]] = {}

    if device_ids:
        # For each device, get the most recent recorded_at
        from sqlalchemy import and_

        subq = (
            select(DeviceState.device_id, func.max(DeviceState.recorded_at).label("max_ts"))
            .where(DeviceState.device_id.in_(device_ids))
            .group_by(DeviceState.device_id)
            .subquery()
        )
        states_result = await db.execute(
            select(DeviceState).join(
                subq,
                and_(
                    DeviceState.device_id == subq.c.device_id,
                    DeviceState.recorded_at == subq.c.max_ts,
                ),
            )
        )
        for ds in states_result.scalars().all():
            latest_states[ds.device_id] = ds.state

    def _to_map_device(d: Device) -> NetworkMapDevice:
        return NetworkMapDevice(
            id=d.id,
            name=d.name,
            protocol=d.protocol,
            chip_type=d.chip_type,
            firmware_type=d.firmware_type,
            is_online=d.is_online,
            is_cloud_dependent=d.is_cloud_dependent,
            ip_address=d.ip_address,
            mac_address=d.mac_address,
            mqtt_topic=d.mqtt_topic,
            last_seen=d.last_seen,
            current_state=latest_states.get(d.id),
        )

    # Group by room
    rooms_map: Dict[Optional[uuid.UUID], List[Device]] = {}
    for d in devices:
        rooms_map.setdefault(d.room_id, []).append(d)

    # Fetch rooms info for room_ids present
    room_ids = [rid for rid in rooms_map if rid is not None]
    rooms_info: Dict[uuid.UUID, Room] = {}
    if room_ids:
        room_result = await db.execute(
            select(Room).where(Room.id.in_(room_ids))
        )
        for r in room_result.scalars().all():
            rooms_info[r.id] = r

    network_rooms: List[NetworkMapRoom] = []
    unassigned: List[NetworkMapDevice] = [
        _to_map_device(d) for d in rooms_map.get(None, [])
    ]

    for room_id, room_devices in rooms_map.items():
        if room_id is None:
            continue
        room = rooms_info.get(room_id)
        network_rooms.append(
            NetworkMapRoom(
                room_id=room_id,
                room_name=room.name if room else str(room_id),
                floor=room.floor if room else None,
                devices=[_to_map_device(d) for d in room_devices],
            )
        )

    # Sort rooms by floor then name
    network_rooms.sort(key=lambda r: (r.floor or 0, r.room_name or ""))

    return NetworkMapResponse(
        rooms=network_rooms,
        unassigned_devices=unassigned,
        total_devices=len(devices),
        online_count=sum(1 for d in devices if d.is_online),
    )
