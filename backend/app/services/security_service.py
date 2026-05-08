from __future__ import annotations

import base64
import json
import logging
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Device, MqttMessage, SecurityEvent
from app.schemas.security import SecurityEventResponse, SecurityStatsResponse

logger = logging.getLogger(__name__)


# ── Internal data class for anomaly signals ───────────────────────────────────

@dataclass
class SecurityEventData:
    event_type: str
    description: str
    severity: str
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    blocked: bool = False


# ── CRUD helpers ──────────────────────────────────────────────────────────────

async def log_event(
    db: AsyncSession,
    event_type: str,
    description: str,
    severity: str,
    device_id: Optional[uuid.UUID] = None,
    source_ip: Optional[str] = None,
    dest_ip: Optional[str] = None,
    blocked: bool = False,
) -> SecurityEvent:
    event = SecurityEvent(
        device_id=device_id,
        event_type=event_type,
        description=description,
        severity=severity,
        source_ip=source_ip,
        destination_ip=dest_ip,
        blocked=blocked,
    )
    db.add(event)
    await db.flush()
    log_fn = logger.warning if severity in ("high", "critical") else logger.info
    log_fn(
        "Security event [%s/%s]: %s (device=%s)",
        severity,
        event_type,
        description,
        device_id,
    )
    return event


