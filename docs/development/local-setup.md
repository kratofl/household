# Local development setup

The primary workflow runs PostgreSQL in Docker and the .NET API and Next.js app directly on the host.

## Prerequisites

- .NET 10 SDK
- Node.js 24.x and npm
- Docker Engine with the Docker Compose plugin

## Bootstrap and start

```bash
git clone https://github.com/kratofl/household.git
cd household
make setup-env
make bootstrap
make doctor
make dev
```

`make dev` starts PostgreSQL, `dotnet watch` for the API, and Next.js development mode. The default URLs are:

| Service | URL |
| --- | --- |
| Web UI | `http://localhost:3000` |
| API health | `http://localhost:8090/healthz` |
| API base | `http://localhost:8090/api/v1` |
| PostgreSQL | `localhost:5432` |

Local development seeds `admin` / `admin`. Override the password with `HOUSEHOLD_DEV_SEED_DEMO_USER_PASSWORD` when starting `make api-dev`.

Run services separately with `make db-up`, `make api-dev`, and `make web-dev`; stop PostgreSQL with `make db-down`. `make reset-dev-db` removes the local development database volume.

The browser calls `/api/backend/*`. Next.js forwards those requests to `http://localhost:8090/api/v1` by default; set `HOUSEHOLD_API_URL` to override it.
