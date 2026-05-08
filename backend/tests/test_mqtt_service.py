"""Unit tests for MQTT security inspection and automation topic matching."""
from __future__ import annotations

import base64

import pytest

from app.services.security_service import inspect_mqtt_payload
from app.services.automation_service import _topic_matches


# ── inspect_mqtt_payload ──────────────────────────────────────────────────────

def test_payload_inspection_normal_json():
    """Normal JSON payload on a known topic prefix returns None (no anomaly)."""
    result = inspect_mqtt_payload(
        topic="tele/sensor/SENSOR",
        payload='{"temperature": 23.5, "humidity": 60}',
    )
    # Known topic prefix, normal payload → no anomaly
    assert result is None


def test_payload_inspection_detects_base64_raw():
    """Raw base64-encoded payload triggers an anomaly."""
    # Encode something long enough to exceed the 12-byte threshold
    encoded = base64.b64encode(b"A" * 20).decode()
    result = inspect_mqtt_payload(
        topic="unknown/suspicious/topic",
        payload=encoded,
    )
    assert result is not None
    assert result.event_type == "mqtt_anomaly"
    assert "base64" in result.description.lower() or "encoded" in result.description.lower()


def test_payload_inspection_detects_base64_in_json_field():
    """Base64-looking value inside a JSON field triggers an anomaly."""
    encoded = base64.b64encode(b"X" * 20).decode()
    payload = f'{{"data": "{encoded}"}}'
    result = inspect_mqtt_payload(
        topic="tele/device/STATE",
        payload=payload,
    )
    assert result is not None
    assert "data" in result.description


def test_payload_inspection_unknown_topic_only():
    """Non-base64 payload on an unknown topic only flags the topic mismatch."""
    result = inspect_mqtt_payload(
        topic="mycustom/device/status",
        payload='{"power": "on"}',
    )
    assert result is not None
    assert "mycustom/device/status" in result.description


def test_payload_inspection_cloud_domain():
    """Payload containing a cloud domain reference triggers high severity."""
    result = inspect_mqtt_payload(
        topic="tele/device/SENSOR",
        payload='{"callback": "https://cloud.tuya.com/api/v1"}',
    )
    assert result is not None
    assert result.severity == "high"
    assert "cloud.tuya.com" in result.description


def test_payload_inspection_known_topic_clean_payload():
    """Known topic prefix + clean JSON payload = no anomaly."""
    result = inspect_mqtt_payload(
        topic="stat/plug/POWER",
        payload='{"POWER": "ON"}',
    )
    assert result is None


# ── _topic_matches ─────────────────────────────────────────────────────────────

def test_topic_matches_exact():
    """Exact topic match."""
    assert _topic_matches("home/room/sensor", "home/room/sensor") is True


def test_topic_matches_single_level_wildcard():
    """Single-level wildcard + matches one segment."""
    assert _topic_matches("home/+/sensor", "home/room/sensor") is True
    assert _topic_matches("home/+/sensor", "home/kitchen/sensor") is True
    assert _topic_matches("home/+/sensor", "home/room/other") is False


def test_topic_matches_multi_level_wildcard():
    """Multi-level wildcard # matches everything after the prefix."""
    assert _topic_matches("home/#", "home/room/sensor") is True
    assert _topic_matches("home/#", "home/room/sensor/temp") is True
    assert _topic_matches("#", "any/topic/at/all") is True


def test_topic_matches_hash_only():
    """Bare # matches any topic."""
    assert _topic_matches("#", "single") is True
    assert _topic_matches("#", "a/b/c/d/e") is True


def test_topic_matches_no_match():
    """Mismatched pattern returns False."""
    assert _topic_matches("home/room/sensor", "home/kitchen/sensor") is False
    assert _topic_matches("home/+/sensor", "office/room/sensor") is False


def test_topic_matches_empty_pattern():
    """Empty pattern only matches empty topic."""
    assert _topic_matches("", "") is True
    assert _topic_matches("", "a") is False


def test_topic_matches_combined_wildcards():
    """Pattern with both + and # wildcards."""
    assert _topic_matches("tele/+/#", "tele/device/SENSOR") is True
    assert _topic_matches("tele/+/#", "tele/device/STATE/extra") is True
    # tele/+/# — + matches "device", # matches remaining (0 or more levels)
    # MQTT spec: # matches the parent and any number of subsequent levels
    assert _topic_matches("tele/+/#", "tele/device") is True
    # Totally different prefix should not match
    assert _topic_matches("tele/+/#", "stat/device/SENSOR") is False
