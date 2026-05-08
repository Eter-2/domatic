# Dom'Atic — Complete File Structure

Every file listed here will be created by implementation agents.
Files marked `[G]` are generated/auto-created (migrations, lock files, build artifacts) — do not hand-write them.

```
domAtic/
│
├── docker-compose.yml              # Orchestrates: postgres, redis, mosquitto, backend, frontend
├── docker-compose.override.yml     # Dev overrides: volume mounts, hot-reload, exposed ports
├── .env.example                    # Root env template (references backend/.env.example)
├── .gitignore
├── Makefile                        # Convenience targets: up, down, build, logs, migrate, seed
│
├── mosquitto/                      # MQTT broker config
│   ├── mosquitto.conf              # listener 1883, require_certificate false, password_file
│   ├── passwd                      # [G] mosquitto_passwd generated file (gitignored)
│   └── data/                       # [G] Mosquitto persistence (gitignored)
│
├── db/
│   ├── migrations/                 # Raw SQL migrations (reference only — Alembic is authoritative)
│   │   └── 001_initial_schema.sql  # The full db-schema.sql from .factory/
│   └── seeds/
│       └── seed_rooms.sql          # Default room data (also embedded in db-schema.sql)
│
├── backend/
│   ├── Dockerfile                  # Python 3.12-slim, installs requirements, runs uvicorn
│   ├── Dockerfile.dev              # Adds --reload flag, mounts src
│   ├── requirements.txt            # All pinned Python dependencies (see list below)
│   ├── requirements-dev.txt        # pytest, httpx[test], pytest-asyncio, ruff, mypy
│   ├── .env.example                # All backend env vars (mirrors architecture.md)
│   ├── pyproject.toml              # Ruff + mypy config, project metadata
│   │
│   ├── alembic/
│   │   ├── env.py                  # Async Alembic env — imports Base from app.db.base
│   │   ├── script.py.mako          # Migration template
│   │   └── versions/               # [G] Auto-generated migration files
│   │       └── 001_initial.py      # [G] First migration from db-schema.sql
│   │
│   ├── app/
│   │   ├── main.py                 # FastAPI app factory: create_app(), lifespan, CORS, routers
│   │   ├── config.py               # Pydantic BaseSettings — reads .env, exposes typed config
│   │   ├── dependencies.py         # FastAPI dependency injectors: get_db(), get_current_user(), get_redis()
│   │   │
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # SQLAlchemy Base = DeclarativeBase(); imports all models for Alembic
│   │   │   ├── session.py          # async_engine, AsyncSessionLocal, get_db() generator
│   │   │   └── models/
│   │   │       ├── __init__.py     # Re-exports all models
│   │   │       ├── user.py         # User model (maps to users table)
│   │   │       ├── room.py         # Room model
│   │   │       ├── device.py       # Device model + enums (ProtocolType, ChipType, FirmwareType)
│   │   │       ├── device_state.py # DeviceState model (partitioned table)
│   │   │       ├── security_event.py # SecurityEvent model
│   │   │       ├── automation.py   # Automation model
│   │   │       ├── mqtt_message.py # MqttMessage model
│   │   │       └── firmware_update.py # FirmwareUpdate model
│   │   │
│   │   ├── schemas/                # Pydantic v2 request/response schemas
│   │   │   ├── __init__.py
│   │   │   ├── auth.py             # LoginRequest, TokenResponse, UserMe
│   │   │   ├── room.py             # Room, RoomCreate, RoomUpdate
│   │   │   ├── device.py           # Device, DeviceCreate, DeviceUpdate, DeviceState, DeviceCommand
│   │   │   ├── security.py         # SecurityEvent, SecurityStats, ResolveEventRequest
│   │   │   ├── automation.py       # Automation, AutomationCreate, AutomationUpdate, AutomationTestResult
│   │   │   ├── mqtt.py             # MqttMessage, MqttPublishRequest
│   │   │   ├── firmware.py         # FirmwareUpdateCandidate, FirmwareUpdateLog, FirmwareUpdateRecord
│   │   │   ├── dashboard.py        # DashboardSummary, NetworkMap, NetworkMapNode
│   │   │   └── websocket.py        # WebSocketEvent (discriminated union by type field)
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── routes/
│   │   │       ├── __init__.py
│   │   │       ├── auth.py         # POST /auth/login, /refresh, /logout; GET /auth/me
│   │   │       ├── devices.py      # CRUD /devices + /state, /history, /command
│   │   │       ├── rooms.py        # CRUD /rooms
│   │   │       ├── security.py     # GET /security/events, /events/{id}/resolve, /stats
│   │   │       ├── automations.py  # CRUD /automations + /toggle, /test
│   │   │       ├── mqtt.py         # GET /mqtt/messages, POST /mqtt/publish
│   │   │       ├── firmware.py     # GET /firmware/devices-needing-update, POST /{device_id}/log-update
│   │   │       ├── dashboard.py    # GET /dashboard/summary, /network-map
│   │   │       └── websocket.py    # WS /ws — connection manager, event dispatch
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py     # JWT encode/decode (python-jose), password hashing (passlib/bcrypt)
│   │   │   │                       #   create_access_token(), create_refresh_token(), verify_token()
│   │   │   ├── device_service.py   # DeviceService: list (join rooms, no N+1), get, create, update, delete
│   │   │   │                       #   resolve_device_from_topic(topic) → device_id cache
│   │   │   ├── room_service.py     # RoomService: CRUD + device counts via single aggregation query
│   │   │   ├── security_service.py # SecurityService: create_event(), resolve(), stats()
│   │   │   │                       #   inspect_mqtt_message() — passive anomaly detection
│   │   │   │                       #   poll_pihole() — async task polling Pi-hole API every 60s
│   │   │   ├── automation_service.py # AutomationService: CRUD, in-memory rule cache
│   │   │   │                         #   evaluate(device_id, topic, payload) — called from MQTT bridge
│   │   │   │                         #   execute_actions(actions, dry_run=False)
│   │   │   ├── firmware_service.py # FirmwareService: candidates_needing_update(), log_update()
│   │   │   │                       #   check_tasmota_latest(), check_esphome_latest() — GitHub API calls
│   │   │   ├── dashboard_service.py # DashboardService: summary() single aggregation, network_map()
│   │   │   └── mqtt_service.py     # MqttService: publish(topic, payload, qos, retain)
│   │   │                           #   Used by /mqtt/publish endpoint and automation action executor
│   │   │
│   │   ├── mqtt_bridge/
│   │   │   ├── __init__.py
│   │   │   ├── bridge.py           # MqttBridge: aiomqtt client, subscribe "#", async message loop
│   │   │   │                       #   on_message(): calls pipeline in order:
│   │   │   │                       #     1. persist to mqtt_messages (cap at 10k)
│   │   │   │                       #     2. update device last_seen / is_online
│   │   │   │                       #     3. snapshot device_states if state-bearing topic
│   │   │   │                       #     4. AutomationService.evaluate()
│   │   │   │                       #     5. SecurityService.inspect_mqtt_message()
│   │   │   │                       #     6. publish envelope to Redis channel "mqtt:events"
│   │   │   ├── topic_parser.py     # Tasmota/ESPHome topic pattern matching
│   │   │   │                       #   is_state_bearing(topic) → bool
│   │   │   │                       #   extract_device_state(topic, payload) → dict
│   │   │   │                       #   is_lwt_topic(topic) → (device_topic, online_status) | None
│   │   │   └── device_cache.py     # In-memory topic→device_id LRU cache (avoids DB lookup per message)
│   │   │                           #   invalidated on device create/update/delete
│   │   │
│   │   ├── websocket_manager/
│   │   │   ├── __init__.py
│   │   │   └── manager.py          # ConnectionManager:
│   │   │                           #   connect(ws, user_id) — add to pool
│   │   │                           #   disconnect(ws)
│   │   │                           #   broadcast(event: WebSocketEvent)
│   │   │                           #   subscribe_redis() — aioredis subscribe on "mqtt:events",
│   │   │                           #     "security:alerts", "automation:fired" channels
│   │   │                           #     loops forever, parses JSON, calls broadcast()
│   │   │                           #   _ping_loop() — sends ping every 30s, closes stale connections
│   │   │
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── pagination.py       # paginate(query, page, per_page) → (items, PaginatedMeta)
│   │       ├── pihole_client.py    # Async Pi-hole API client (httpx)
│   │       │                       #   get_recent_queries(minutes=1) → list of DNS queries
│   │       └── ha_client.py        # Async Home Assistant client (httpx)
│   │                               #   call_service(domain, service, entity_id, data)
│   │
│   └── tests/
│       ├── conftest.py             # pytest fixtures: async_client, test_db (SQLite in-memory), fake_redis
│       ├── test_auth.py            # Login flow, JWT expiry, refresh token rotation
│       ├── test_devices.py         # CRUD, command dispatch, state history with time range
│       ├── test_rooms.py           # CRUD, device count aggregation
│       ├── test_security.py        # Event creation, resolution, stats aggregation
│       ├── test_automations.py     # CRUD, toggle, dry-run test execution
│       ├── test_mqtt_bridge.py     # topic_parser unit tests, bridge message pipeline
│       ├── test_websocket.py       # WS connection, event broadcast, ping/pong
│       └── test_dashboard.py       # Summary single-query test (no N+1)
│
└── frontend/
    ├── Dockerfile                  # node:20-alpine, next build, next start :3000
    ├── Dockerfile.dev              # next dev with volume mount
    ├── package.json
    ├── package-lock.json           # [G]
    ├── next.config.ts              # rewrites API calls to backend, WebSocket proxy config
    ├── tailwind.config.ts          # shadcn/ui preset, custom colors (domatic brand)
    ├── tsconfig.json               # strict mode, path alias @/ → src/
    ├── postcss.config.js
    ├── components.json             # shadcn/ui config (style: default, rsc: true, tsx: true)
    ├── .env.local.example          # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL
    │
    └── src/
        │
        ├── app/                    # Next.js 14 App Router
        │   ├── layout.tsx          # Root layout: providers (QueryClient, WS, Auth), font, metadata
        │   ├── page.tsx            # Redirect → /dashboard
        │   ├── globals.css         # Tailwind directives + CSS variables (shadcn/ui theme tokens)
        │   │
        │   ├── (auth)/
        │   │   └── login/
        │   │       └── page.tsx    # Login form — POST /auth/login, stores token, redirects
        │   │
        │   └── (dashboard)/        # Route group: requires auth (middleware.ts enforces JWT)
        │       ├── layout.tsx      # Sidebar nav, header (online count badge, security alert badge)
        │       ├── dashboard/
        │       │   └── page.tsx    # Main dashboard: summary cards, room grid, recent alerts
        │       ├── devices/
        │       │   ├── page.tsx    # Device list table with filters (protocol, room, online status)
        │       │   ├── [id]/
        │       │   │   └── page.tsx # Device detail: state, history chart, command panel, firmware
        │       │   └── new/
        │       │       └── page.tsx # Add device form
        │       ├── rooms/
        │       │   └── page.tsx    # Room management: visual grid, device counts
        │       ├── security/
        │       │   └── page.tsx    # Security events table, stats bar, resolve modal
        │       ├── automations/
        │       │   ├── page.tsx    # Automation list with toggle switches
        │       │   └── [id]/
        │       │       └── page.tsx # Automation rule editor (trigger/condition/action JSON builder)
        │       ├── mqtt/
        │       │   └── page.tsx    # MQTT console: live message stream, topic filter, publish panel
        │       ├── firmware/
        │       │   └── page.tsx    # Firmware update candidates list, log update modal
        │       └── network/
        │           └── page.tsx    # Network map (react-flow based visual)
        │
        ├── components/
        │   ├── ui/                 # [G] shadcn/ui primitives (button, card, dialog, table, badge...)
        │   │   ├── button.tsx
        │   │   ├── card.tsx
        │   │   ├── dialog.tsx
        │   │   ├── table.tsx
        │   │   ├── badge.tsx
        │   │   ├── input.tsx
        │   │   ├── select.tsx
        │   │   ├── switch.tsx
        │   │   ├── toast.tsx
        │   │   ├── sonner.tsx
        │   │   └── ... (other shadcn primitives as needed)
        │   │
        │   ├── layout/
        │   │   ├── sidebar.tsx         # Nav sidebar with icon links to all routes
        │   │   ├── header.tsx          # Page header: title, online devices count, security badge
        │   │   └── providers.tsx       # Composes QueryClientProvider + WebSocketProvider + AuthProvider
        │   │
        │   ├── devices/
        │   │   ├── device-table.tsx    # Tanstack Table for device list with sorting/filtering
        │   │   ├── device-card.tsx     # Room grid card: online indicator, protocol icon, quick actions
        │   │   ├── device-state-card.tsx # Current state display (key-value from JSONB)
        │   │   ├── device-history-chart.tsx # Recharts line chart for numeric state values over time
        │   │   ├── device-command-panel.tsx # Power on/off/toggle/restart buttons + custom MQTT form
        │   │   ├── device-form.tsx     # Create/edit device form (react-hook-form + zod)
        │   │   └── protocol-badge.tsx  # Colored badge: WiFi/Zigbee/Z-Wave/BLE/Matter
        │   │
        │   ├── security/
        │   │   ├── security-event-table.tsx # Events table with severity color coding
        │   │   ├── security-stats-bar.tsx   # Summary bar: open/critical/high counts
        │   │   └── resolve-event-dialog.tsx # Confirmation dialog with resolution note field
        │   │
        │   ├── automations/
        │   │   ├── automation-list.tsx       # List with enabled toggle + last triggered time
        │   │   ├── automation-rule-editor.tsx # JSONB trigger/condition/action structured editor
        │   │   └── automation-test-dialog.tsx # Dry-run result display
        │   │
        │   ├── mqtt/
        │   │   ├── mqtt-message-feed.tsx     # Virtualized real-time message list (react-window)
        │   │   ├── mqtt-publish-form.tsx     # Topic/payload/QoS/retain form
        │   │   └── mqtt-topic-filter.tsx     # Topic filter input with wildcard hint
        │   │
        │   ├── firmware/
        │   │   ├── firmware-candidate-table.tsx # Devices needing update with version diff
        │   │   └── log-update-dialog.tsx        # Form to log a firmware flash operation
        │   │
        │   ├── dashboard/
        │   │   ├── summary-cards.tsx     # 4 stat cards: total/online/cloud/alerts
        │   │   ├── room-grid.tsx         # Rooms as cards with mini device status
        │   │   └── recent-alerts.tsx     # Last 5 security events feed
        │   │
        │   └── network/
        │       └── network-map.tsx       # react-flow canvas: nodes=devices, groups=rooms/VLANs
        │                                 # Color coding: online=green, offline=grey, blocked=red
        │
        ├── hooks/
        │   ├── use-websocket.ts          # WebSocket context consumer — returns latest event by type
        │   ├── use-devices.ts            # React Query hooks: useDevices, useDevice, useDeviceState
        │   │                             #   invalidates on WS device_state / device_online / device_offline events
        │   ├── use-rooms.ts              # useRooms, useRoom (with devices)
        │   ├── use-security.ts           # useSecurityEvents, useSecurityStats, useResolveEvent
        │   ├── use-automations.ts        # useAutomations, useToggleAutomation, useTestAutomation
        │   ├── use-mqtt.ts               # useMqttMessages (with topic filter), useMqttPublish
        │   ├── use-firmware.ts           # useFirmwareCandidates, useLogFirmwareUpdate
        │   ├── use-dashboard.ts          # useDashboardSummary, useNetworkMap
        │   └── use-auth.ts              # useAuth: login(), logout(), currentUser, isAuthenticated
        │
        ├── lib/
        │   ├── api-client.ts             # Axios instance: baseURL, Bearer header injection,
        │   │                             #   401 interceptor → auto-refresh via /auth/refresh
        │   ├── websocket-context.tsx     # React Context + Provider: single shared WS connection,
        │   │                             #   reconnect with exponential backoff (1s→30s),
        │   │                             #   event dispatch to subscribed handlers,
        │   │                             #   ping/pong keepalive
        │   ├── auth-context.tsx          # React Context + Provider: JWT storage (memory),
        │   │                             #   login/logout/refresh, persist refresh token via cookie
        │   ├── query-client.ts           # TanStack Query client config: staleTime, retry policy
        │   ├── utils.ts                  # cn() (clsx + tailwind-merge), formatRelativeTime(),
        │   │                             #   formatBytes(), truncateTopic()
        │   └── constants.ts              # PROTOCOL_ICONS, CHIP_LABELS, SEVERITY_COLORS,
        │                                 # FIRMWARE_LABELS, EVENT_TYPE_LABELS
        │
        └── types/
            ├── api.ts                    # TypeScript interfaces mirroring OpenAPI schemas
            │                             #   Device, Room, SecurityEvent, Automation, MqttMessage,
            │                             #   FirmwareUpdate, DashboardSummary, NetworkMap, etc.
            ├── websocket.ts              # WebSocketEvent discriminated union type
            └── enums.ts                  # ProtocolType, ChipType, FirmwareType,
                                          # SecuritySeverity, FirmwareUpdateStatus as const enums
```

