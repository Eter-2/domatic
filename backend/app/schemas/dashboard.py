from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_devices: int
    online_devices: int
    offline_devices: int
    security_alerts_unresolved: int
    automations_total: int
    automations_enabled: int
    last_mqtt_message_at: Optional[datetime]
    last_mqtt_topic: Optional[str]


class NetworkMapDevice(BaseModel):
    id: uuid.UUID
    name: str
    protocol: str
    chip_type: str
    firmware_type: str
    is_online: bool
    is_cloud_dependent: bool
    ip_address: Optional[str]
    mac_address: Optional[str]
    mqtt_topic: Optional[str]
    last_seen: Optional[datetime]
    current_state: Optional[Dict[str, Any]] = None


class NetworkMapRoom(BaseModel):
    room_id: Optional[uuid.UUID]
    room_name: Optional[str]
    floor: Optional[int]
    devices: List[NetworkMapDevice]


class NetworkMapResponse(BaseModel):
    rooms: List[NetworkMapRoom]
    unassigned_devices: List[NetworkMapDevice]
    total_devices: int
    online_count: int
