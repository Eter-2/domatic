# Dom'Atic — System Architecture Blueprint

## System Overview

Dom'Atic is a self-hosted, LAN-local web hub for centralized IoT device management. It runs entirely on-premise — no cloud dependency — and exposes a Next.js dashboard that communicates with a FastAPI backend over HTTP/WebSocket. All real-time messaging routes through an MQTT broker (Mosquitto) bridged to Redis pub/sub, which fans out to browser clients via persistent WebSocket connections.

---

## ASCII Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER (Next.js 14)                        │
│  ┌──────────┐ ┌────────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │Dashboard │ │Device Mgmt │ │Security Mon. │ │ Automation UI   │  │
│  └────┬─────┘ └─────┬──────┘ └──────┬───────┘ └────────┬────────┘  │
│       └─────────────┴───────────────┴──────────────────┘           │
│                             │ HTTP (REST + SSR)                     │
│                             │ WS /ws (real-time)                    │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                ┌─────────────▼──────────────┐
                │      FastAPI Backend        │
                │  ┌──────────────────────┐  │
                │  │    API Routers        │  │
                │  │  auth / devices       │  │
                │  │  rooms / firmware     │  │
                │  │  security / mqtt      │  │
                │  │  automations/dash     │  │
                │  └──────────┬───────────┘  │
                │  ┌──────────▼───────────┐  │
                │  │  Services Layer       │  │
                │  │  DeviceService        │  │
                │  │  SecurityService      │  │
                │  │  AutomationEngine     │  │
                │  │  FirmwareService      │  │
                │  └──────────┬───────────┘  │
                │  ┌──────────▼───────────┐  │
                │  │ WebSocket Manager     │  │
                │  │ (connection pool +    │  │
                │  │  Redis subscriber)    │  │
                │  └──────────┬───────────┘  │
                └─────────────┼──────────────┘
                    ┌─────────┼─────────┐
                    │         │         │
          ┌─────────▼──┐  ┌───▼────┐  ┌▼──────────────┐
          │ PostgreSQL  │  │ Redis  │  │ External APIs  │
          │  (main DB)  │  │pub/sub │  │ Pi-hole REST   │
          │  Alembic    │  │ cache  │  │ Home Asst. API │
          └─────────────┘  └───▲────┘  └───────────────┘
                               │
                    ┌──────────┴──────────┐
                    │  MQTT Bridge Task   │
                    │  (aiomqtt async     │
                    │   background task)  │
                    └──────────▲──────────┘
                               │ MQTT subscribe all (#)
                    ┌──────────┴──────────┐
                    │  Mosquitto Broker   │
                    │  (local, port 1883) │
                    └──────────▲──────────┘
                               │ MQTT publish/subscribe
          ┌────────────────────┼──────────────────────┐
          │                    │                      │
   ┌──────┴──────┐    ┌────────┴────────┐   ┌────────┴────────┐
   │ Tasmota     │    │ ESPHome devices │   │ Zigbee2MQTT /   │
   │ ESP8266/32  │    │ ESP32 sensors   │   │ Z-Wave bridge   │
   └─────────────┘    └─────────────────┘   └─────────────────┘
```

### Real-Time Data Flow (MQTT → Browser)

```
IoT Device
  │ publishes MQTT message (e.g. stat/sonoff-01/POWER = ON)
  ▼
Mosquitto Broker (:1883)
  │ aiomqtt subscribe("#") — background asyncio task
  ▼
FastAPI MQTT Bridge
  │ 1. Parse topic → resolve device_id from DB cache
  │ 2. Persist to mqtt_messages table (capped at 10k rows)
  │ 3. Update devices.last_seen + is_online
  │ 4. Snapshot → device_states (if state-bearing topic)
  │ 5. Run AutomationEngine.evaluate(device_id, payload)
  │ 6. SecurityService.inspect(device_id, payload)
  │ 7. Publish envelope to Redis channel "mqtt:events"
  ▼
Redis pub/sub channel "mqtt:events"
  │ WebSocket Manager subscribes via aioredis
  ▼
WebSocket Manager (FastAPI /ws endpoint)
  │ broadcasts JSON envelope to all authenticated WS clients
  ▼
Browser WebSocket client
  │ React state update via zustand / React Query invalidation
  ▼
Dashboard re-renders live tile
```

---

## Key Design Decisions

### 1. Redis as MQTT→WebSocket Decoupling Layer
The MQTT bridge (aiomqtt background task) and the WebSocket fanout layer are fully decoupled through Redis pub/sub. This means: (a) WebSocket connections can be served from multiple FastAPI workers without each worker needing its own MQTT subscription, and (b) the bridge task survives WebSocket churn without reconnection cost. Channel naming convention: `mqtt:events` for device state, `security:alerts` for anomalies, `automation:fired` for triggered automations.

### 2. PostgreSQL JSONB for Flexible Device State
`devices.metadata` and `device_states.state` use JSONB rather than columnar fields because IoT state payloads are wildly heterogeneous (a Tasmota power plug reports `POWER`/`Voltage`/`Current`; an ESPHome temperature sensor reports `temperature`/`humidity`). GIN indexes on these columns support efficient JSON path queries.

### 3. device_states Partitioning Strategy
`device_states` is declared with a `PARTITION BY RANGE (recorded_at)` clause. Monthly partitions are created via a scheduled pg_cron job (or an Alembic migration trigger). This keeps query performance on historical ranges acceptable without TimescaleDB. A nightly cleanup job drops partitions older than 90 days. The FastAPI service always queries with an explicit `recorded_at` range predicate to enable partition pruning.

### 4. Automation Engine Runs In-Process
The `AutomationEngine` is an async in-process service (not a separate worker) that evaluates trigger/condition/action rules synchronously on each MQTT message. Rules are cached in-memory (refreshed on DB write). This avoids the overhead of a task queue for the common case of simple if-this-then-that rules. For actions that call external HTTP endpoints (Home Assistant), the engine uses `httpx.AsyncClient` with a 2-second timeout and swallows failures with an error log — automations must never block the MQTT bridge.

### 5. Security Monitor via Pi-hole + Passive MQTT Inspection
`SecurityService` works on two planes: (a) passive — inspects all MQTT payloads for anomalous patterns (unexpected topics, base64-looking payloads, unusual publishing frequency); (b) active — polls the Pi-hole API (`/admin/api.php?getAllQueries`) on a 60-second interval to detect any IoT device making DNS queries to cloud endpoints. When a violation is found, it is written to `security_events` and a `security:alerts` Redis event is emitted for immediate browser alerting.

### 6. JWT Auth is Local Only
Authentication uses short-lived access JWTs (15 min) plus long-lived refresh tokens (7 days) stored in HttpOnly cookies. There is no OAuth, no external IdP. The initial admin user is seeded via `POST /auth/setup` (only accessible when `users` table is empty). All API endpoints except `/auth/login`, `/auth/refresh`, and `/auth/setup` require a valid Bearer token. WebSocket `/ws` authenticates via `?token=<jwt>` query param on the initial handshake.

### 7. No N+1 Queries — Explicit Eager Loading Policy
All list endpoints that return devices must join `rooms` in the same query (`selectinload` or explicit JOIN). Device history endpoints always include `LIMIT` + `recorded_at` range. The `GET /dashboard/summary` endpoint uses a single aggregation query, not per-device fetches. All foreign key columns (`device_id`, `room_id`) have explicit B-tree indexes.

### 8. Frontend Real-Time Architecture
The Next.js client maintains a single shared WebSocket connection (via a custom React context provider). Incoming events are dispatched by type: `device_state` triggers a React Query cache update for that device; `security_alert` triggers a toast notification + badge increment; `automation_fired` logs to the automation activity feed. The WS connection auto-reconnects with exponential backoff (max 30s).

---

## Environment Variables

### Backend `.env`

```env
# Application
APP_ENV=production                          # development | production
APP_HOST=0.0.0.0
APP_PORT=8000
SECRET_KEY=<random-64-char-hex>             # JWT signing key
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Database
DATABASE_URL=postgresql+asyncpg://domatic:password@localhost:5432/domatic
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

# Redis
REDIS_URL=redis://localhost:6379/0

# MQTT Broker
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_USERNAME=domatic
MQTT_PASSWORD=<mqtt-password>
MQTT_CLIENT_ID=domatic-bridge
MQTT_SUBSCRIBE_TOPIC=#                      # subscribe to all topics

# Pi-hole Integration
PIHOLE_ENABLED=true
PIHOLE_URL=http://192.168.1.1              # Pi-hole admin URL
PIHOLE_API_TOKEN=<pihole-api-token>
PIHOLE_POLL_INTERVAL_SECONDS=60

# Home Assistant Integration (optional)
HA_ENABLED=false
HA_URL=http://homeassistant.local:8123
HA_TOKEN=<long-lived-access-token>

# Security Monitor
SECURITY_CLOUD_DOMAINS=amazonaws.com,azure.com,googleapis.com,tuya.com,meross.com,ewelink.com
SECURITY_ALERT_MQTT_THRESHOLD=100          # messages/minute before alert

# MQTT Message Retention
MQTT_MESSAGE_MAX_ROWS=10000

# Device State Retention
DEVICE_STATE_RETENTION_DAYS=90

# CORS
CORS_ORIGINS=http://localhost:3000,http://domatic.local

# Logging
LOG_LEVEL=INFO
```

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=http://domatic.local:8000
NEXT_PUBLIC_WS_URL=ws://domatic.local:8000/ws
NEXT_PUBLIC_APP_NAME=Dom'Atic
```

---

## External Services & Integrations

| Service | Role | Protocol | Required |
|---|---|---|---|
| Mosquitto MQTT Broker | Central message bus for all IoT devices | MQTT 3.1.1 / 5.0 | Yes |
| PostgreSQL 15+ | Persistent store for all entities | TCP/asyncpg | Yes |
| Redis 7+ | pub/sub decoupling + optional API response cache | TCP/aioredis | Yes |
| Pi-hole v5/v6 | DNS-level security monitoring of IoT traffic | HTTP REST | Optional |
| Home Assistant | Action target for automations (call services) | HTTP REST (Long-Lived Token) | Optional |
| Tasmota devices | Auto-discovered via MQTT `tele/+/INFO1` LWT topics | MQTT | Optional |
| ESPHome devices | Auto-discovered via MQTT `esphome/+/status` topics | MQTT | Optional |
| Zigbee2MQTT | Bridge for Zigbee devices into MQTT | MQTT | Optional |

---

## Network Topology Assumptions

- All IoT devices and Dom'Atic server are on the same LAN (or VLANs with MQTT/DNS reachability).
- Dom'Atic server has a static LAN IP (e.g. `192.168.10.10`) or mDNS alias `domatic.local`.
- Mosquitto binds to `0.0.0.0:1883` with password auth enabled.
- IoT devices on a dedicated VLAN (`192.168.20.0/24`) with firewall rules blocking WAN egress — Pi-hole integration monitors any rule bypasses.

---

## Security Posture

- All passwords and tokens stored as environment variables, never committed.
- MQTT broker requires username/password (no anonymous access in production).
- JWT refresh tokens stored in HttpOnly, SameSite=Strict cookies.
- Pi-hole integration is read-only (query log polling only, no DNS block writes from Dom'Atic).
- Home Assistant actions use a dedicated least-privilege HA user token.
- `security_events` table is append-only; resolved events are flagged, never deleted.
