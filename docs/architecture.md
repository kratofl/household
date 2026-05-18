# Architecture

Household is moving toward a modular monolith: one backend process, one database, and feature-owned packages and schemas.

## Runtime shape

| Component | Path/service | Responsibility |
| --- | --- | --- |
| Web UI | `clients/web` / `household-web` | Next.js UI and browser-to-backend proxy. |
| API | `backend/cmd/household-api` / `household-api` | Go HTTP API, migrations, auth, features. |
| Updater | `backend/cmd/household-updater` / `household-updater` | Internal sidecar for release updates. |
| Database | `household-db` | Shared Postgres database with feature schemas. |

## Backend layout

```text
backend/
  cmd/
    household-api/
    household-updater/
  internal/
    features/
      identity/
      budget/
      auditlog/
      updates/
    platform/
      audit/
      config/
      database/
      http/
      logging/
      migrations/
      validation/
```

Feature packages register routes through a `RegisterRoutes` method. Platform packages contain shared concerns such as config loading, logging, HTTP middleware, database setup, audit persistence, and migration orchestration.

## API routing

The API exposes `/healthz` and feature routes under `/api/v1`.

Implemented feature areas include:

| Area | Current routes/status |
| --- | --- |
| Identity | Auth authorize/refresh/logout, users, password change, modules, active modules. |
| Budget | Schema and health route scaffold; product behavior is still under development. |
| Updates | Admin release candidates, updater status, and update job start. |
| Audit log | Internal audit persistence for admin/update actions. |

## Database model

Household uses one Postgres database. Features own their schemas:

| Feature/platform area | Schema |
| --- | --- |
| Identity | `identity` |
| Budget | `budget` |
| Audit | `audit` |

Migrations live next to the owning feature or platform package and run on API startup.

## Frontend layout

The web app is a Next.js App Router project in `clients/web`.

Browser code calls `src/lib/api.ts`, which sends requests to `/api/backend/*`. The route handler at `src/app/api/backend/[...path]/route.ts` forwards those requests to the Go API. This keeps local-network installs simple and avoids browser CORS configuration.

## Update architecture

The API checks GitHub Releases and asks the updater sidecar to apply updates. The updater can edit the stack env file, create backups, pull images, and restart services because it mounts the Docker socket.

That Docker socket access is powerful. The updater is internal-only in Compose and protected by `HOUSEHOLD_UPDATER_TOKEN`.

## Current product status

Identity, admin user flow, module toggles, update checks, and the shell of budget are the active foundation. Budget planning, expense tracking, and other household modules are still planned or in progress. Public docs should distinguish current behavior from planned behavior.
