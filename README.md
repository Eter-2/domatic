# Dom'Atic

Dom'Atic is a local IoT home automation hub that runs entirely on your network — no cloud required. It discovers, monitors, and secures your smart home devices via MQTT, tracks firmware versions, and detects cloud-calling behaviour.

## Quick Start

```bash
cp .env.example .env
make setup        # generates SECRET_KEY, prompts for passwords
make up           # starts all services
```

Open http://localhost:3000 — the first run redirects to `/setup` to create your admin account.

## Access

| Service    | URL                        | Notes                          |
|------------|----------------------------|--------------------------------|
| Frontend   | http://localhost:3000      | Next.js dashboard              |
| API        | http://localhost:8000      | FastAPI + auto-docs at /docs   |
| PostgreSQL | localhost:5432             | DB: `domatic`, user: `domatic` |
| Redis      | localhost:6379             |                                |
| MQTT       | localhost:1883             | TCP                            |
| MQTT WS    | ws://localhost:9001        | WebSocket (browser clients)    |

## Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | Next.js 14, TypeScript, Tailwind CSS|
| Backend    | FastAPI, SQLAlchemy 2.0 async       |
| Database   | PostgreSQL 15 (partitioned tables)  |
| Cache      | Redis 7                             |
| MQTT       | Eclipse Mosquitto 2.0               |
| Migrations | Alembic (async, asyncpg driver)     |

## Makefile Reference

| Command              | Description                              |
|----------------------|------------------------------------------|
| `make up`            | Start all services                       |
| `make down`          | Stop all services                        |
| `make build`         | Build Docker images                      |
| `make logs`          | Stream all logs                          |
| `make logs-backend`  | Stream backend logs only                 |
| `make logs-frontend` | Stream frontend logs only                |
| `make ps`            | Container status overview                |
| `make setup`         | First-time setup (copy .env, gen keys)   |
| `make setup-passwords` | Set MQTT + DB passwords interactively  |
| `make health`        | Health check all services                |
| `make migrate`       | Run Alembic database migrations          |
| `make seed`          | Load default rooms + demo devices        |
| `make shell-db`      | Open PostgreSQL interactive shell        |
| `make shell-backend` | Open backend container shell             |
