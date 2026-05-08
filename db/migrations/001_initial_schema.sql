-- =============================================================================
-- Dom'Atic — Migration 001: Initial Schema
-- Compatible with: PostgreSQL 15+
-- Managed by: Alembic (SQLAlchemy 2.0 async)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- trigram search on device names

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE protocol_type AS ENUM (
    'wifi',
    'zigbee',
    'zwave',
    'ble',
    'matter',
    'ethernet',
    'unknown'
);

CREATE TYPE chip_type AS ENUM (
    'esp8266',
    'esp32',
    'esp32s2',
    'esp32s3',
    'esp32c3',
    'bk7231',
    'bk7231n',
    'rtl8710',
    'unknown'
);

CREATE TYPE firmware_type AS ENUM (
    'tasmota',
    'esphome',
    'openbk',
    'openshock',
    'original',
    'custom',
    'unknown'
);

CREATE TYPE security_severity AS ENUM (
    'info',
    'low',
    'medium',
    'high',
    'critical'
);

CREATE TYPE firmware_update_status AS ENUM (
    'pending',
    'in_progress',
    'success',
    'failed',
    'rolled_back'
);

CREATE TYPE automation_trigger_type AS ENUM (
    'mqtt_message',
    'device_state',
    'schedule',
    'security_event',
    'manual'
);