---

## Backend requirements.txt (pinned versions)

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
pydantic==2.9.2
pydantic-settings==2.5.2
sqlalchemy==2.0.35
asyncpg==0.29.0
alembic==1.13.3
aiomqtt==2.3.0
redis==5.1.1
aioredis==2.0.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
httpx==0.27.2
python-multipart==0.0.12
```

---

## Frontend package.json (key dependencies)

```json
{
  "dependencies": {
    "next": "14.2.15",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "typescript": "^5.6.3",
    "@tanstack/react-query": "^5.59.0",
    "axios": "^1.7.7",
    "zustand": "^5.0.0",
    "react-hook-form": "^7.53.0",
    "zod": "^3.23.8",
    "@hookform/resolvers": "^3.9.0",
    "recharts": "^2.13.0",
    "reactflow": "^11.11.4",
    "react-window": "^1.8.10",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.3",
    "date-fns": "^4.1.0",
    "sonner": "^1.5.0",
    "lucide-react": "^0.451.0",
    "tailwindcss": "^3.4.13",
    "@tailwindcss/typography": "^0.5.15"
  },
  "devDependencies": {
    "@types/react": "^18.3.11",
    "@types/node": "^22.7.5",
    "eslint": "^8.57.1",
    "eslint-config-next": "14.2.15"
  }
}
```

---

## docker-compose.yml Service Summary

| Service | Image | Port | Notes |
|---|---|---|---|
| `postgres` | postgres:15-alpine | 5432 | Volume: `pg_data`, health check |
| `redis` | redis:7-alpine | 6379 | Volume: `redis_data`, appendonly yes |
| `mosquitto` | eclipse-mosquitto:2 | 1883 | Bind-mount: `./mosquitto/mosquitto.conf` |
| `backend` | `./backend/Dockerfile` | 8000 | Depends: postgres, redis, mosquitto; reads `.env` |
| `frontend` | `./frontend/Dockerfile` | 3000 | Depends: backend; `NEXT_PUBLIC_API_URL=http://backend:8000` |

