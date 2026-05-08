from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


FirmwareUpdateStatus = Literal["pending", "in_progress", "completed", "failed"]


class FirmwareUpdateCreate(BaseModel):
    from_firmware: str = Field(..., max_length=64)
    to_firmware: str = Field(..., max_length=64)
    from_version: str = Field(..., max_length=64)
    to_version: str = Field(..., max_length=64)
    status: FirmwareUpdateStatus = "pending"
    notes: Optional[str] = None


class FirmwareUpdateResponse(BaseModel):
    id: uuid.UUID
    device_id: uuid.UUID
    from_firmware: str
    to_firmware: str
    from_version: str
    to_version: str
    status: str
    notes: Optional[str]
    updated_at: datetime

    model_config = {"from_attributes": True}


class FirmwareCandidateResponse(BaseModel):
    """Device that is a candidate for firmware replacement."""

    device_id: uuid.UUID
    device_name: str
    current_firmware_type: str
    current_firmware_version: Optional[str]
    ip_address: Optional[str]
    mac_address: Optional[str]
    chip_type: str
    protocol: str
    reason: str = Field(
        ..., description="Why this device is flagged as a candidate (original/unknown firmware)."
    )