async def get_events(
    db: AsyncSession,
    resolved: Optional[bool] = None,
    severity: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[SecurityEventResponse]:
    stmt = select(SecurityEvent).order_by(SecurityEvent.created_at.desc())
    if resolved is not None:
        stmt = stmt.where(SecurityEvent.resolved == resolved)
    if severity is not None:
        stmt = stmt.where(SecurityEvent.severity == severity)
    stmt = stmt.limit(max(1, min(limit, 500))).offset(offset)
    result = await db.execute(stmt)
    events = result.scalars().all()
    return [SecurityEventResponse.model_validate(e) for e in events]


async def resolve_event(db: AsyncSession, event_id: uuid.UUID) -> SecurityEventResponse:
    from fastapi import HTTPException, status

    result = await db.execute(
        select(SecurityEvent).where(SecurityEvent.id == event_id)
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    event.resolved = True
    event.resolved_at = datetime.now(timezone.utc)
    await db.flush()
    return SecurityEventResponse.model_validate(event)


async def get_stats(db: AsyncSession) -> SecurityStatsResponse:
    # Total events
    total_result = await db.execute(select(func.count(SecurityEvent.id)))
    total: int = total_result.scalar_one()

    # Unresolved
    unresolved_result = await db.execute(
        select(func.count(SecurityEvent.id)).where(SecurityEvent.resolved == False)  # noqa: E712
    )
    unresolved: int = unresolved_result.scalar_one()

    # Count by severity
    by_severity: Dict[str, int] = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    sev_result = await db.execute(
        select(SecurityEvent.severity, func.count(SecurityEvent.id)).group_by(
            SecurityEvent.severity
        )
    )
    for sev, count in sev_result.all():
        by_severity[sev] = count

    # Recent critical/high (last 24h)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    recent_critical_result = await db.execute(
        select(func.count(SecurityEvent.id)).where(
            SecurityEvent.severity == "critical",
            SecurityEvent.created_at >= cutoff,
        )
    )
    recent_critical: int = recent_critical_result.scalar_one()

    recent_high_result = await db.execute(
        select(func.count(SecurityEvent.id)).where(
            SecurityEvent.severity == "high",
            SecurityEvent.created_at >= cutoff,
        )
    )
    recent_high: int = recent_high_result.scalar_one()

    return SecurityStatsResponse(
        total_events=total,
        unresolved_events=unresolved,
        by_severity=by_severity,
        recent_critical=recent_critical,
        recent_high=recent_high,
    )


# ── Payload inspection ────────────────────────────────────────────────────────

_BASE64_PATTERN = re.compile(r"^[A-Za-z0-9+/]{20,}={0,2}$")
_KNOWN_TOPIC_PREFIXES = (
    "tele/", "stat/", "cmnd/", "homeassistant/", "zigbee2mqtt/", "tasmota/",
)


def _looks_like_base64(value: str) -> bool:
    """Heuristic: long base64-looking string that decodes cleanly."""
    if not _BASE64_PATTERN.match(value):
        return False
    try:
        decoded = base64.b64decode(value + "==")
        # If decoding yields mostly printable chars that are suspiciously long → flag
        return len(decoded) > 12
    except Exception:
        return False


def inspect_mqtt_payload(
    topic: str, payload: str
) -> Optional[SecurityEventData]:
    """
    Heuristic security inspection of an MQTT message.
    Returns a SecurityEventData if an anomaly is detected, else None.
    """
    anomalies: List[str] = []
    severity = "low"

    # 1. Check for base64-looking blobs in payload
    try:
        data: Any = json.loads(payload)
        if isinstance(data, dict):
            for key, val in data.items():
                if isinstance(val, str) and _looks_like_base64(val):
                    anomalies.append(f"Possible encoded/obfuscated data in field '{key}'")
                    severity = "medium"
        elif isinstance(data, str) and _looks_like_base64(data):
            anomalies.append("Payload is a base64-encoded blob")
            severity = "medium"
    except (json.JSONDecodeError, ValueError):
        if _looks_like_base64(payload.strip()):
            anomalies.append("Raw payload looks base64-encoded")
            severity = "medium"

    # 2. Topic doesn't match known safe prefixes
    if not any(topic.startswith(prefix) for prefix in _KNOWN_TOPIC_PREFIXES):
        anomalies.append(f"Topic '{topic}' doesn't match known device patterns")

    # 3. Look for cloud domain references embedded in payload
    for domain in settings.security_cloud_domains:
        if domain in payload:
            anomalies.append(f"Cloud domain reference found: {domain}")
            severity = "high"
            break

    if not anomalies:
        return None

    return SecurityEventData(
        event_type="mqtt_anomaly",
        description="; ".join(anomalies),
        severity=severity,
    )


# ── Pi-hole integration ───────────────────────────────────────────────────────

async def poll_pihole(db: AsyncSession) -> None:
    """
    Poll Pi-hole API for recent DNS queries from IoT devices.
    Flag queries to known cloud domains as security events.
    """
    if not settings.PIHOLE_ENABLED:
        return

    url = f"{settings.PIHOLE_URL.rstrip('/')}/admin/api.php"
    params = {
        "getAllQueries": "",
        "auth": settings.PIHOLE_API_TOKEN,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("Pi-hole poll failed: %s", exc)
        return

    queries = data.get("data", [])
    # Pi-hole query format: [timestamp, type, domain, client_ip, status, ...]
    cloud_domains = settings.security_cloud_domains
    device_ids_cache: Dict[str, Optional[uuid.UUID]] = {}

    for q in queries:
        if not isinstance(q, (list, tuple)) or len(q) < 5:
            continue
        _ts, _qtype, domain, client_ip, _status = q[0], q[1], q[2], q[3], q[4]

        if not any(cloud in domain for cloud in cloud_domains):
            continue

        # Try to resolve device from IP
        if client_ip not in device_ids_cache:
            result = await db.execute(
                select(Device.id).where(Device.ip_address == client_ip)
            )
            row = result.first()
            device_ids_cache[client_ip] = row[0] if row else None

        device_id = device_ids_cache.get(client_ip)

        await log_event(
            db=db,
            event_type="cloud_dns_query",
            description=(
                f"IoT device ({client_ip}) queried cloud domain '{domain}'. "
                "This suggests cloud-dependency or potential data exfiltration."
            ),
            severity="high",
            device_id=device_id,
            source_ip=client_ip,
            destination_ip=domain,
            blocked=str(_status) in ("1", "4", "5", "6"),  # Pi-hole blocked statuses
        )

    logger.info("Pi-hole poll complete: %d queries checked.", len(queries))
