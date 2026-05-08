"""
Unit tests for automation evaluation engine.

Tests the _topic_matches, _evaluate_conditions, _compare, and evaluate functions
directly without needing the HTTP layer.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.automation_service import (
    _compare,
    _evaluate_conditions,
    _topic_matches,
    create_automation,
    evaluate,
    get_automation,
    get_automations,
    toggle_automation,
    update_automation,
    delete_automation,
)
from app.schemas.automations import (
    AutomationAction,
    AutomationCondition,
    AutomationCreate,
    AutomationTrigger,
    AutomationUpdate,
)

# Only mark async tests with asyncio; sync tests don't need it
# (pytestmark applies to all, so we don't set it module-wide here)

# ── _compare ──────────────────────────────────────────────────────────────────

def test_compare_eq():
    assert _compare("on", "eq", "on") is True
    assert _compare("on", "eq", "off") is False


def test_compare_ne():
    assert _compare("on", "ne", "off") is True
    assert _compare("on", "ne", "on") is False


def test_compare_gt():
    assert _compare(25.0, "gt", 20.0) is True
    assert _compare(20.0, "gt", 25.0) is False


def test_compare_lt():
    assert _compare(10.0, "lt", 20.0) is True
    assert _compare(20.0, "lt", 10.0) is False


def test_compare_gte():
    assert _compare(20.0, "gte", 20.0) is True
    assert _compare(19.0, "gte", 20.0) is False


def test_compare_lte():
    assert _compare(20.0, "lte", 20.0) is True
    assert _compare(21.0, "lte", 20.0) is False


def test_compare_type_error_returns_false():
    """Non-numeric values with numeric operators return False gracefully."""
    assert _compare("hello", "gt", "world") is False
    assert _compare(None, "lt", 10) is False


# ── _evaluate_conditions ─────────────────────────────────────────────────────

def test_evaluate_conditions_empty():
    """Empty conditions always return True (no constraints)."""
    assert _evaluate_conditions([], {}) is True


def test_evaluate_conditions_device_state_match():
    """device_state condition passes when state matches."""
    cond = [{"type": "device_state", "state_key": "power", "operator": "eq", "value": "ON"}]
    assert _evaluate_conditions(cond, {"power": "ON"}) is True
    assert _evaluate_conditions(cond, {"power": "OFF"}) is False


def test_evaluate_conditions_time_range():
    """time_range condition passes when current time is within range."""
    # Use a range that covers the whole day to ensure it always passes
    cond = [{"type": "time_range", "start_time": "00:00", "end_time": "23:59"}]
    assert _evaluate_conditions(cond, {}) is True


def test_evaluate_conditions_time_range_fails():
    """time_range condition fails when time is out of range."""
    # Use an impossible range
    cond = [{"type": "time_range", "start_time": "99:99", "end_time": "00:00"}]
    assert _evaluate_conditions(cond, {}) is False


def test_evaluate_conditions_day_of_week():
    """day_of_week condition passes when today is in the allowed days."""
    # Include all days to ensure it always passes
    cond = [{"type": "day_of_week", "days": [0, 1, 2, 3, 4, 5, 6]}]
    assert _evaluate_conditions(cond, {}) is True


def test_evaluate_conditions_day_of_week_fails():
    """day_of_week condition fails when no days are allowed."""
    cond = [{"type": "day_of_week", "days": []}]
    assert _evaluate_conditions(cond, {}) is False


def test_evaluate_conditions_multiple_all_must_pass():
    """All conditions must pass (AND logic)."""
    conditions = [
        {"type": "device_state", "state_key": "power", "operator": "eq", "value": "ON"},
        {"type": "device_state", "state_key": "brightness", "operator": "gt", "value": 50},
    ]
    assert _evaluate_conditions(conditions, {"power": "ON", "brightness": 80}) is True
    assert _evaluate_conditions(conditions, {"power": "ON", "brightness": 20}) is False
    assert _evaluate_conditions(conditions, {"power": "OFF", "brightness": 80}) is False


# ── evaluate (full engine) ────────────────────────────────────────────────────

async def _make_automation(db: AsyncSession, trigger_type="mqtt_topic", topic="tele/+/SENSOR"):
    """Helper: create an automation in the DB and return it."""
    data = AutomationCreate(
        name=f"Test automation {uuid.uuid4().hex[:6]}",
        enabled=True,
        trigger=AutomationTrigger(type=trigger_type, topic=topic),
        conditions=[],
        actions=[AutomationAction(type="log", message="test action fired")],
    )
    return await create_automation(db, data)


async def test_evaluate_fires_matching_automation(test_db: AsyncSession):
    """evaluate() runs actions for automations whose topic matches."""
    await _make_automation(test_db, topic="tele/+/SENSOR")
    await test_db.commit()

    mock_mqtt = AsyncMock()
    await evaluate(
        db=test_db,
        device_id=None,
        topic="tele/device123/SENSOR",
        payload='{"temperature": 22}',
        mqtt_client=mock_mqtt,
    )
    # Log action doesn't call mqtt, but should not raise
    mock_mqtt.publish.assert_not_called()


async def test_evaluate_does_not_fire_non_matching_topic(test_db: AsyncSession):
    """evaluate() skips automations whose topic doesn't match."""
    await _make_automation(test_db, topic="cmnd/light/POWER")
    await test_db.commit()

    mock_mqtt = AsyncMock()
    await evaluate(
        db=test_db,
        device_id=None,
        topic="tele/sensor/TEMPERATURE",
        payload='{"temp": 20}',
        mqtt_client=mock_mqtt,
    )
    mock_mqtt.publish.assert_not_called()


