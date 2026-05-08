from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest, UserResponse
from app.schemas.devices import (
    DeviceCreate,
    DeviceUpdate,
    DeviceResponse,
    DeviceStateResponse,
    DeviceCommandRequest,
)
from app.schemas.rooms import RoomCreate, RoomUpdate, RoomResponse
from app.schemas.security import SecurityEventResponse, SecurityStatsResponse
from app.schemas.automations import (
    AutomationCreate,
    AutomationUpdate,
    AutomationResponse,
    AutomationTrigger,
    AutomationCondition,
    AutomationAction,
)
from app.schemas.mqtt import MqttMessageResponse, MqttPublishRequest
from app.schemas.firmware import (
    FirmwareUpdateCreate,
    FirmwareUpdateResponse,
    FirmwareCandidateResponse,
)
from app.schemas.dashboard import DashboardSummary, NetworkMapDevice, NetworkMapResponse

__all__ = [
    "LoginRequest",
    "TokenResponse",
    "RefreshRequest",
    "UserResponse",
    "DeviceCreate",
    "DeviceUpdate",
    "DeviceResponse",
    "DeviceStateResponse",
    "DeviceCommandRequest",
    "RoomCreate",
    "RoomUpdate",
    "RoomResponse",
    "SecurityEventResponse",
    "SecurityStatsResponse",
    "AutomationCreate",
    "AutomationUpdate",
    "AutomationResponse",
    "AutomationTrigger",
    "AutomationCondition",
    "AutomationAction",
    "MqttMessageResponse",
    "MqttPublishRequest",
    "FirmwareUpdateCreate",
    "FirmwareUpdateResponse",
    "FirmwareCandidateResponse",
    "DashboardSummary",
    "NetworkMapDevice",
    "NetworkMapResponse",
]
