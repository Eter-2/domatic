from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field


ProtocolType = Literal["wifi", "zigbee", "zwave", "ble", "matter", "ir", "unknown"]
ChipType = Literal["esp8266", "esp32", "bk7231", "ln882h", "unknown"]
FirmwareType = Literal["tasmota", "esphome", "openbk", "original", "unknown"]


class DeviceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    room_id: Optional[uuid.UUID] = None
    protocol: ProtocolType = "unknown"
    chip_type: ChipType = "unknown"
    ip_address: Optional[str] = Field(default=None, max_length=45)
    mac_address: Optional[str] = Field(default=None, max_length=17)
    firmware_type: FirmwareType = "unknown"
    firmware_version: Optional[str] = Field(default=None, max_length=64)
    is_cloud_dependent: bool = False
    mqtt_topic: Optional[str] = Field(default=None, max_length=255)
    metadata: Optional[Dict[str, Any]] = None


class DeviceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    room_id: Optional[uuid.UUID] = None
    protocol: Optional[ProtocolType] = None
    chip_type: Optional[ChipType] = None
    ip_address: Optional[str] = Field(default=None, max_length=45)
    mac_address: Optional[str] = Field(default=None, max_length=17)
    firmware_type: Optional[FirmwareType] = None
    firmware_version: Optional[str] = Field(default=None, max_length=64)
    is_cloud_dependent: Optional[bool] = None
    mqtt_topic: Optional[str] = Field(default=None, max_length=255)
    metadata: Optional[Dict[str, Any]] = None


class DeviceResponse(BaseModel):
    id: uuid.UUID
    name: str
    room_id: Optional[uuid.UUID]
    room_name: Optional[str] = None
    protocol: str
    chip_type: str
    ip_address: Optional[str]
    mac_address: Optional[str]
    firmware_type: str
    firmware_version: Optional[str]
    last_seen: Optional[datetime]
    is_online: bool
    is_cloud_dependent: bool
    mqtt_topic: Optional[str]
    metadata: Optional[Dict[str, Any]] = Field(None, alias="metadata_")
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class DeviceStateResponse(BaseModel):
    id: uuid.UUID
    device_id: uuid.UUID
    state: Dict[str, Any]
    recorded_at: datetime

    model_config = {"from_attributes": True}


class DeviceCommandRequest(BaseModel):
    command: str = Field(..., min_length=1, description="MQTT payload to publish.")
    topic_suffix: Optional[str] = Field(
        default="cmnd",
        description="Appended to device mqtt_topic, e.g. 'cmnd/POWER'.",
    )
