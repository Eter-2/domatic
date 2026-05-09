from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class RoomSummary(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    device_count: int = 0
    online_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SecurityEventSummary(BaseModel):
    id: uuid.UUID
    device_id: Optional[uuid.UUID] = None
    event_type: str
    severity: str
    description: str
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None
    resolved: bool
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MqttMessageSummary(BaseModel):
    id: uuid.UUID
    topic: str
    payload: str
    qos: int
    retained: bool
    timestamp: datetime

    model_config = {"from_attributes": True}


class AutomationActivity(BaseModel):
    automation_id: uuid.UUID
    automation_name: str
    triggered_at: datetime
    success: bool
    result: Optional[str] = None


class DashboardSummary(BaseModel):
    total_devices: int
    online_devices: int
    offline_devices: int
    active_automations: int
    unresolved_security_events: int
    rooms: List[RoomSummary]
    recent_security_events: List[SecurityEventSummary]
    recent_mqtt_messages: List[MqttMessageSummary]
    recent_automation_activity: List[AutomationActivity]


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
