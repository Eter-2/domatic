from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# ── Enum type strings ─────────────────────────────────────────────────────────

PROTOCOL_ENUM = SAEnum(
    "wifi", "zigbee", "zwave", "ble", "matter", "ir", "unknown",
    name="device_protocol",
)
CHIP_ENUM = SAEnum(
    "esp8266", "esp32", "bk7231", "ln882h", "unknown",
    name="device_chip_type",
)
FIRMWARE_TYPE_ENUM = SAEnum(
    "tasmota", "esphome", "openbk", "original", "unknown",
    name="firmware_type",
)
SEVERITY_ENUM = SAEnum(
    "low", "medium", "high", "critical",
    name="event_severity",
)
FIRMWARE_STATUS_ENUM = SAEnum(
    "pending", "in_progress", "completed", "failed",
    name="firmware_update_status",
)


# ── Models ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(128), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    icon: Mapped[str] = mapped_column(String(64), default="home", nullable=False)
    floor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    devices: Mapped[list["Device"]] = relationship("Device", back_populates="room")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    room_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True, index=True
    )
    protocol: Mapped[str] = mapped_column(PROTOCOL_ENUM, nullable=False, default="unknown")
    chip_type: Mapped[str] = mapped_column(CHIP_ENUM, nullable=False, default="unknown")
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    mac_address: Mapped[Optional[str]] = mapped_column(
        String(17), nullable=True, index=True
    )
    firmware_type: Mapped[str] = mapped_column(FIRMWARE_TYPE_ENUM, nullable=False, default="unknown")
    firmware_version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    last_seen: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_cloud_dependent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mqtt_topic: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    metadata_: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        "metadata", JSON, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("mac_address", name="uq_device_mac_address"),
    )

    room: Mapped[Optional["Room"]] = relationship("Room", back_populates="devices")
    states: Mapped[list["DeviceState"]] = relationship(
        "DeviceState", back_populates="device", cascade="all, delete-orphan"
    )
    security_events: Mapped[list["SecurityEvent"]] = relationship(
        "SecurityEvent", back_populates="device"
    )
    firmware_updates: Mapped[list["FirmwareUpdate"]] = relationship(
        "FirmwareUpdate", back_populates="device", cascade="all, delete-orphan"
    )


class DeviceState(Base):
    """Time-series state snapshots.

    In production, this table should be partitioned by month using pg_partman or
    a manual DDL migration. The ORM model reflects the logical structure; the
    actual partitioned DDL is managed via Alembic raw SQL migrations.
    """

    __tablename__ = "device_states"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    state: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    __table_args__ = (
        # Partitioning note: PARTITION BY RANGE (recorded_at) — managed via DDL migration.
        # Partitions named device_states_YYYY_MM are created monthly by pg_partman or a cron job.
        {},
    )

    device: Mapped["Device"] = relationship("Device", back_populates="states")


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    device_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("devices.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(SEVERITY_ENUM, nullable=False, index=True)
    source_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    destination_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    device: Mapped[Optional["Device"]] = relationship(
        "Device", back_populates="security_events"
    )


class Automation(Base):
    __tablename__ = "automations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    trigger: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    conditions: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=list)
    actions: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    last_triggered: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    execution_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class MqttMessage(Base):
    """Capped ring-buffer of recent MQTT messages (max MQTT_MESSAGE_MAX_ROWS rows)."""

    __tablename__ = "mqtt_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    topic: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    qos: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    retained: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


class FirmwareUpdate(Base):
    __tablename__ = "firmware_updates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_firmware: Mapped[str] = mapped_column(String(64), nullable=False)
    to_firmware: Mapped[str] = mapped_column(String(64), nullable=False)
    from_version: Mapped[str] = mapped_column(String(64), nullable=False)
    to_version: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        FIRMWARE_STATUS_ENUM, nullable=False, default="pending"
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    device: Mapped["Device"] = relationship("Device", back_populates="firmware_updates")


# ── BIM / IFC Models ──────────────────────────────────────────────────────────

BIM_ESTADO_ENUM = SAEnum("uploading", "processing", "ready", "error", name="bim_model_estado")


class BimModel(Base):
    __tablename__ = "bim_models"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    versao: Mapped[str] = mapped_column(String(50), nullable=False, default="v1")
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    tamanho_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    estado: Mapped[str] = mapped_column(BIM_ESTADO_ENUM, nullable=False, default="ready")
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
