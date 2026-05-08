.PHONY: up down build logs logs-backend logs-frontend ps setup setup-passwords health seed migrate shell-db shell-backend

# Default target
.DEFAULT_GOAL := help

# ---------------------------------------------------------------------------
# Help — auto-generated from ## comments
# ---------------------------------------------------------------------------
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' | sort

# ---------------------------------------------------------------------------
# Docker Compose operations
# ---------------------------------------------------------------------------
up: ## Start all services
	docker-compose up -d

down: ## Stop all services
	docker-compose down

build: ## Build Docker images
	docker-compose build

logs: ## Show all logs (follow)
	docker-compose logs -f

logs-backend: ## Backend logs
	docker-compose logs -f backend

logs-frontend: ## Frontend logs
	docker-compose logs -f frontend

ps: ## Container status
	docker-compose ps

# ---------------------------------------------------------------------------
# First-time setup
# ---------------------------------------------------------------------------
setup: ## First-time setup: copy .env, generate SECRET_KEY
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env from .env.example"; \
	else \
		echo ".env already exists — skipping copy"; \
	fi
	@SECRET=$$(openssl rand -hex 32); \
	sed -i "s/change_me_64_char_hex_string/$$SECRET/" .env; \
	echo "SECRET_KEY generated and written to .env"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Edit .env and set POSTGRES_PASSWORD and MQTT_PASSWORD"
	@echo "  2. Run: make setup-passwords"
	@echo "  3. Run: make up"

setup-passwords: ## Interactive: set MQTT + DB passwords
	@echo "=== Dom'Atic Password Setup ==="
	@echo ""
	@read -p "Enter PostgreSQL password: " pg_pass; \
	sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$$pg_pass/" .env; \
	echo "PostgreSQL password updated in .env"
	@echo ""
	@echo "Generating Mosquitto password file..."
	@read -p "Enter MQTT password for user 'domatic': " mqtt_pass; \
	sed -i "s/^MQTT_PASSWORD=.*/MQTT_PASSWORD=$$mqtt_pass/" .env; \
	docker-compose run --rm mosquitto mosquitto_passwd -b /mosquitto/config/passwd domatic "$$mqtt_pass" 2>/dev/null || \
		docker run --rm -v $$(pwd)/mosquitto/config:/mosquitto/config eclipse-mosquitto:2.0 \
			mosquitto_passwd -b /mosquitto/config/passwd domatic "$$mqtt_pass"; \
	echo "Mosquitto password file updated"
	@echo ""
	@echo "Setup complete. Run: make up"

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
health: ## Health check all services
	@echo "=== Service Health ==="
	@docker-compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "=== Backend API ==="
	@curl -sf http://localhost:8000/health && echo " OK" || echo " FAILED (is backend running?)"
	@echo ""
	@echo "=== PostgreSQL ==="
	@docker-compose exec postgres pg_isready -U domatic && echo "OK" || echo "FAILED"
	@echo ""
	@echo "=== Redis ==="
	@docker-compose exec redis redis-cli ping || echo "FAILED"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
migrate: ## Run Alembic migrations
	docker-compose exec backend alembic upgrade head

seed: ## Run database seeds
	docker-compose exec postgres psql -U domatic -d domatic -f /dev/stdin < db/seeds/001_rooms.sql
	docker-compose exec postgres psql -U domatic -d domatic -f /dev/stdin < db/seeds/002_demo_devices.sql
	@echo "Seeds applied"

shell-db: ## PostgreSQL interactive shell
	docker-compose exec postgres psql -U domatic -d domatic

shell-backend: ## Backend container shell
	docker-compose exec backend /bin/bash
