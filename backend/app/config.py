from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import List

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://domatic:domatic@localhost:5432/domatic",
        description="Async PostgreSQL connection string (asyncpg driver).",
    )

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL.",
    )

    # ── MQTT ──────────────────────────────────────────────────────────────────
    MQTT_HOST: str = Field(default="localhost", description="MQTT broker hostname.")
    MQTT_PORT: int = Field(default=1883, description="MQTT broker port.")
    MQTT_USERNAME: str = Field(default="", description="MQTT broker username.")
    MQTT_PASSWORD: str = Field(default="", description="MQTT broker password.")
    MQTT_CLIENT_ID: str = Field(
        default="domatic-backend", description="MQTT client identifier."
    )
    MQTT_SUBSCRIBE_TOPIC: str = Field(
        default="#", description="MQTT topic filter (wildcard '#' = all)."
    )

    # ── App environment ───────────────────────────────────────────────────────
    # Set ENVIRONMENT=production in .env (or docker-compose) to enable strict
    # security checks such as the SECRET_KEY default guard.
    ENVIRONMENT: str = Field(default="development", description="Runtime environment: development | production.")

    # ── JWT / Auth ────────────────────────────────────────────────────────────
    SECRET_KEY: str = Field(
        default="CHANGE_ME_in_production_at_least_32_chars_long",
        description="HMAC secret for JWT signing.",
    )
    ALGORITHM: str = Field(default="HS256", description="JWT signing algorithm.")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=30, description="Access token TTL in minutes."
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=7, description="Refresh token TTL in days."
    )

    # ── Pi-hole ───────────────────────────────────────────────────────────────
    PIHOLE_ENABLED: bool = Field(default=False, description="Enable Pi-hole integration.")
    PIHOLE_URL: str = Field(
        default="http://pihole.local", description="Pi-hole admin base URL."
    )
    PIHOLE_API_TOKEN: str = Field(default="", description="Pi-hole API token.")
    PIHOLE_POLL_INTERVAL_SECONDS: int = Field(
        default=60, description="Pi-hole polling interval in seconds."
    )

    # ── Home Assistant ────────────────────────────────────────────────────────
    HA_ENABLED: bool = Field(
        default=False, description="Enable Home Assistant integration."
    )
    HA_URL: str = Field(
        default="http://homeassistant.local:8123",
        description="Home Assistant base URL.",
    )
    HA_TOKEN: str = Field(
        default="", description="Home Assistant long-lived access token."
    )

    # ── Security ──────────────────────────────────────────────────────────────
    SECURITY_CLOUD_DOMAINS_RAW: str = Field(
        default="amazonaws.com,cloud.tuya.com,iot.tuya.com,smartlife.io,meethue.com,lifx.io",
        alias="SECURITY_CLOUD_DOMAINS",
        description="Comma-separated list of known cloud domains to flag.",
    )
    SECURITY_ALERT_MQTT_THRESHOLD: int = Field(
        default=100,
        description="Number of MQTT messages per minute before alert.",
    )

    # ── Retention / Caps ──────────────────────────────────────────────────────
    MQTT_MESSAGE_MAX_ROWS: int = Field(
        default=10000, description="Maximum rows retained in mqtt_messages table."
    )
    DEVICE_STATE_RETENTION_DAYS: int = Field(
        default=90, description="Days to retain device state history."
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS_RAW: str = Field(
        default="http://localhost:3000,http://localhost:5173",
        alias="CORS_ORIGINS",
        description="Comma-separated list of allowed CORS origins.",
    )

    # ── Logging ───────────────────────────────────────────────────────────────
    LOG_LEVEL: str = Field(default="INFO", description="Python logging level name.")

    # ── Computed properties ───────────────────────────────────────────────────
    @property
    def security_cloud_domains(self) -> List[str]:
        return [d.strip() for d in self.SECURITY_CLOUD_DOMAINS_RAW.split(",") if d.strip()]

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS_RAW.split(",") if o.strip()]

    @field_validator("LOG_LEVEL")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        numeric = getattr(logging, v.upper(), None)
        if not isinstance(numeric, int):
            raise ValueError(f"Invalid LOG_LEVEL: {v}")
        return v.upper()

    @model_validator(mode="after")
    def validate_secret_key(self) -> "Settings":
        """A02: Refuse to start in production with the default/weak SECRET_KEY."""
        _WEAK_DEFAULTS = {
            "CHANGE_ME_in_production_at_least_32_chars_long",
            "CHANGE_ME_generate_a_strong_secret_key_at_least_32_chars",
            "",
        }
        if self.ENVIRONMENT.lower() == "production":
            if self.SECRET_KEY in _WEAK_DEFAULTS or len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "SECRET_KEY must be a strong random value (≥32 chars) in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings: Settings = get_settings()