---

## Implementation Agent Notes

### Order of Implementation

1. `backend/app/db/` — models + session first (Alembic needs them)
2. `backend/alembic/` — run `alembic revision --autogenerate` after models
3. `backend/app/schemas/` — Pydantic schemas (mirrors OpenAPI contracts)
4. `backend/app/services/` — business logic layer (no FastAPI imports)
5. `backend/app/mqtt_bridge/` — bridge + topic parser (critical path)
6. `backend/app/websocket_manager/` — connection pool + Redis subscriber
7. `backend/app/api/routes/` — thin route handlers calling services
8. `backend/app/main.py` — wire everything together, lifespan events
9. `frontend/src/types/` — TypeScript types from OpenAPI spec
10. `frontend/src/lib/` — API client + WS context + auth context
11. `frontend/src/hooks/` — React Query hooks
12. `frontend/src/components/` — UI components per feature
13. `frontend/src/app/` — Pages composing components + hooks

### Critical Constraints

- **MQTT bridge** runs as an `asyncio.Task` started in FastAPI `lifespan` context manager — not a separate process. It must never block the event loop; all DB writes are `await`-ed.
- **device_states queries** MUST always include a `recorded_at` range predicate — the query planner cannot prune partitions without it. Enforce this in `DeviceService` by making `from_date` a required parameter (default = last 24h, not omittable).
- **mqtt_messages cap** enforced by the bridge: after each insert, check `SELECT COUNT(*) FROM mqtt_messages` — if > 10000, run `DELETE FROM mqtt_messages WHERE id IN (SELECT id FROM mqtt_messages ORDER BY id ASC LIMIT 500)`.
- **No N+1 anywhere** — all list endpoints use SQLAlchemy `selectinload` or explicit JOIN. The ESLint-equivalent for the backend is a `mypy` + SQLAlchemy typing check.
- **WebSocket auth** — validate JWT on handshake in `websocket.py` route before adding to ConnectionManager pool. Use `WebSocket.close(code=4001)` for auth failure.
- **AutomationEngine** — in-memory cache of all `enabled=True` automations; invalidate cache on any automation create/update/delete/toggle API call.
