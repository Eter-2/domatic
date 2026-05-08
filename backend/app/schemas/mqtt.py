from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class MqttMessageResponse(BaseModel):
    id: uuid.UUID
    topic: str
    payload: str
    qos: int
    retained: bool
    received_at: datetime

    model_config = {"from_attributes": True}


class MqttPublishRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=512)
    payload: str = Field(..., description="Message payload (string or JSON-encoded string).")
    qos: int = Field(default=0, ge=0, le=2)
    retain: bool = False
