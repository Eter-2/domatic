from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# ── Sub-schemas ───────────────────────────────────────────────────────────────

class AutomationTrigger(BaseModel):
    """Trigger definition for an automation rule."""

    type: Literal["mqtt_topic", "device_state", "schedule", "security_event"] = Field(
        ..., description="Trigger type."
    )
    # mqtt_topic trigger
    topic: Optional[str] = Field(
        default=None, description="MQTT topic pattern (supports + and # wildcards)."
    )
    payload_match: Optional[Dict[str, Any]] = Field(
        default=None, description="Expected payload key/value pairs."
    )
    # device_state trigger
    device_id: Optional[uuid.UUID] = None
    state_key: Optional[str] = None
    state_value: Optional[Any] = None
    # schedule trigger (cron expression)
    cron: Optional[str] = Field(
        default=None, description="Cron expression, e.g. '0 * * * *'."
    )
    # security_event trigger
    event_type: Optional[str] = None
    severity: Optional[str] = None


class AutomationCondition(BaseModel):
    """Optional condition that must be true before actions fire."""

    type: Literal["device_state", "time_range", "day_of_week"]
    device_id: Optional[uuid.UUID] = None
    state_key: Optional[str] = None
    operator: Optional[Literal["eq", "ne", "gt", "lt", "gte", "lte"]] = None
    value: Optional[Any] = None
    # time_range condition
    start_time: Optional[str] = Field(default=None, description="HH:MM in 24h format.")
    end_time: Optional[str] = Field(default=None, description="HH:MM in 24h format.")
    # day_of_week condition (0=Mon, 6=Sun)
    days: Optional[List[int]] = None


class AutomationAction(BaseModel):
    """Action to execute when trigger fires and conditions pass."""

    type: Literal["mqtt_publish", "ha_service_call", "http_request", "log"]
    # mqtt_publish
    topic: Optional[str] = None
    payload: Optional[str] = None
    qos: Optional[int] = Field(default=0, ge=0, le=2)
    # ha_service_call
    service: Optional[str] = Field(
        default=None, description="Home Assistant service, e.g. 'light.turn_on'."
    )
    entity_id: Optional[str] = None
    service_data: Optional[Dict[str, Any]] = None
    # http_request
    url: Optional[str] = None
    method: Optional[Literal["GET", "POST", "PUT", "PATCH", "DELETE"]] = "GET"
    body: Optional[Dict[str, Any]] = None
    headers: Optional[Dict[str, str]] = None
    # log
    message: Optional[str] = None


# ── Request / response ────────────────────────────────────────────────────────

class AutomationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    enabled: bool = True
    trigger: AutomationTrigger
    conditions: List[AutomationCondition] = []
    actions: List[AutomationAction] = Field(..., min_length=1)


class AutomationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    enabled: Optional[bool] = None
    trigger: Optional[AutomationTrigger] = None
    conditions: Optional[List[AutomationCondition]] = None
    actions: Optional[List[AutomationAction]] = None


class AutomationResponse(BaseModel):
    id: uuid.UUID
    name: str
    enabled: bool
    trigger: Dict[str, Any]
    conditions: List[Dict[str, Any]]
    actions: List[Dict[str, Any]]
    last_triggered: Optional[datetime]
    execution_count: int
    created_at: datetime

    model_config = {"from_attributes": True}
