.PHONY: compose-dev-up \
		compose-dev-down

compose-dev-up:
	docker compose --env-file deployments/.env --env-file deployments/.env.dev -f deployments/compose.yml -f deployments/compose.dev.yml up -d

compose-dev-down:
	docker compose --env-file deployments/.env --env-file deployments/.env.dev -f deployments/compose.yml -f deployments/compose.dev.yml down
