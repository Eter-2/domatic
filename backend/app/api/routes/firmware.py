from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.schemas.auth import UserResponse
from app.schemas.firmware import (
    FirmwareCandidateResponse,
    FirmwareUpdateCreate,
    FirmwareUpdateResponse,
)
from app.services import firmware_service
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/firmware", tags=["Firmware"])


@router.get(
    "/candidates",
    response_model=List[FirmwareCandidateResponse],
    status_code=status.HTTP_200_OK,
)
async def get_candidates(
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    """Return all devices running original or unknown firmware."""
    return await firmware_service.get_candidates(db)


@router.post(
    "/{device_id}/log-update",
    response_model=FirmwareUpdateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def log_update(
    device_id: uuid.UUID,
    body: FirmwareUpdateCreate,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    """Log a firmware update event for a device."""
    return await firmware_service.log_update(db, device_id, body)


@router.get(
    "/{device_id}/history",
    response_model=List[FirmwareUpdateResponse],
    status_code=status.HTTP_200_OK,
)
async def get_history(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    """Return firmware update history for a device."""
    return await firmware_service.get_history(db, device_id)