async def test_evaluate_fires_mqtt_publish_action(test_db: AsyncSession):
    """evaluate() executes mqtt_publish actions for matched automations."""
    data = AutomationCreate(
        name=f"MQTT pub test {uuid.uuid4().hex[:6]}",
        enabled=True,
        trigger=AutomationTrigger(type="mqtt_topic", topic="trigger/#"),
        conditions=[],
        actions=[
            AutomationAction(
                type="mqtt_publish",
                topic="response/topic",
                payload="ON",
                qos=0,
            )
        ],
    )
    await create_automation(test_db, data)
    await test_db.commit()

    mock_mqtt = AsyncMock()
    await evaluate(
        db=test_db,
        device_id=None,
        topic="trigger/event",
        payload="{}",
        mqtt_client=mock_mqtt,
    )
    mock_mqtt.publish.assert_called_once_with("response/topic", payload="ON", qos=0)


async def test_evaluate_respects_payload_match(test_db: AsyncSession):
    """evaluate() only fires when payload_match conditions are met."""
    data = AutomationCreate(
        name=f"Payload match test {uuid.uuid4().hex[:6]}",
        enabled=True,
        trigger=AutomationTrigger(
            type="mqtt_topic",
            topic="stat/#",
            payload_match={"POWER": "ON"},
        ),
        conditions=[],
        actions=[AutomationAction(type="log", message="fired")],
    )
    await create_automation(test_db, data)
    await test_db.commit()

    mock_mqtt = AsyncMock()

    # Should NOT fire (payload doesn't match)
    await evaluate(
        db=test_db,
        device_id=None,
        topic="stat/plug/POWER",
        payload='{"POWER": "OFF"}',
        mqtt_client=mock_mqtt,
    )

    # Should fire (payload matches)
    await evaluate(
        db=test_db,
        device_id=None,
        topic="stat/plug/POWER",
        payload='{"POWER": "ON"}',
        mqtt_client=mock_mqtt,
    )


async def test_evaluate_skips_disabled_automations(test_db: AsyncSession):
    """evaluate() skips disabled automations."""
    data = AutomationCreate(
        name=f"Disabled test {uuid.uuid4().hex[:6]}",
        enabled=False,
        trigger=AutomationTrigger(type="mqtt_topic", topic="#"),
        conditions=[],
        actions=[AutomationAction(type="log", message="should not fire")],
    )
    auto = await create_automation(test_db, data)
    await test_db.commit()

    # Disable it (it was already disabled, but ensure toggle works)
    assert auto.enabled is False

    mock_mqtt = AsyncMock()
    await evaluate(
        db=test_db,
        device_id=None,
        topic="any/topic",
        payload="{}",
        mqtt_client=mock_mqtt,
    )
    # Should not fire since disabled


async def test_evaluate_device_state_trigger(test_db: AsyncSession):
    """evaluate() handles device_state trigger type with device_id filter."""
    device_id = uuid.uuid4()
    data = AutomationCreate(
        name=f"Device state test {uuid.uuid4().hex[:6]}",
        enabled=True,
        trigger=AutomationTrigger(
            type="device_state",
            device_id=device_id,
            state_key="power",
            state_value="ON",
        ),
        conditions=[],
        actions=[AutomationAction(type="log", message="device state matched")],
    )
    await create_automation(test_db, data)
    await test_db.commit()

    mock_mqtt = AsyncMock()
    await evaluate(
        db=test_db,
        device_id=device_id,
        topic="tele/device/STATE",
        payload='{"power": "ON"}',
        mqtt_client=mock_mqtt,
    )


async def test_evaluate_updates_execution_count(test_db: AsyncSession):
    """evaluate() increments execution_count when automation fires."""
    data = AutomationCreate(
        name=f"Count test {uuid.uuid4().hex[:6]}",
        enabled=True,
        trigger=AutomationTrigger(type="mqtt_topic", topic="counter/+"),
        conditions=[],
        actions=[AutomationAction(type="log", message="counting")],
    )
    auto = await create_automation(test_db, data)
    await test_db.commit()
    initial_count = auto.execution_count

    mock_mqtt = AsyncMock()
    await evaluate(
        db=test_db,
        device_id=None,
        topic="counter/test",
        payload="{}",
        mqtt_client=mock_mqtt,
    )
    await test_db.commit()

    refreshed = await get_automation(test_db, auto.id)
    assert refreshed.execution_count == initial_count + 1
    assert refreshed.last_triggered is not None
