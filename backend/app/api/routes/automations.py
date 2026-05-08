from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.schemas.auth import UserResponse
from app.schemas.automations import (
    AutomationCreate,
    AutomationResponse,
    AutomationUpdate,
)
from app.services import automation_service
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/automations", tags=["Automations"])


@router.get("", response_model=List[AutomationResponse], status_code=status.HTTP_200_OK)
async def list_automations(
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    return await automation_service.get_automations(db)


@router.post("", response_model=AutomationResponse, status_code=status.HTTP_201_CREATED)
async def create_automation(
    body: AutomationCreate,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    return await automation_service.create_automation(db, body)


@router.get(
    "/{automation_id}", response_model=AutomationResponse, status_code=status.HTTP_200_OK
)
async def get_automation(
    automation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    automation = await automation_service.get_automation(db, automation_id)
    return AutomationResponse.model_validate(automation)


@router.put(
    "/{automation_id}", response_model=AutomationResponse, status_code=status.HTTP_200_OK
)
async def update_automation(
    automation_id: uuid.UUID,
    body: AutomationUpdate,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    return await automation_service.update_automation(db, automation_id, body)


@router.delete("/{automation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_automation(
    automation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    await automation_service.delete_automation(db, automation_id)
    return None


@router.post(
    "/{automation_id}/toggle",
    response_model=AutomationResponse,
    status_code=status.HTTP_200_OK,
)
async def toggle_automation(
    automation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    return await automation_service.toggle_automation(db, automation_id)


@router.post(
    "/{automation_id}/test",
    status_code=status.HTTP_202_ACCEPTED,
)
async def test_automation(
    automation_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    """
    Dry-run an automation by evaluating it with a synthetic MQTT message.
    Actions are executed for real (use for testing only).
    """
    automation = await automation_service.get_automation(db, automation_id)
    if not automation.enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Automation is disabled. Enable it before testing.",
        )

    mqtt_client = getattr(request.app.state, "mqtt_client", None)
    if mqtt_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MQTT broker not connected.",
        )

    # Synthesize a trigger topic/payload from the automation's trigger definition
    trigger = automation.trigger or {}
    test_topic = trigger.get("topic", "test/automation/trigger")
    test_payload = "{}"

    await automation_service.evaluate(
        db, device_id=None, topic=test_topic, payload=test_payload, mqtt_client=mqtt_client
    )
    return {"status": "executed", "automation_id": str(automation_id)}
