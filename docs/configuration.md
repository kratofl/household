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

Use separate generated values for `HOUSEHOLD_DB_PASSWORD` and `HOUSEHOLD_SEED_DEMO_USER_PASSWORD`.

## Required production changes

Change these before starting a real home-server install:

| Variable | Why it matters |
| --- | --- |
| `HOUSEHOLD_DB_PASSWORD` | Protects the Postgres database inside the Compose stack. |
| `HOUSEHOLD_SEED_DEMO_USER_PASSWORD` | Initial admin password when `HOUSEHOLD_SEED_DEMO_USER=true`. |

After the first admin account is usable, set `HOUSEHOLD_SEED_DEMO_USER=false` and restart the stack.

## Compose and image settings

| Variable | Default/example | Description |
| --- | --- | --- |
| `PROJECT_NAME` | `household` | Docker Compose project name. It prefixes containers, networks, and volumes. |
| `HOUSEHOLD_VERSION` | `stable` | Image tag to run. Use a release tag for pinned installs, `stable` for the latest stable release, or `unstable` for prereleases. |
| `HOUSEHOLD_IMAGE_OWNER` | `kratofl` | GitHub Container Registry owner for `household-api` and `household-web`. Change this when running images from a fork. |

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

The API reads database settings as `HOUSEHOLD_API_DB_*`. Compose and the Makefile derive those from the simpler `HOUSEHOLD_DB_*` values below.

The API writes logs to stdout; read them with `docker compose logs household-api`. These settings from earlier releases are still accepted in `.env` but have no effect: `HOUSEHOLD_API_SERVER_TIMEOUT_READ`, `HOUSEHOLD_API_SERVER_TIMEOUT_WRITE`, `HOUSEHOLD_API_SERVER_TIMEOUT_IDLE`, `HOUSEHOLD_API_SERVER_DEBUG`, `HOUSEHOLD_API_DB_DEBUG`, `HOUSEHOLD_LOG_LEVEL`, `HOUSEHOLD_LOG_ENVIRONMENT`, `HOUSEHOLD_LOG_VERSION`, and `HOUSEHOLD_LOG_FILE_ENABLED`.

## Database settings

| Variable | Default/example | Description |
| --- | --- | --- |
| `HOUSEHOLD_DB_DATABASE` | `household` | Postgres database name. |
| `HOUSEHOLD_DB_USER` | `household` | Postgres database user. |
| `HOUSEHOLD_DB_PASSWORD` | `change-me-long-random-database-password` | Postgres password. Must be changed for production. |
| `HOUSEHOLD_DB_PORT` | `5432` | Host port for the development database. Production does not publish Postgres to the host. |

## First admin seed

| Variable | Default/example | Description |
| --- | --- | --- |
| `HOUSEHOLD_SEED_DEMO_USER` | `false` | When `true`, startup ensures the seed admin exists. Use only for first boot or local development. |
| `HOUSEHOLD_SEED_DEMO_USER_NAME` | `admin` | Display/user name for the seed admin. |
| `HOUSEHOLD_SEED_DEMO_USER_EMAIL` | `admin@household.local` | Email for the seed admin login. |
| `HOUSEHOLD_SEED_DEMO_USER_PASSWORD` | `change-me-before-first-boot` | Password for the seed admin. Must be changed before first production boot. |

For local development, `make dev` seeds `admin` / `admin` in an isolated database
per worktree. It does not load the production `.env`; see [Local setup](development/local-setup.md).

## Login through an OIDC provider

Optional. Adds a sign-in button for an OpenID Connect provider such as Pocket ID next to the
password login, which stays available.

| Variable | Default/example | Description |
| --- | --- | --- |
| `HOUSEHOLD_OIDC_ENABLED` | `false` | When `true`, the login screen offers the provider. The API refuses to start if the next three are missing. |
| `HOUSEHOLD_OIDC_ISSUER` | `https://auth.example.com` | Issuer URL of the provider, without `/.well-known/...`. The API container must reach it and trust its certificate. |
| `HOUSEHOLD_OIDC_CLIENT_ID` | | Client ID of the OIDC client registered for Household. |
| `HOUSEHOLD_OIDC_CLIENT_SECRET` | | Client secret of that client. Treat it like a password. |
| `HOUSEHOLD_OIDC_NAME` | `SSO` | Provider name on the button, for example `Pocket ID`. |

Register Household at the provider as a confidential client with the callback URL
`<your Household URL>/auth/callback`, for example `https://household.example.com/auth/callback`.
Every address you open Household under needs its own callback URL there.

Signing in with an unknown provider account creates a `pending` user that an admin has to activate,
like a password registration. To use the provider with an existing account, sign in with the password
and link the provider under **Account**. A provider account never takes over an existing account by
matching name or email.

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
