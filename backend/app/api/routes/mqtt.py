from __future__ import annotations

import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import MqttMessage
from app.schemas.auth import UserResponse
from app.schemas.mqtt import MqttMessageResponse, MqttPublishRequest
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/mqtt", tags=["MQTT"])

# A03/A04: MQTT topic validation — deny null bytes, ".." traversal segments,
# and MQTT wildcards (#, +) which should never appear in publish topics.
_INVALID_TOPIC_RE = re.compile(r"\.\.|\x00|[#+]")
_MAX_TOPIC_LEN = 200  # MQTT spec allows 65535 bytes, we keep it sane


def _validate_publish_topic(topic: str) -> None:
    """Raise 422 if the topic is structurally unsafe for publishing."""
    if not topic or not topic.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="MQTT topic must not be empty.",
        )
    if len(topic) > _MAX_TOPIC_LEN:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"MQTT topic must not exceed {_MAX_TOPIC_LEN} characters.",
        )
    if _INVALID_TOPIC_RE.search(topic):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="MQTT topic contains invalid characters ('..' traversal, wildcards, or null bytes).",
        )


@router.get(
    "/messages",
    response_model=List[MqttMessageResponse],
    status_code=status.HTTP_200_OK,
)
async def list_messages(
    topic: Optional[str] = Query(
        default=None, description="Filter by topic prefix (case-insensitive LIKE)."
    ),
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    stmt = select(MqttMessage).order_by(MqttMessage.received_at.desc())
    if topic:
        stmt = stmt.where(MqttMessage.topic.ilike(f"{topic}%"))
    stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    messages = result.scalars().all()
    return [MqttMessageResponse.model_validate(m) for m in messages]


@router.post("/publish", status_code=status.HTTP_202_ACCEPTED)
async def publish_message(
    body: MqttPublishRequest,
    request: Request,
    _: UserResponse = Depends(get_current_user),
):
    """Publish an MQTT message via the broker connection."""
    # A03/A04: Validate topic before forwarding to the broker.
    _validate_publish_topic(body.topic)

    mqtt_client = getattr(request.app.state, "mqtt_client", None)
    if mqtt_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MQTT broker not connected.",
        )
    await mqtt_client.publish(
        body.topic,
        payload=body.payload,
        qos=body.qos,
        retain=body.retain,
    )
    return {"status": "published", "topic": body.topic}
