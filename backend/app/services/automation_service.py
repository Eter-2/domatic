from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Automation
from app.schemas.automations import AutomationCreate, AutomationResponse, AutomationUpdate

logger = logging.getLogger(__name__)


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def get_automations(db: AsyncSession) -> List[AutomationResponse]:
    result = await db.execute(select(Automation).order_by(Automation.name))
    automations = result.scalars().all()
    return [AutomationResponse.model_validate(a) for a in automations]


async def get_automation(db: AsyncSession, automation_id: uuid.UUID) -> Automation:
    from fastapi import HTTPException, status

    result = await db.execute(
        select(Automation).where(Automation.id == automation_id)
    )
    automation = result.scalar_one_or_none()
    if automation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Automation not found."
        )
    return automation


async def create_automation(
    db: AsyncSession, data: AutomationCreate
) -> AutomationResponse:
    automation = Automation(
        name=data.name,
        enabled=data.enabled,
        trigger=data.trigger.model_dump(mode="json"),
        conditions=[c.model_dump(mode="json") for c in data.conditions],
        actions=[a.model_dump(mode="json") for a in data.actions],
    )
    db.add(automation)
    await db.flush()
    logger.info("Automation created: %s (%s)", automation.name, automation.id)
    return AutomationResponse.model_validate(automation)


async def update_automation(
    db: AsyncSession, automation_id: uuid.UUID, data: AutomationUpdate
) -> AutomationResponse:
    automation = await get_automation(db, automation_id)
    if data.name is not None:
        automation.name = data.name
    if data.enabled is not None:
        automation.enabled = data.enabled
    if data.trigger is not None:
        automation.trigger = data.trigger.model_dump(mode="json")
    if data.conditions is not None:
        automation.conditions = [c.model_dump(mode="json") for c in data.conditions]
    if data.actions is not None:
        automation.actions = [a.model_dump(mode="json") for a in data.actions]
    await db.flush()
    return AutomationResponse.model_validate(automation)


async def delete_automation(db: AsyncSession, automation_id: uuid.UUID) -> None:
    automation = await get_automation(db, automation_id)
    await db.delete(automation)
    logger.info("Automation deleted: %s", automation_id)


async def toggle_automation(
    db: AsyncSession, automation_id: uuid.UUID
) -> AutomationResponse:
    automation = await get_automation(db, automation_id)
    automation.enabled = not automation.enabled
    await db.flush()
    logger.info("Automation %s toggled to enabled=%s", automation_id, automation.enabled)
    return AutomationResponse.model_validate(automation)


# ── Evaluation engine ─────────────────────────────────────────────────────────

def _topic_matches(pattern: str, topic: str) -> bool:
    """
    MQTT topic matching with + (single-level) and # (multi-level) wildcards.
    """
    pattern_parts = pattern.split("/")
    topic_parts = topic.split("/")

    def match(pp: List[str], tp: List[str]) -> bool:
        if not pp:
            return not tp
        if pp[0] == "#":
            return True
        if not tp:
            return False
        if pp[0] == "+" or pp[0] == tp[0]:
            return match(pp[1:], tp[1:])
        return False

    return match(pattern_parts, topic_parts)


def _evaluate_conditions(conditions: List[Dict[str, Any]], state: Dict[str, Any]) -> bool:
    """Evaluate all conditions; returns True if all pass (AND logic)."""
    if not conditions:
        return True

    now = datetime.now(timezone.utc)

    for cond in conditions:
        ctype = cond.get("type")

        if ctype == "device_state":
            key = cond.get("state_key")
            op = cond.get("operator", "eq")
            expected = cond.get("value")
            actual = state.get(key)
            if not _compare(actual, op, expected):
                return False

        elif ctype == "time_range":
            start = cond.get("start_time", "00:00")
            end = cond.get("end_time", "23:59")
            current_time = now.strftime("%H:%M")
            if not (start <= current_time <= end):
                return False

        elif ctype == "day_of_week":
            days = cond.get("days", list(range(7)))
            if now.weekday() not in days:
                return False

    return True