-- =============================================================================
-- TABLE: users
-- =============================================================================
CREATE TABLE users (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(64)     NOT NULL,
    email           VARCHAR(255)    NOT NULL,
    hashed_password VARCHAR(255)    NOT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT true,
    is_superuser    BOOLEAN         NOT NULL DEFAULT false,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT users_username_unique UNIQUE (username),
    CONSTRAINT users_email_unique    UNIQUE (email),
    CONSTRAINT users_username_length CHECK (char_length(username) >= 3)
);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- TABLE: rooms
-- =============================================================================
CREATE TABLE rooms (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    icon        VARCHAR(50),                    -- lucide icon name e.g. "sofa", "bed"
    floor       SMALLINT    NOT NULL DEFAULT 0, -- 0=ground, 1=first, -1=basement
    vlan_id     SMALLINT,                       -- optional VLAN tag for network map
    color       CHAR(7),                        -- hex color for UI e.g. "#3B82F6"
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT rooms_name_unique UNIQUE (name),
    CONSTRAINT rooms_color_format CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE TRIGGER rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- TABLE: devices
-- =============================================================================
CREATE TABLE devices (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(150)    NOT NULL,
    room_id             UUID            REFERENCES rooms(id) ON DELETE SET NULL,

    -- Network
    ip_address          INET,
    mac_address         MACADDR,

    -- Protocol & Hardware
    protocol            protocol_type   NOT NULL DEFAULT 'wifi',
    chip_type           chip_type       NOT NULL DEFAULT 'unknown',

    -- Firmware
    firmware_type       firmware_type   NOT NULL DEFAULT 'unknown',
    firmware_version    VARCHAR(50),                -- e.g. "13.4.0", "2024.1.1"
    firmware_latest     VARCHAR(50),                -- populated by firmware checker
    firmware_update_available BOOLEAN   NOT NULL DEFAULT false,

    -- MQTT
    mqtt_topic          VARCHAR(255),               -- base topic e.g. "tasmota/sonoff-01"
    mqtt_lwt_topic      VARCHAR(255),               -- LWT topic for online/offline detection

    -- Status
    is_online           BOOLEAN         NOT NULL DEFAULT false,
    last_seen           TIMESTAMPTZ,
    is_cloud_dependent  BOOLEAN         NOT NULL DEFAULT false,
    cloud_attempts      INTEGER         NOT NULL DEFAULT 0, -- lifetime cloud contact attempts

    -- Security
    is_blocked          BOOLEAN         NOT NULL DEFAULT false,
    blocked_reason      TEXT,
    blocked_at          TIMESTAMPTZ,

    -- Flexible metadata (ESPHome fields, Tasmota module, HA entity_id, etc.)
    metadata            JSONB           NOT NULL DEFAULT '{}',

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT devices_name_not_empty CHECK (char_length(trim(name)) > 0),
    CONSTRAINT devices_mac_unique UNIQUE (mac_address),
    CONSTRAINT devices_ip_unique  UNIQUE (ip_address)
);

CREATE TRIGGER devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Indexes on devices
CREATE INDEX idx_devices_room_id        ON devices (room_id);
CREATE INDEX idx_devices_last_seen      ON devices (last_seen DESC NULLS LAST);
CREATE INDEX idx_devices_is_online      ON devices (is_online);
CREATE INDEX idx_devices_mqtt_topic     ON devices (mqtt_topic);
CREATE INDEX idx_devices_protocol       ON devices (protocol);
CREATE INDEX idx_devices_firmware_type  ON devices (firmware_type);
CREATE INDEX idx_devices_update_avail   ON devices (firmware_update_available) WHERE firmware_update_available = true;
CREATE INDEX idx_devices_cloud_dep      ON devices (is_cloud_dependent) WHERE is_cloud_dependent = true;
CREATE INDEX idx_devices_name_trgm      ON devices USING gin (name gin_trgm_ops);
CREATE INDEX idx_devices_metadata_gin   ON devices USING gin (metadata jsonb_path_ops);

-- =============================================================================
-- TABLE: device_states
-- Time-series snapshots of device state payloads.
-- Partitioned by recorded_at (monthly). Partition pruning requires that all
-- queries include a recorded_at range predicate.
-- =============================================================================
CREATE TABLE device_states (
    id          BIGSERIAL,
    device_id   UUID            NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    state       JSONB           NOT NULL,           -- full state snapshot
    mqtt_topic  VARCHAR(255),                       -- originating topic
    recorded_at TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT device_states_pkey PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Default partition catches anything not matched by monthly partitions
CREATE TABLE device_states_default
    PARTITION OF device_states DEFAULT;

-- Monthly partitions (2025)
CREATE TABLE device_states_2025_01 PARTITION OF device_states
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE device_states_2025_02 PARTITION OF device_states
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE device_states_2025_03 PARTITION OF device_states
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE device_states_2025_04 PARTITION OF device_states
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE device_states_2025_05 PARTITION OF device_states
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE device_states_2025_06 PARTITION OF device_states
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE device_states_2025_07 PARTITION OF device_states
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE device_states_2025_08 PARTITION OF device_states
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE device_states_2025_09 PARTITION OF device_states
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE device_states_2025_10 PARTITION OF device_states
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE device_states_2025_11 PARTITION OF device_states
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE device_states_2025_12 PARTITION OF device_states
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Monthly partitions (2026)
CREATE TABLE device_states_2026_01 PARTITION OF device_states
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE device_states_2026_02 PARTITION OF device_states
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE device_states_2026_03 PARTITION OF device_states
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE device_states_2026_04 PARTITION OF device_states
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE device_states_2026_05 PARTITION OF device_states
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE device_states_2026_06 PARTITION OF device_states
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Indexes on device_states (applied to each partition automatically)
CREATE INDEX idx_device_states_device_recorded
    ON device_states (device_id, recorded_at DESC);
CREATE INDEX idx_device_states_recorded_at
    ON device_states (recorded_at DESC);
CREATE INDEX idx_device_states_state_gin
    ON device_states USING gin (state jsonb_path_ops);

-- =============================================================================
-- TABLE: security_events
-- Anomalies: cloud contact attempts, unusual MQTT traffic, unknown devices.
-- Append-only: resolved events are flagged, never deleted.
-- =============================================================================
CREATE TABLE security_events (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID            REFERENCES devices(id) ON DELETE SET NULL,

    event_type      VARCHAR(80)     NOT NULL,       -- e.g. "cloud_dns_query", "mqtt_flood", "unknown_device"
    description     TEXT            NOT NULL,
    severity        security_severity NOT NULL DEFAULT 'medium',

    source_ip       INET,
    destination_ip  INET,
    destination_host VARCHAR(255),                  -- domain name if DNS-based detection

    -- Resolution
    blocked         BOOLEAN         NOT NULL DEFAULT false,
    resolved        BOOLEAN         NOT NULL DEFAULT false,
    resolved_by     UUID            REFERENCES users(id) ON DELETE SET NULL,
    resolved_at     TIMESTAMPTZ,
    resolution_note TEXT,

    -- Raw evidence
    raw_data        JSONB           NOT NULL DEFAULT '{}',

    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT security_events_resolution_consistency
        CHECK (resolved = false OR (resolved = true AND resolved_at IS NOT NULL))
);

-- Indexes on security_events
CREATE INDEX idx_security_events_device_id   ON security_events (device_id);
CREATE INDEX idx_security_events_created_at  ON security_events (created_at DESC);
CREATE INDEX idx_security_events_severity    ON security_events (severity);
CREATE INDEX idx_security_events_unresolved  ON security_events (resolved, created_at DESC) WHERE resolved = false;
CREATE INDEX idx_security_events_event_type  ON security_events (event_type);

-- =============================================================================
-- TABLE: automations
-- Trigger-condition-action rules evaluated on each MQTT message.
-- trigger, conditions, actions stored as JSONB for maximum flexibility.
-- =============================================================================
CREATE TABLE automations (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150)    NOT NULL,
    description     TEXT,
    enabled         BOOLEAN         NOT NULL DEFAULT true,

    -- Trigger definition
    -- Example: {"type": "mqtt_message", "topic": "stat/sonoff-01/POWER", "value": "ON"}
    -- Example: {"type": "schedule", "cron": "0 22 * * *"}
    trigger         JSONB           NOT NULL,

    -- Conditions (all must be true)
    -- Example: [{"type": "time_range", "from": "08:00", "to": "22:00"}, {"type": "device_state", "device_id": "...", "key": "POWER", "value": "ON"}]
    conditions      JSONB           NOT NULL DEFAULT '[]',

    -- Actions to execute in order
    -- Example: [{"type": "mqtt_publish", "topic": "cmnd/sonoff-02/POWER", "payload": "ON"}]
    actions         JSONB           NOT NULL DEFAULT '[]',

    -- Execution stats
    run_count       INTEGER         NOT NULL DEFAULT 0,
    last_triggered  TIMESTAMPTZ,
    last_error      TEXT,

    created_by      UUID            REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT automations_name_not_empty CHECK (char_length(trim(name)) > 0),
    CONSTRAINT automations_trigger_has_type CHECK (trigger ? 'type')
);

CREATE TRIGGER automations_updated_at
    BEFORE UPDATE ON automations
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_automations_enabled    ON automations (enabled) WHERE enabled = true;
CREATE INDEX idx_automations_trigger    ON automations USING gin (trigger jsonb_path_ops);
CREATE INDEX idx_automations_created_by ON automations (created_by);

-- =============================================================================
-- TABLE: mqtt_messages
-- Rolling log of recent MQTT messages — capped at MQTT_MESSAGE_MAX_ROWS (10k).
-- Cleanup is performed by a background task that deletes oldest rows when
-- count exceeds the cap. NOT a time-series table — no partitioning needed.
-- =============================================================================
CREATE TABLE mqtt_messages (
    id          BIGSERIAL       PRIMARY KEY,
    topic       VARCHAR(512)    NOT NULL,
    payload     TEXT,                           -- raw payload as text (may be JSON)
    payload_json JSONB,                         -- populated if payload is valid JSON
    qos         SMALLINT        NOT NULL DEFAULT 0 CHECK (qos IN (0, 1, 2)),
    retained    BOOLEAN         NOT NULL DEFAULT false,
    device_id   UUID            REFERENCES devices(id) ON DELETE SET NULL, -- resolved from topic
    received_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Indexes on mqtt_messages
CREATE INDEX idx_mqtt_messages_topic       ON mqtt_messages (topic);
CREATE INDEX idx_mqtt_messages_received_at ON mqtt_messages (received_at DESC);
CREATE INDEX idx_mqtt_messages_device_id   ON mqtt_messages (device_id);

-- Partial index for retained messages
CREATE INDEX idx_mqtt_messages_retained    ON mqtt_messages (retained, received_at DESC) WHERE retained = true;

-- =============================================================================
-- TABLE: firmware_updates
-- History of firmware flash operations per device.
-- =============================================================================
CREATE TABLE firmware_updates (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID            NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

    from_firmware   firmware_type,
    to_firmware     firmware_type   NOT NULL,
    from_version    VARCHAR(50),
    to_version      VARCHAR(50)     NOT NULL,

    status          firmware_update_status NOT NULL DEFAULT 'pending',

    -- Optional structured notes (flash method, OTA URL, etc.)
    notes           TEXT,
    metadata        JSONB           NOT NULL DEFAULT '{}',

    initiated_by    UUID            REFERENCES users(id) ON DELETE SET NULL,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT firmware_updates_version_not_empty CHECK (char_length(trim(to_version)) > 0)
);

CREATE TRIGGER firmware_updates_updated_at
    BEFORE UPDATE ON firmware_updates
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_firmware_updates_device_id  ON firmware_updates (device_id);
CREATE INDEX idx_firmware_updates_status     ON firmware_updates (status);
CREATE INDEX idx_firmware_updates_created_at ON firmware_updates (created_at DESC);
CREATE INDEX idx_firmware_updates_pending    ON firmware_updates (device_id, status) WHERE status = 'pending';
