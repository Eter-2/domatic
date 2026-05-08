from __future__ import annotations

import logging
import uuid
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Device, FirmwareUpdate
from app.schemas.firmware import (
    FirmwareCandidateResponse,
    FirmwareUpdateCreate,
    FirmwareUpdateResponse,
)

logger = logging.getLogger(__name__)

# Firmware types that are candidates for replacement
CANDIDATE_FIRMWARE_TYPES = ("original", "unknown")


async def get_candidates(db: AsyncSession) -> List[FirmwareCandidateResponse]:
    """Return devices running original or unknown firmware — prime candidates for reflashing."""
    result = await db.execute(
        select(Device).where(Device.firmware_type.in_(CANDIDATE_FIRMWARE_TYPES))
    )
    devices = result.scalars().all()

    candidates = []
    for d in devices:
        reason = (
            "Running manufacturer firmware (cloud-dependent, may phone home)"
            if d.firmware_type == "original"
            else "Unknown firmware type — cannot verify security posture"
        )
        candidates.append(
            FirmwareCandidateResponse(
                device_id=d.id,
                device_name=d.name,
                current_firmware_type=d.firmware_type,
                current_firmware_version=d.firmware_version,
                ip_address=d.ip_address,
                mac_address=d.mac_address,
                chip_type=d.chip_type,
                protocol=d.protocol,
                reason=reason,
            )
        )
    return candidates


async def log_update(
    db: AsyncSession, device_id: uuid.UUID, data: FirmwareUpdateCreate
) -> FirmwareUpdateResponse:
    from fastapi import HTTPException, status

    # Verify device exists
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Device not found."
        )

    update = FirmwareUpdate(
        device_id=device_id,
        from_firmware=data.from_firmware,
        to_firmware=data.to_firmware,
        from_version=data.from_version,
        to_version=data.to_version,
        status=data.status,
        notes=data.notes,
    )
    db.add(update)
    await db.flush()

    # Update the device's firmware info if upgrade completed
    if data.status == "completed":
        device.firmware_type = data.to_firmware  # type: ignore[assignment]
        device.firmware_version = data.to_version
        await db.flush()

    logger.info(
        "Firmware update logged for device %s: %s→%s (%s→%s)",
        device_id,
        data.from_firmware,
        data.to_firmware,
        data.from_version,
        data.to_version,
    )
    return FirmwareUpdateResponse.model_validate(update)


async def get_history(
    db: AsyncSession, device_id: uuid.UUID
) -> List[FirmwareUpdateResponse]:
    from fastapi import HTTPException, status

    result = await db.execute(select(Device.id).where(Device.id == device_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Device not found."
        )

    history_result = await db.execute(
        select(FirmwareUpdate)
        .where(FirmwareUpdate.device_id == device_id)
        .order_by(FirmwareUpdate.updated_at.desc())
    )
    updates = history_result.scalars().all()
    return [FirmwareUpdateResponse.model_validate(u) for u in updates]