def _compare(actual: Any, operator: str, expected: Any) -> bool:
    try:
        if operator == "eq":
            return actual == expected
        if operator == "ne":
            return actual != expected
        if operator == "gt":
            return float(actual) > float(expected)
        if operator == "lt":
            return float(actual) < float(expected)
        if operator == "gte":
            return float(actual) >= float(expected)
        if operator == "lte":
            return float(actual) <= float(expected)
    except (TypeError, ValueError):
        pass
    return False


async def _execute_action(action: Dict[str, Any], mqtt_client) -> None:
    """Execute a single automation action."""
    action_type = action.get("type")

    if action_type == "mqtt_publish":
        topic = action.get("topic")
        payload = action.get("payload", "")
        qos = action.get("qos", 0)
        if topic:
            await mqtt_client.publish(topic, payload=payload, qos=qos)
            logger.info("Automation action: MQTT publish to %s", topic)

    elif action_type == "ha_service_call":
        if not settings.HA_ENABLED:
            logger.warning("HA action triggered but HA_ENABLED=False; skipping.")
            return
        service = action.get("service", "")
        domain, service_name = (service.split(".", 1) + [""])[:2]
        entity_id = action.get("entity_id")
        service_data = action.get("service_data") or {}
        if entity_id:
            service_data["entity_id"] = entity_id

        url = f"{settings.HA_URL.rstrip('/')}/api/services/{domain}/{service_name}"
        headers = {
            "Authorization": f"Bearer {settings.HA_TOKEN}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(url, json=service_data, headers=headers)
                resp.raise_for_status()
                logger.info("HA service call %s succeeded", service)
        except Exception as exc:
            logger.error("HA service call %s failed: %s", service, exc)

    elif action_type == "http_request":
        url = action.get("url")
        if not url:
            return
        method = action.get("method", "GET")
        body = action.get("body")
        headers = action.get("headers") or {}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.request(method, url, json=body, headers=headers)
                resp.raise_for_status()
                logger.info("HTTP request action %s %s succeeded", method, url)
        except Exception as exc:
            logger.error("HTTP request action failed: %s", exc)

    elif action_type == "log":
        message = action.get("message", "(no message)")
        logger.info("Automation log action: %s", message)


async def evaluate(
    db: AsyncSession,
    device_id: Optional[uuid.UUID],
    topic: str,
    payload: str,
    mqtt_client,
) -> None:
    """
    Evaluate all enabled automations. For each automation whose trigger matches,
    check conditions and execute actions.
    """
    result = await db.execute(
        select(Automation).where(Automation.enabled == True)  # noqa: E712
    )
    automations = result.scalars().all()

    # Parse payload once
    state: Dict[str, Any] = {}
    try:
        parsed = json.loads(payload)
        if isinstance(parsed, dict):
            state = parsed
    except (json.JSONDecodeError, ValueError):
        state = {"raw": payload}

    for automation in automations:
        trigger = automation.trigger or {}
        trigger_type = trigger.get("type")

        matched = False
        if trigger_type == "mqtt_topic":
            pattern = trigger.get("topic", "#")
            if _topic_matches(pattern, topic):
                # Optional payload match
                payload_match = trigger.get("payload_match")
                if payload_match:
                    matched = all(
                        state.get(k) == v for k, v in payload_match.items()
                    )
                else:
                    matched = True

        elif trigger_type == "device_state" and device_id is not None:
            trigger_device = trigger.get("device_id")
            if trigger_device is not None and str(trigger_device) != str(device_id):
                continue
            state_key = trigger.get("state_key")
            state_value = trigger.get("state_value")
            if state_key is not None:
                matched = state.get(state_key) == state_value
            else:
                matched = True

        if not matched:
            continue

        # Evaluate conditions
        conditions = automation.conditions or []
        if not _evaluate_conditions(conditions, state):
            continue

        # Execute all actions
        actions = automation.actions or []
        for action in actions:
            try:
                await _execute_action(action, mqtt_client)
            except Exception as exc:
                logger.error(
                    "Automation %s action failed: %s", automation.id, exc
                )

        # Update statistics
        automation.last_triggered = datetime.now(timezone.utc)
        automation.execution_count = (automation.execution_count or 0) + 1
        await db.flush()
        logger.info("Automation '%s' fired (topic=%s)", automation.name, topic)
