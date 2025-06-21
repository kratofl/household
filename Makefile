ENV ?= local
ENV_FILE = .env.$(ENV)
COMPOSE_FILE = ./deployments/docker-compose.$(ENV).yml
PROJECT_NAME = household

.PHONY: up down db logs

up:
	docker compose -p $(PROJECT_NAME) --env-file $(ENV_FILE) -f $(COMPOSE_FILE) up -d

db:
	docker compose -p $(PROJECT_NAME) --env-file $(ENV_FILE) -f $(COMPOSE_FILE) up -d mysql

down:
	docker compose -p $(PROJECT_NAME) --env-file $(ENV_FILE) -f $(COMPOSE_FILE) down

logs:
	docker compose -p $(PROJECT_NAME) --env-file $(ENV_FILE) -f $(COMPOSE_FILE) up -d loki alloy grafana
