DEPLOYMENTS_DIR=deployments
DEV_FILE=$(DEPLOYMENTS_DIR)/docker-compose.dev.yml
PROD_FILE=$(DEPLOYMENTS_DIR)/docker-compose.yml
PROD_BUILD_FILE=$(DEPLOYMENTS_DIR)/docker-compose.build.yml
ENV_FILE=$(DEPLOYMENTS_DIR)/.env
ENV_EXAMPLE_FILE=$(DEPLOYMENTS_DIR)/.env.example

COMPOSE_DEV=docker compose --env-file $(ENV_FILE) -f $(DEV_FILE)
COMPOSE_PROD=docker compose --env-file $(ENV_FILE) -f $(PROD_FILE)
COMPOSE_PROD_BUILD=docker compose --env-file $(ENV_FILE) -f $(PROD_FILE) -f $(PROD_BUILD_FILE)
COMPOSE_EXAMPLE=docker compose --env-file $(ENV_EXAMPLE_FILE)

BACKEND_DIR=backend
WEB_DIR=clients/web
BUILD_DIR=/private/tmp/household-build

.PHONY: help
help:
	@echo "Household targets"
	@echo ""
	@echo "Setup:"
	@echo "  make setup-env              Copy deployments/.env.example to deployments/.env if missing"
	@echo "  make bootstrap              Download Go modules and install web dependencies"
	@echo "  make doctor                 Check required local tools"
	@echo ""
	@echo "Development:"
	@echo "  make dev                    Start dev DB, local API, and local web app"
	@echo "  make db-up                  Start local dev Postgres in Docker"
	@echo "  make db-down                Stop local dev Postgres"
	@echo "  make db-logs                Follow local dev Postgres logs"
	@echo "  make api-dev                Start local API with Air if installed, otherwise go run"
	@echo "  make web-dev                Start Next.js web dev server"
	@echo "  make reset-dev-db           Remove the dev Postgres volume"
	@echo ""
	@echo "Quality:"
	@echo "  make check                  Run backend, web, and Compose checks"
	@echo "  make backend-test           Run Go tests"
	@echo "  make backend-build          Build API and updater binaries"
	@echo "  make web-lint               Lint web app"
	@echo "  make web-build              Build web app"
	@echo "  make compose-config         Validate Compose configuration"
	@echo ""
	@echo "Production:"
	@echo "  make prod-pull              Pull published production images"
	@echo "  make prod-up                Start production stack from published images"
	@echo "  make prod-build-up          Build production images from source and start stack"
	@echo "  make prod-down              Stop production stack"
	@echo "  make prod-logs              Follow production API logs"
	@echo "  make prod-backup            Create a Postgres backup in deployments/backups"
	@echo "  make prod-restore BACKUP=path  Restore a Postgres backup"
	@echo "  make prod-observability-up  Start production Grafana, Loki, and Alloy"
	@echo ""
	@echo "Other:"
	@echo "  make observability-up       Start dev Grafana, Loki, and Alloy"
	@echo "  make observability-down     Stop dev observability stack"
	@echo "  make observability-logs     Follow dev observability logs"
	@echo "  make create-migration feature=<name> name=<migration_name>"

# ----------------------
# SETUP
# ----------------------
.PHONY: setup-env bootstrap doctor require-env validate-prod-env
setup-env:
	@if [ ! -f "$(ENV_FILE)" ]; then \
		cp "$(ENV_EXAMPLE_FILE)" "$(ENV_FILE)"; \
		echo "Created $(ENV_FILE). Edit it before production use."; \
	else \
		echo "$(ENV_FILE) already exists."; \
	fi

bootstrap: setup-env
	@echo ">> Downloading backend dependencies"
	@cd $(BACKEND_DIR) && go mod download
	@echo ">> Installing web dependencies"
	@cd $(WEB_DIR) && npm ci

doctor:
	@missing=0; \
	for cmd in go node npm docker; do \
		if ! command -v "$$cmd" >/dev/null 2>&1; then \
			echo "Missing required tool: $$cmd"; \
			missing=1; \
		fi; \
	done; \
	if ! docker compose version >/dev/null 2>&1; then \
		echo "Missing Docker Compose plugin: docker compose"; \
		missing=1; \
	fi; \
	if [ "$$missing" -ne 0 ]; then \
		exit 1; \
	fi; \
	echo "All required tools are available."

