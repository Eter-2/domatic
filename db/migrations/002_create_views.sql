-- =============================================================================
-- Dom'Atic — Migration 002: Views
-- =============================================================================

-- Device summary view — used by /dashboard/summary endpoint
-- Avoids N+1 by aggregating in DB
CREATE OR REPLACE VIEW v_device_summary AS
SELECT
    d.id,
    d.name,
    d.room_id,
    r.name                          AS room_name,
    d.protocol,
    d.chip_type,
    d.firmware_type,
    d.firmware_version,
    d.firmware_latest,
    d.firmware_update_available,
    d.ip_address,
    d.mac_address,
    d.is_online,
    d.is_cloud_dependent,
    d.is_blocked,
    d.last_seen,
    d.mqtt_topic,
    d.metadata,
    COALESCE(se.unresolved_count, 0) AS unresolved_security_events
FROM devices d
LEFT JOIN rooms r ON r.id = d.room_id
LEFT JOIN (
    SELECT device_id, COUNT(*) AS unresolved_count
    FROM security_events
    WHERE resolved = false
    GROUP BY device_id
) se ON se.device_id = d.id;

-- Security stats view
CREATE OR REPLACE VIEW v_security_stats AS
SELECT
    COUNT(*)                                                    AS total_events,
    COUNT(*) FILTER (WHERE resolved = false)                    AS open_events,
    COUNT(*) FILTER (WHERE severity = 'critical')               AS critical_count,
    COUNT(*) FILTER (WHERE severity = 'high')                   AS high_count,
    COUNT(*) FILTER (WHERE severity = 'medium')                 AS medium_count,
    COUNT(*) FILTER (WHERE severity = 'low')                    AS low_count,
    COUNT(*) FILTER (WHERE severity = 'info')                   AS info_count,
    COUNT(*) FILTER (WHERE blocked = true)                      AS blocked_count,
    COUNT(DISTINCT device_id) FILTER (WHERE resolved = false)   AS affected_devices,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS last_24h
FROM security_events;

-- Devices needing firmware update
CREATE OR REPLACE VIEW v_firmware_update_candidates AS
SELECT
    d.id,
    d.name,
    d.room_id,
    r.name          AS room_name,
    d.firmware_type,
    d.firmware_version AS current_version,
    d.firmware_latest  AS latest_version,
    d.ip_address,
    d.last_seen,
    d.is_online
FROM devices d
LEFT JOIN rooms r ON r.id = d.room_id
WHERE d.firmware_update_available = true
ORDER BY d.firmware_type, d.name;
