from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class RoomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    icon: str = Field(default="home", max_length=64)
    floor: int = Field(default=0, ge=0)


class RoomUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    icon: Optional[str] = Field(default=None, max_length=64)
    floor: Optional[int] = Field(default=None, ge=0)


class RoomResponse(BaseModel):
    id: uuid.UUID
    name: str
    icon: str
    floor: int
    device_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}