require-env:
	@if [ ! -f "$(ENV_FILE)" ]; then \
		echo "$(ENV_FILE) is missing. Run: make setup-env"; \
		exit 1; \
	fi

validate-prod-env: require-env
	@if grep -Eq '^[A-Z0-9_]+=.*change-me' "$(ENV_FILE)"; then \
		echo "$(ENV_FILE) still contains change-me placeholder values."; \
		exit 1; \
	fi

# ----------------------
# QUALITY
# ----------------------
.PHONY: check test build backend-test backend-build web-build web-lint compose-config
check: backend-test backend-build web-lint web-build compose-config

test: backend-test

build: backend-build

backend-test:
	@echo ">> Testing $(BACKEND_DIR)"
	@cd $(BACKEND_DIR) && go test ./...

backend-build:
	@mkdir -p $(BUILD_DIR)
	@echo ">> Building household-api and household-updater"
	@cd $(BACKEND_DIR) && go build -o $(BUILD_DIR)/household-api ./cmd/household-api && go build -o $(BUILD_DIR)/household-updater ./cmd/household-updater

web-build:
	@echo ">> Building web"
	@cd $(WEB_DIR) && npm run build

web-lint:
	@echo ">> Linting web"
	@cd $(WEB_DIR) && npm run lint

compose-config:
	@echo ">> Validating production Compose"
	@$(COMPOSE_EXAMPLE) -f $(PROD_FILE) config --quiet
	@echo ">> Validating production source-build Compose"
	@$(COMPOSE_EXAMPLE) -f $(PROD_FILE) -f $(PROD_BUILD_FILE) config --quiet
	@echo ">> Validating development Compose"
	@$(COMPOSE_EXAMPLE) -f $(DEV_FILE) config --quiet

# ----------------------
# DEV DATABASE
# ----------------------
.PHONY: db-up db-down db-logs core-up core-down
db-up: setup-env
	@echo ">> Starting local dev Postgres..."
	@$(COMPOSE_DEV) --profile db up -d household-db

db-down:
	@$(COMPOSE_DEV) --profile db down --remove-orphans

db-logs:
	@$(COMPOSE_DEV) logs -f household-db

core-up: db-up
core-down: db-down

.PHONY: api-dev logs dev-down reset-dev-db
api-dev:
	@echo ">> Starting local API..."
	@set -a; \
	if [ -f "$(ENV_FILE)" ]; then . "$(ENV_FILE)"; fi; \
	set +a; \
	export HOUSEHOLD_API_DB_HOST=localhost; \
	export HOUSEHOLD_API_DB_PORT=$${HOUSEHOLD_DB_PORT:-5432}; \
	export HOUSEHOLD_API_DB_DATABASE=$${HOUSEHOLD_DB_DATABASE:-household}; \
	export HOUSEHOLD_API_DB_USER=$${HOUSEHOLD_DB_USER:-household}; \
	export HOUSEHOLD_API_DB_PASSWORD=$${HOUSEHOLD_DB_PASSWORD:-household}; \
	export HOUSEHOLD_API_SERVER_PORT=$${HOUSEHOLD_API_SERVER_PORT:-8090}; \
	export HOUSEHOLD_API_SERVER_TIMEOUT_READ=$${HOUSEHOLD_API_SERVER_TIMEOUT_READ:-5s}; \
	export HOUSEHOLD_API_SERVER_TIMEOUT_WRITE=$${HOUSEHOLD_API_SERVER_TIMEOUT_WRITE:-10s}; \
	export HOUSEHOLD_API_SERVER_TIMEOUT_IDLE=$${HOUSEHOLD_API_SERVER_TIMEOUT_IDLE:-60s}; \
	export HOUSEHOLD_LOG_LEVEL=$${HOUSEHOLD_LOG_LEVEL:-debug}; \
	export HOUSEHOLD_LOG_ENVIRONMENT=dev; \
	export HOUSEHOLD_LOG_VERSION=dev; \
	export HOUSEHOLD_UPDATES_GITHUB_REPOSITORY=$${HOUSEHOLD_UPDATES_GITHUB_REPOSITORY:-kratofl/household}; \
	export HOUSEHOLD_SEED_DEMO_USER=true; \
	export HOUSEHOLD_SEED_DEMO_USER_NAME=$${HOUSEHOLD_SEED_DEMO_USER_NAME:-admin}; \
	export HOUSEHOLD_SEED_DEMO_USER_EMAIL=$${HOUSEHOLD_SEED_DEMO_USER_EMAIL:-admin@household.local}; \
	export HOUSEHOLD_SEED_DEMO_USER_PASSWORD=$${HOUSEHOLD_DEV_SEED_DEMO_USER_PASSWORD:-admin}; \
	cd $(BACKEND_DIR); \
	if command -v air >/dev/null 2>&1; then air -c .air.toml; else go run ./cmd/household-api; fi

