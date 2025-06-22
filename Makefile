ENV ?= local
ENV_FILE = ./deployments/$(ENV)/.env.$(ENV)
COMPOSE_FILE = ./deployments/$(ENV)/docker-compose.$(ENV).yml
PROJECT_NAME = household

.PHONY: up down build logs mysql \
        restart-budget_api \
        rebuild-budget_api
up:
	docker compose -p $(PROJECT_NAME) --env-file $(ENV_FILE) -f $(COMPOSE_FILE) up -d

down:
	docker compose -p $(PROJECT_NAME) --env-file $(ENV_FILE) -f $(COMPOSE_FILE) down

build:
	docker compose -p $(PROJECT_NAME) --env-file $(ENV_FILE) -f $(COMPOSE_FILE) build

logs:
	docker compose -p $(PROJECT_NAME) --env-file $(ENV_FILE) -f $(COMPOSE_FILE) logs -f

mysql:
	docker compose -p $(PROJECT_NAME) --env-file $(ENV_FILE) -f $(COMPOSE_FILE) exec mysql mysql -uroot -pmy-secret-pw mydb

restart-budget_api:
	docker compose -p $(PROJECT_NAME) --env-file $(ENV_FILE) -f $(COMPOSE_FILE) restart budget-api

rebuild-budget_api:
	docker compose -p $(PROJECT_NAME) --env-file $(ENV_FILE) -f $(COMPOSE_FILE) build budget-api
	docker compose -p $(PROJECT_NAME) --env-file $(ENV_FILE) -f $(COMPOSE_FILE) up -d --no-deps budget-api