DEPLOYMENTS_DIR=deployments
DEV_FILE=$(DEPLOYMENTS_DIR)/docker-compose.dev.yml
PROD_FILE=$(DEPLOYMENTS_DIR)/docker-compose.yml
PROD_BUILD_FILE=$(DEPLOYMENTS_DIR)/docker-compose.build.yml
ENV_FILE=$(DEPLOYMENTS_DIR)/.env
ENV_EXAMPLE_FILE=$(DEPLOYMENTS_DIR)/.env.example

COMPOSE_PROD=docker compose --env-file $(ENV_FILE) -f $(PROD_FILE)
COMPOSE_PROD_BUILD=docker compose --env-file $(ENV_FILE) -f $(PROD_FILE) -f $(PROD_BUILD_FILE)
COMPOSE_EXAMPLE=docker compose --env-file $(ENV_EXAMPLE_FILE)

BACKEND_DIR=backend
WEB_DIR=clients/web

.PHONY: help
help:
	@echo "Household targets"
	@echo ""
	@echo "Setup:"
	@echo "  make setup-env              Copy deployments/.env.example to deployments/.env if missing"
	@echo "  make bootstrap              Restore .NET and web dependencies"
	@echo "  make doctor                 Check required local tools"
	@echo ""
	@echo "Development:"
	@echo "  make dev                    Start this worktree in Docker and watch source changes"
	@echo "  make dev-info               Show this worktree URL and services"
	@echo "  make dev-down               Stop this worktree, keep its data"
	@echo "  make dev-logs               Follow this worktree logs"
	@echo "  make db-up                  Start local dev Postgres in Docker"
	@echo "  make db-down                Stop local dev Postgres"
	@echo "  make db-logs                Follow local dev Postgres logs"
	@echo "  make api-dev                Deprecated: use make dev"
	@echo "  make web-dev                Deprecated: use make dev"
	@echo "  make reset-dev-db           Remove the dev Postgres volume"
	@echo "  make seed-dev BACKUP=path   Restore a Postgres dump into this worktree database"
	@echo ""
	@echo "Quality:"
	@echo "  make check                  Run backend, web, and Compose checks"
	@echo "  make backend-test           Run .NET tests"
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
	@echo "  make create-migration feature=<identity|budget|audit> name=<migration_name>"

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
	@echo ">> Restoring backend dependencies"
	@cd $(BACKEND_DIR) && dotnet restore Household.slnx
	@echo ">> Installing web dependencies"
	@cd $(WEB_DIR) && npm ci

doctor:
	@missing=0; \
	for cmd in dotnet node npm docker; do \
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
	@echo ">> Testing $(BACKEND_DIR) against PostgreSQL"
	@cd $(BACKEND_DIR) && dotnet test Household.slnx --configuration Release

backend-build:
	@echo ">> Building household-api and household-updater"
	@cd $(BACKEND_DIR) && dotnet build Household.slnx --configuration Release

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
	@docker compose --env-file $(DEPLOYMENTS_DIR)/dev.env -f $(DEV_FILE) config --quiet

# Development commands share one implementation with make.ps1.
.PHONY: dev dev-info dev-project dev-down dev-logs db-up db-down db-logs reset-dev-db api-dev web-dev logs observability-up observability-down observability-logs core-up core-down
dev dev-info dev-project dev-down dev-logs db-up db-down db-logs reset-dev-db api-dev web-dev logs observability-up observability-down observability-logs:
	@sh scripts/dev.sh $@

.PHONY: seed-dev
seed-dev:
	@if [ -z "$(BACKUP)" ]; then \
		echo "Please add BACKUP=path (a dump from make prod-backup)"; exit 1; \
	fi
	@sh scripts/dev.sh seed-dev "$(BACKUP)"
core-up: db-up
core-down: dev-down

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
	@case "$(feature)" in \
		identity) context=IdentityDbContext ;; \
		budget) context=BudgetDbContext ;; \
		audit) context=AuditDbContext ;; \
		*) echo "Unknown feature: $(feature)"; exit 1 ;; \
	esac; \
	if ! command -v dotnet-ef >/dev/null 2>&1; then \
		echo "dotnet-ef not found, installing..."; \
		dotnet tool install --global dotnet-ef --version 10.0.10; \
	fi; \
	cd $(BACKEND_DIR) && dotnet ef migrations add "$(name)" \
		--project src/Household.Api/Household.Api.csproj \
		--context "$$context" \
		--output-dir "Features/$(feature)/Migrations"
