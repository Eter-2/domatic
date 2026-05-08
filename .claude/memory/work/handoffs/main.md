# Handoff: Dom'Atic v0.1.0

**Último autor:** SoftwareFactory (Luís / Vera)
**Data:** 2026-05-08
**Branch:** main

---

## O que foi feito

Implementação completa do Dom'Atic do zero via SoftwareFactory em 7 fases autónomas. Hub web local para gestão centralizada de dispositivos IoT heterogéneos — substitui firmware Tuya/duvidoso por Tasmota/ESPHome, corre 100% offline, isola dispositivos em VLAN segura.

**Stack:** FastAPI + SQLAlchemy 2.0 + aiomqtt + Next.js 14 + PostgreSQL 15 + Redis + Mosquitto MQTT  
**Resultado:** 132 ficheiros, 14.052 linhas, 80 testes (71% coverage), OWASP auditado, 5 containers Docker running.

---

## Arquitetura

```
Browser (Next.js :3002)
  ↕ HTTP REST + WebSocket
FastAPI (:8001)
  ↕ aiomqtt bridge
Mosquitto (:1883)
  ↕ MQTT subscribe all
Dispositivos IoT (Tasmota/ESPHome/Zigbee2MQTT)

FastAPI → Redis pub/sub → WebSocket Manager → Browser (real-time)
```

**Portas locais (dev):**
- Frontend: http://localhost:3002
- Backend API: http://localhost:8001
- Swagger: http://localhost:8001/api/v1/docs
- MQTT: localhost:1883
- PostgreSQL: localhost:5432 (interno Docker)
- Redis: localhost:6380 (Dom'Atic), localhost:6379 (outro serviço no host)

---

## Onde parou

Projeto em estado **v0.1.0 funcional**. Todos os 5 containers a correr. Ainda não foi criada a conta admin (primeiro acesso em `/setup`). Mosquitto não tem password configurada ainda (placeholder no `passwd` file).

**Ficheiro de estado crítico:** `.env` — já gerado com `SECRET_KEY` real, não commitar.

---

## Próximos passos

### Imediatos (antes de usar em produção)
1. **Configurar Mosquitto password:**
   ```bash
   docker compose exec mosquitto mosquitto_passwd -c /mosquitto/config/passwd domatic
   # Introduzir password; actualizar MQTT_PASSWORD em .env
   docker compose restart mosquitto backend
   ```

2. **Criar conta admin (primeiro acesso):**
   - Aceder a http://localhost:3002/setup
   - Criar utilizador admin

3. **Adicionar primeiro dispositivo real:**
   - Registar em `/devices` com o MQTT topic correcto (ex: `tele/sonoff-01/#`)
   - Verificar que mensagens aparecem na MQTT Console

### Sprint 2 — Melhorias planeadas
- [ ] **Logout token blacklist** (Redis SET com TTL) — actualmente tokens são válidos até expirar após logout
- [ ] **Failed-login → security_events** — brute force não é persistido na DB
- [ ] **PostgreSQL/Redis ports** → bind a `127.0.0.1` em produção (actualmente `0.0.0.0`)
- [ ] **Auto-discovery Tasmota** — via `tele/+/INFO1` LWT topics (detectar novos dispositivos automaticamente)
- [ ] **Auto-discovery ESPHome** — via `esphome/+/status`
- [ ] **Frigate integration** — câmeras com deteção IA local
- [ ] **Upgrade `python-jose`** → `PyJWT` (CVE-2024-33664, mitigado mas não resolvido)
- [ ] **Testes E2E** — Playwright para o frontend
- [ ] **Mobile app** — React Native ou PWA

### Sprint 3 — Deploy VPS
- [ ] Configurar subdomínio `domatic.etergrowth.com`
- [ ] Certbot SSL
- [ ] Tailscale para acesso externo seguro
- [ ] Backup automático PostgreSQL → NAS

---

## Bloqueios

Nenhum bloqueio crítico.

- Mosquitto MQTT bridge reporta `mqtt_connected: false` no health endpoint porque o `passwd` file ainda é placeholder (sem password real). Backend arranca na mesma — MQTT é opcional até ser configurado.
- `next/14.2.3` tem vulnerability conhecida — upgrade para latest Next.js 15 recomendado antes de produção pública.

---

## Ficheiros principais

```
domAtic/
├── .env                              ← NUNCA commitar — contém SECRET_KEY real
├── .env.example                      ← Template para novos deployments
├── docker-compose.yml                ← 5 serviços (backend:8001, frontend:3002)
├── Makefile                          ← Comandos: make up/down/logs/health/seed
├── backend/
│   ├── app/main.py                   ← Entry point FastAPI + lifespan MQTT/WS
│   ├── app/mqtt_bridge.py            ← Bridge aiomqtt → Redis pub/sub
│   ├── app/websocket_manager.py      ← WebSocket fanout + Redis subscriber
│   ├── app/services/
│   │   ├── automation_service.py     ← Motor automações (wildcard MQTT)
│   │   └── security_service.py       ← Monitor segurança + Pi-hole polling
│   ├── app/api/routes/               ← 9 ficheiros de rotas (36 endpoints)
│   ├── app/db/models.py              ← 8 modelos ORM SQLAlchemy
│   └── tests/                        ← 80 testes, 71% coverage
├── frontend/
│   ├── src/app/(dashboard)/          ← 9 páginas autenticadas
│   ├── src/hooks/useWebSocket.ts     ← Singleton WS + reconnect exponencial
│   ├── src/lib/store.ts              ← Zustand store (WS state, alerts)
│   └── src/lib/api.ts                ← Axios client com refresh interceptor
├── mosquitto/config/
│   ├── mosquitto.conf                ← Config MQTT broker
│   └── passwd                        ← PLACEHOLDER — precisa de password real
└── db/
    ├── migrations/                   ← 2 ficheiros SQL (schema + views)
    └── seeds/                        ← 10 rooms + 5 demo devices
```

---

## Comandos úteis

```bash
# Arrancar tudo
cd ~/projects/domAtic
docker compose up -d

# Ver logs do backend
docker compose logs -f backend

# Correr testes
cd backend && python -m pytest tests/ -v

# Aceder à DB
docker compose exec postgres psql -U domatic -d domatic

# Publicar mensagem MQTT de teste
docker compose exec mosquitto mosquitto_pub -h localhost -t "tele/test-device/POWER" -m "ON" -u domatic -P <password>

# Verificar saúde
curl http://localhost:8001/health
```

---

## Como continuar

```bash
git clone git@github.com:Eter-2/domatic.git
cd domatic
cp .env.example .env
# Editar .env com passwords reais
make setup-passwords
make up
# Aceder a http://localhost:3002/setup
```

Qualquer membro pode continuar com: `git pull && /continuar ~/projects/domAtic`
