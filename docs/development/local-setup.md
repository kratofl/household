# Local development setup

The primary development workflow runs Postgres in Docker and runs the API and web app directly on your machine.

## Prerequisites

- Go 1.26.x
- Node.js 24.x and npm
- Docker Engine with the Docker Compose plugin
- Optional: `air` for backend hot reload

## Bootstrap

```bash
git clone https://github.com/kratofl/household.git
cd household
make setup-env
make bootstrap
make doctor
```

`make setup-env` creates `deployments/.env` from `deployments/.env.example` if it is missing. The file is ignored by Git.

## Start everything

```bash
make dev
```

This starts:

- `household-db` in Docker.
- The Go API from `backend/`.
- The Next.js web app from `clients/web/`.

Default local URLs:

| Service | URL |
| --- | --- |
| Web UI | `http://localhost:3000` |
| API health | `http://localhost:8090/healthz` |
| API base | `http://localhost:8090/api/v1` |
| Postgres | `localhost:5432` |

Local development seeds an admin user with:

```text
username: admin
password: admin
```

Override only the local dev seed password with:

```bash
HOUSEHOLD_DEV_SEED_DEMO_USER_PASSWORD=<password> make api-dev
```

## Run services separately

```bash
make db-up
make api-dev
make web-dev
```

Stop the dev database:

```bash
make db-down
```

Reset the dev database volume:

```bash
make reset-dev-db
```

## Frontend backend proxy

The web app calls `/api/backend/*` in the browser. Next.js proxies those calls from `clients/web/src/app/api/backend/[...path]/route.ts` to the Go API.

By default local web dev targets:

```text
http://localhost:8090/api/v1
```

Override when needed:

```bash
cd clients/web
HOUSEHOLD_API_URL=http://<api-host>:8090/api/v1 npm run dev
```

## Optional observability

Start Grafana, Loki, and Grafana Alloy for local logs:

```bash
make observability-up
```

Grafana is available on `http://localhost:3001` by default.
