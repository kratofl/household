# Architecture

Household is a modular monolith: one ASP.NET Core API process, one PostgreSQL database, and feature-owned modules and schemas.

## Runtime shape

| Module | Path/service | Responsibility |
| --- | --- | --- |
| Web UI | `clients/web` / `household-web` | Next.js UI and browser-to-backend proxy. |
| API | `backend/src/Household.Api` / `household-api` | .NET 10 HTTP API, EF Core migrations, authentication, and feature modules. |
| Updater | `backend/src/Household.Updater` / `household-updater` | Internal .NET sidecar for release updates. |
| Database | `household-db` | Shared PostgreSQL database with feature-owned schemas. |

## Backend layout

```text
backend/
  src/
    Household.Api/
      Features/
        Identity/
        Budget/
        Audit/
        Updates/
      Platform/
    Household.Updater/
  tests/
    Household.Api.Tests/
```

Each feature owns its entities, EF Core context and migrations, application behavior, and endpoint registration. Platform code is limited to hosting, configuration, problem responses, and migration orchestration.

Identity exposes a small internal current-user interface. Other features use that interface for authentication and ownership and do not query Identity tables directly.

## HTTP and database seams

The API exposes `/healthz` and feature routes under `/api/v1`. Browser code calls `src/lib/api.ts`; the Next.js route proxy forwards `/api/backend/*` to the one API process.

Feature data remains separated by PostgreSQL schema:

| Feature/platform area | Schema | EF migration history |
| --- | --- | --- |
| Identity | `identity` | `identity.__EFMigrationsHistory` |
| Budget | `budget` | `budget.__EFMigrationsHistory` |
| Audit | `audit` | `audit.__EFMigrationsHistory` |

The adoption migrations are intentionally compatible with the previous Go-era schemas. Existing users, bcrypt password hashes, opaque token hashes, sessions, modules, audit records, and prototype Budget records remain readable during cutover.

## Update architecture

The API checks GitHub Releases and asks the updater sidecar to apply an update. The updater edits the stack environment, creates a database backup, pulls images, and restarts the API and web containers. It is internal-only, mounts the Docker socket, and requires `HOUSEHOLD_UPDATER_TOKEN`.
