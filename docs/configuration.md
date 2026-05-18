# Configuration

Household uses one local environment file for Docker Compose:

```bash
cp deployments/.env.example deployments/.env
```

`deployments/.env` is intentionally ignored by Git. Keep it private, back it up with your server configuration, and never commit it.

Generate strong values before first production use:

```bash
openssl rand -base64 36
```

Use separate generated values for `HOUSEHOLD_DB_PASSWORD`, `HOUSEHOLD_UPDATER_TOKEN`, and `HOUSEHOLD_SEED_DEMO_USER_PASSWORD`.

## Required production changes

Change these before starting a real home-server install:

| Variable | Why it matters |
| --- | --- |
| `HOUSEHOLD_DB_PASSWORD` | Protects the Postgres database inside the Compose stack. |
| `HOUSEHOLD_UPDATER_TOKEN` | Protects the internal updater sidecar API. |
| `HOUSEHOLD_SEED_DEMO_USER_PASSWORD` | Initial admin password when `HOUSEHOLD_SEED_DEMO_USER=true`. |

After the first admin account is usable, set `HOUSEHOLD_SEED_DEMO_USER=false` and restart the stack.

## Compose and image settings

| Variable | Default/example | Description |
| --- | --- | --- |
| `PROJECT_NAME` | `household` | Docker Compose project name. It prefixes containers, networks, and volumes. |
| `HOUSEHOLD_VERSION` | `stable` | Image tag to run. Use a release tag for pinned installs, `stable` for the latest stable release, or `unstable` for prereleases. |
| `HOUSEHOLD_IMAGE_OWNER` | `kratofl` | GitHub Container Registry owner for `household-api`, `household-web`, and `household-updater`. Change this when running images from a fork. |

## Web settings

| Variable | Default/example | Description |
| --- | --- | --- |
| `HOUSEHOLD_WEB_PORT` | `3000` | Host port for the web UI. Open `http://<server>:<port>` after the stack starts. |
| `HOUSEHOLD_API_URL` | `http://localhost:8090/api/v1` in local web dev | Backend target for the Next.js route proxy when running the web app outside Compose. |
| `NEXT_PUBLIC_HOUSEHOLD_API_URL` | Optional | Fallback backend target for local web dev. Prefer `HOUSEHOLD_API_URL` for server-side proxy configuration. |

In production Compose, the web container talks to the API over the internal Docker network. You normally do not need to set `HOUSEHOLD_API_URL` yourself.

## API settings

| Variable | Default/example | Description |
| --- | --- | --- |
| `HOUSEHOLD_API_SERVER_PORT` | `8090` | API listen port inside the Compose network. It is not published to the host by default. |
| `HOUSEHOLD_API_SERVER_TIMEOUT_READ` | `5s` | HTTP server read timeout. |
| `HOUSEHOLD_API_SERVER_TIMEOUT_WRITE` | `10s` | HTTP server write timeout. |
| `HOUSEHOLD_API_SERVER_TIMEOUT_IDLE` | `60s` | HTTP server idle timeout and graceful shutdown timeout. |
| `HOUSEHOLD_API_SERVER_DEBUG` | unset / `false` | Enables debug behavior in the API. Leave disabled in production. |
| `HOUSEHOLD_API_DB_DEBUG` | unset / `false` | Enables verbose database logging. Leave disabled in production unless troubleshooting. |

The API reads database settings as `HOUSEHOLD_API_DB_*`. Compose and the Makefile derive those from the simpler `HOUSEHOLD_DB_*` values below.

## Database settings

| Variable | Default/example | Description |
| --- | --- | --- |
| `HOUSEHOLD_DB_DATABASE` | `household` | Postgres database name. |
| `HOUSEHOLD_DB_USER` | `household` | Postgres database user. |
| `HOUSEHOLD_DB_PASSWORD` | `change-me-long-random-database-password` | Postgres password. Must be changed for production. |
| `HOUSEHOLD_DB_PORT` | `5432` | Host port for the development database. Production does not publish Postgres to the host. |

## Logging settings

| Variable | Default/example | Description |
| --- | --- | --- |
| `HOUSEHOLD_LOG_LEVEL` | `info` | Log level accepted by zerolog, such as `trace`, `debug`, `info`, `warn`, or `error`. |
| `HOUSEHOLD_LOG_ENVIRONMENT` | `production` in production Compose, `dev` in local Make targets | Environment label attached to structured logs. |
| `HOUSEHOLD_LOG_VERSION` | `HOUSEHOLD_VERSION` in production Compose | Version label attached to structured logs. |
| `HOUSEHOLD_LOG_FILE_ENABLED` | unset / `false` | Writes logs to local files in addition to stdout. Prefer stdout for containers. |

## First admin seed

| Variable | Default/example | Description |
| --- | --- | --- |
| `HOUSEHOLD_SEED_DEMO_USER` | `false` | When `true`, startup ensures the seed admin exists. Use only for first boot or local development. |
| `HOUSEHOLD_SEED_DEMO_USER_NAME` | `admin` | Display/user name for the seed admin. |
| `HOUSEHOLD_SEED_DEMO_USER_EMAIL` | `admin@household.local` | Email for the seed admin login. |
| `HOUSEHOLD_SEED_DEMO_USER_PASSWORD` | `change-me-before-first-boot` | Password for the seed admin. Must be changed before first production boot. |

For local development, `make api-dev` defaults to a seed admin if no env file overrides it.

## Updates

| Variable | Default/example | Description |
| --- | --- | --- |
| `HOUSEHOLD_UPDATES_GITHUB_REPOSITORY` | `kratofl/household` | Repository used by the app to check GitHub Releases. Change when running a fork. |
| `HOUSEHOLD_UPDATER_TOKEN` | `change-me-long-random-updater-token` | Shared bearer token between the API and updater sidecar. Must be changed for production. |
| `HOUSEHOLD_UPDATES_TIMEOUT` | `15s` | API timeout for update checks and updater calls. |

The updater sidecar also uses internal variables such as `HOUSEHOLD_UPDATER_STACK_DIR`, `HOUSEHOLD_UPDATER_ENV_FILE`, `HOUSEHOLD_UPDATER_COMPOSE_FILE`, and `HOUSEHOLD_UPDATER_BACKUP_DIR`. The production Compose file sets those automatically.

## Observability profile

| Variable | Default/example | Description |
| --- | --- | --- |
| `GRAFANA_IMAGE` | `grafana/grafana:12.4.3` | Grafana image used by the optional observability profile. |
| `LOKI_IMAGE` | `grafana/loki:3.5.12` | Loki image used by the optional observability profile. |
| `ALLOY_IMAGE` | `grafana/alloy:v1.16.1` | Grafana Alloy image used by the optional observability profile. |
| `GRAFANA_PORT` | `3001` | Host port for Grafana when the observability profile is enabled. |
| `LOKI_PORT` | `3100` | Host port for Loki when the observability profile is enabled. |
| `ALLOY_PORT` | `12345` | Host port for Grafana Alloy when the observability profile is enabled. |

Start optional observability with:

```bash
make observability-up
```
