-- =============================================================================
-- Dom'Atic — Seed 002: Demo Devices
-- 5 sample devices with different protocols/firmware types for demo purposes
-- Requires rooms seed to have run first (uses subquery to look up room IDs)
-- =============================================================================

INSERT INTO devices (
    name,
    room_id,
    ip_address,
    mac_address,
    protocol,
    chip_type,
    firmware_type,
    firmware_version,
    firmware_latest,
    firmware_update_available,
    mqtt_topic,
    mqtt_lwt_topic,
    is_online,
    last_seen,
    is_cloud_dependent,
    metadata
) VALUES
    -- 1. Tasmota smart plug in Living Room (WiFi/ESP8266, update available)
    (
        'Living Room Plug',
        (SELECT id FROM rooms WHERE name = 'Living Room' LIMIT 1),
        '192.168.10.101',
        '4c:11:ae:01:02:03',
        'wifi',
        'esp8266',
        'tasmota',
        '13.2.0',
        '13.4.0',
        true,
        'tasmota/sonoff-living-01',
        'tasmota/sonoff-living-01/LWT',
        true,
        NOW() - INTERVAL '2 minutes',
        false,
        '{"module": "Sonoff S26", "ha_entity_id": "switch.living_room_plug"}'
    ),
    -- 2. ESPHome temperature sensor in Bedroom (WiFi/ESP32)
    (
        'Bedroom Climate Sensor',
        (SELECT id FROM rooms WHERE name = 'Bedroom' LIMIT 1),
        '192.168.10.102',
        'a4:cf:12:04:05:06',
        'wifi',
        'esp32',
        'esphome',
        '2024.2.1',
        '2024.2.1',
        false,
        'esphome/bedroom-climate',
        'esphome/bedroom-climate/status',
        true,
        NOW() - INTERVAL '30 seconds',
        false,
        '{"sensors": ["temperature", "humidity"], "ha_entity_id": "sensor.bedroom_temperature"}'
    ),
    -- 3. Zigbee motion detector in Hallway (Zigbee/unknown chip — coordinator managed)
    (
        'Hallway Motion Sensor',
        (SELECT id FROM rooms WHERE name = 'Hallway' LIMIT 1),
        NULL,
        'dc:54:75:07:08:09',
        'zigbee',
        'unknown',
        'original',
        '3.1.5',
        NULL,
        false,
        'zigbee2mqtt/hallway-motion',
        NULL,
        true,
        NOW() - INTERVAL '5 minutes',
        false,
        '{"zigbee_model": "TRADFRI motion sensor", "ieee": "0xdc547507080900"}'
    ),
    -- 4. OpenBK smart switch in Kitchen (WiFi/BK7231N, cloud-dependent, blocked)
    (
        'Kitchen Ceiling Light',
        (SELECT id FROM rooms WHERE name = 'Kitchen' LIMIT 1),
        '192.168.10.104',
        'b4:e6:2d:0a:0b:0c',
        'wifi',
        'bk7231n',
        'openbk',
        '1.17.358',
        '1.18.400',
        true,
        'openbk/kitchen-light',
        'openbk/kitchen-light/LWT',
        false,
        NOW() - INTERVAL '3 hours',
        true,
        '{"original_cloud": "Tuya", "cloud_attempts_last_24h": 47}'
    ),
    -- 5. Matter smart thermostat in Office (Ethernet/ESP32S3)
    (
        'Office Thermostat',
        (SELECT id FROM rooms WHERE name = 'Office' LIMIT 1),
        '192.168.10.105',
        '78:21:84:0d:0e:0f',
        'matter',
        'esp32s3',
        'custom',
        '2.0.1',
        '2.0.1',
        false,
        'matter/office-thermostat',
        'matter/office-thermostat/LWT',
        true,
        NOW() - INTERVAL '1 minute',
        false,
        '{"matter_vendor_id": "0x1001", "matter_product_id": "0x0001", "setpoint_celsius": 21.5}'
    )
ON CONFLICT (mac_address) DO NOTHING;
