# Troubleshooting

## Check the Compose configuration

From a release-bundle install:

```bash
docker compose --env-file .env -f docker-compose.yml config --quiet
```

From a source checkout:

```bash
make compose-config
```

## Missing env file

If Compose reports a missing env file, copy the example:

```bash
cp .env.example .env
```

In a source checkout:

```bash
make setup-env
```

Then edit the new env file and replace placeholder secrets.

## Placeholder secrets

If `make prod-up` refuses to start because `change-me` values remain, edit `deployments/.env` and replace every placeholder value with a real secret.

Generate secrets with:

```bash
openssl rand -base64 36
```

## Web UI does not load

Check container status and logs:

```bash
docker compose --env-file .env -f docker-compose.yml ps
docker compose --env-file .env -f docker-compose.yml logs household-web household-api
```

Verify `HOUSEHOLD_WEB_PORT` is not already in use. Change it in `.env` if needed.

## API is unhealthy

Check API and database logs:

```bash
docker compose --env-file .env -f docker-compose.yml logs household-api household-db
```

Common causes:

- `HOUSEHOLD_DB_PASSWORD` does not match the existing Postgres volume.
- The database is still starting.
- A migration failed.
- `HOUSEHOLD_SEED_DEMO_USER=true` but the seed name, email, or password is empty.

## Cannot log in on first boot

Confirm the seed admin was enabled for first boot:

```text
HOUSEHOLD_SEED_DEMO_USER=true
HOUSEHOLD_SEED_DEMO_USER_PASSWORD=<strong-password>
```

Restart the stack and check API logs. After the admin account works, set `HOUSEHOLD_SEED_DEMO_USER=false` and restart again.

## Development database is stale

For local development only, reset the dev database volume:

```bash
make reset-dev-db
make dev
```

Do not run this against production data.

## Updates fail

Check updater status and logs:

```bash
docker compose --env-file .env -f docker-compose.yml logs household-updater household-api
```

Confirm:

- `HOUSEHOLD_UPDATER_TOKEN` is the same value for API and updater.
- The updater has access to `/var/run/docker.sock`.
- The server can pull from `ghcr.io`.
- `HOUSEHOLD_VERSION` is a valid image tag.
