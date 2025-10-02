DEPLOYMENTS_DIR=deployments
DEV_DIR=$(DEPLOYMENTS_DIR)/dev
INFRA_FILE=$(DEV_DIR)/infra-compose.yml
ENV_FILE=$(DEPLOYMENTS_DIR)/.env
ENV_FILE_DEV=$(DEV_DIR)/.env.dev

CORE_PROFILES=core identity
GO_SERVICES=identity budget
WEB_DIR=clients/web

.PHONY: help
help:
	@echo "Targets:"
	@echo "  make core-up              - Starting RabbitMQ + Identity-DB"
	@echo "  make core-down            - Stops Core-Infra"
	@echo "  make services-dev SERVICE=name[,name...] - Starts Infra-Profile and Air for slected Services"
	@echo "  make web-dev              - Starts Web"
	@echo "  make dev                  - Core-Infra + Identity (Air) + Web; more services optional via SERVICE=..."

# ----------------------
# CORE INFRA (Identity-DB + RabbitMQ)
# ----------------------
.PHONY: core-up core-down
core-up:
	@echo ">> Starting core infra ($(CORE_PROFILES))..."
	docker compose --env-file $(ENV_FILE) --env-file $(ENV_FILE_DEV) -f $(INFRA_FILE) --profile core --profile identity up -d

core-down:
	docker compose --env-file $(ENV_FILE) --env-file $(ENV_FILE_DEV) -f $(INFRA_FILE) --profile core --profile identity down

# ----------------------
# SERVICE-DEV (selektiv)
# ----------------------
# Beispiel:
#   make services-dev SERVICE=budget
#   make services-dev SERVICE=identity,budget
.PHONY: services-dev
services-dev:
	@if [ -z "$(SERVICE)" ]; then \
		echo "Please add SERVICE (z.B. SERVICE=budget oder SERVICE=identity,budget)"; exit 1; \
	fi
	@# 1) Infra-Profile for selected services
	@profiles=$$(echo "$(SERVICE)" | tr ',' ' '); \
	for p in $$profiles; do \
		echo ">> Starting infra profile: $$p"; \
		docker compose --env-file $(ENV_FILE_DEV) --env-file $(ENV_FILE) -f $(INFRA_FILE) --profile $$p up -d; \
	done; \
	# 2) Go-Services start local with Air (one per terminal)
	for s in $$(echo "$(SERVICE)" | tr ',' ' '); do \
		echo ">> Starting Go service (Air): $$s"; \
		(cd $$s && \
			if [ -f .env.dev ]; then export $$(grep -v '^#' .env.dev | xargs); fi; \
			air) & \
	done; \
	wait || true

# ----------------------
# WEB
# ----------------------
.PHONY: web-dev
web-dev:
	@echo ">> Starting web dev server..."
	x-terminal-emulator -e "sh -lc 'cd $(WEB_DIR) && export $$(grep -v '^#' .env.dev | xargs) && ng serve --open'"

# ----------------------
# ONE-SHOT DEV (Core + Identity + Web; optional)
#   make dev
#   make dev SERVICE=budget
#   make dev SERVICE=identity,budget   (identity is part of core)
# ----------------------
.PHONY: dev
dev:
	@$(MAKE) core-up
	@$(MAKE) services-dev SERVICE=identity
	@$(MAKE) web-dev
	@if [ -n "$(SERVICE)" ]; then \
		# zusätzliche Feature-Services starten
		safe=$$(echo "$(SERVICE)" | sed 's/identity,\\?//; s/,identity//'); \
		if [ -n "$$safe" ]; then $(MAKE) services-dev SERVICE=$$safe; fi; \
	fi

# ----------------------
# migrations
# ----------------------
.PHONY: create-migration
create-migration:
	@if [ -z "$(service)" ]; then \
		echo "Please add service (e.g. service=budget)"; exit 1; \
	fi
	@if [ -z "$(name)" ]; then \
		echo "Please add name: make create-migration name=feature_name"; exit 1; \
	fi
	@if ! command -v migrate > /dev/null; then \
		echo "golang-migrate CLI not found, installing..."; \
		go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest; \
	fi
	migrate create -ext sql -dir "$(service)/database/migrations" -format "20060102150405" $(name)