logs: db-logs

dev-down:
	@$(MAKE) db-down

reset-dev-db: setup-env
	@$(COMPOSE_DEV) --profile db down -v --remove-orphans

# ----------------------
# PRODUCTION
# ----------------------
.PHONY: prod-pull prod-up prod-build-up prod-down prod-logs prod-observability-up prod-backup prod-restore
prod-pull: validate-prod-env
	@$(COMPOSE_PROD) pull

prod-up: validate-prod-env
	@$(COMPOSE_PROD) up -d

prod-build-up: validate-prod-env
	@$(COMPOSE_PROD_BUILD) up -d --build

prod-down: require-env
	@$(COMPOSE_PROD) down

prod-logs: require-env
	@$(COMPOSE_PROD) logs -f household-api

prod-observability-up: validate-prod-env
	@$(COMPOSE_PROD) --profile observability up -d

prod-backup: validate-prod-env
	@mkdir -p $(DEPLOYMENTS_DIR)/backups
	@backup="$(DEPLOYMENTS_DIR)/backups/household-$$(date -u +%Y%m%d%H%M%S).dump"; \
	echo ">> Writing $$backup"; \
	$(COMPOSE_PROD) exec -T household-db sh -c 'pg_dump -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -Fc' > "$$backup"

prod-restore: validate-prod-env
	@if [ -z "$(BACKUP)" ]; then \
		echo "Please add BACKUP=path"; exit 1; \
	fi
	@$(COMPOSE_PROD) exec -T household-db sh -c 'pg_restore -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" --clean --if-exists' < "$(BACKUP)"

# ----------------------
# OBSERVABILITY
# ----------------------
.PHONY: observability-up observability-down observability-logs
observability-up: setup-env
	@echo ">> Starting observability stack..."
	@$(COMPOSE_DEV) --profile observability up -d

observability-down:
	@$(COMPOSE_DEV) stop grafana alloy loki

observability-logs:
	@$(COMPOSE_DEV) logs -f grafana alloy loki

# ----------------------
# WEB
# ----------------------
.PHONY: web-dev
web-dev:
	@echo ">> Starting Next.js web dev server..."
	@cd $(WEB_DIR) && npm run dev

# ----------------------
# ONE-SHOT DEV (DB + local monolith API + Web)
# ----------------------
.PHONY: dev
dev:
	@$(MAKE) db-up
	@$(MAKE) -j2 api-dev web-dev

# ----------------------
# MIGRATIONS
# ----------------------
.PHONY: create-migration
create-migration:
	@if [ -z "$(feature)" ]; then \
		echo "Please add feature (e.g. feature=budget)"; exit 1; \
	fi
	@if [ -z "$(name)" ]; then \
		echo "Please add name: make create-migration feature=budget name=add_accounts"; exit 1; \
	fi
	@if ! command -v migrate >/dev/null 2>&1; then \
		echo "golang-migrate CLI not found, installing..."; \
		go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest; \
	fi
	@migrate create -ext sql -dir "$(BACKEND_DIR)/internal/features/$(feature)/migrations" -format "20060102150405" $(name)
