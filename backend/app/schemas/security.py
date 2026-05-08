from __future__ import annotations

import uuid
from datetime import datetime
from typing import Dict, Literal, Optional

from pydantic import BaseModel


SeverityType = Literal["low", "medium", "high", "critical"]


class SecurityEventResponse(BaseModel):
    id: uuid.UUID
    device_id: Optional[uuid.UUID]
    event_type: str
    description: str
    severity: str
    source_ip: Optional[str]
    destination_ip: Optional[str]
    blocked: bool
    resolved: bool
    resolved_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class SecurityStatsResponse(BaseModel):
    total_events: int
    unresolved_events: int
    by_severity: Dict[str, int]
    recent_critical: int
    recent_high: int
