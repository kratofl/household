# Database migrations

The backend is a modular monolith. Feature migrations live inside `backend/internal/features/<feature>/migrations`, while platform migrations live under `backend/internal/platform/<area>/migrations`.

## Create a feature migration

```bash
make create-migration feature=budget name=add_accounts
make create-migration feature=identity name=add_profile_fields
```

This uses the `golang-migrate` timestamp format and creates matching `.up.sql` and `.down.sql` files.

Use feature migrations for feature-owned schemas and tables. Put only shared platform migrations under `backend/internal/platform/<area>/migrations`.

## Runtime behavior

`household-api` runs migrations on startup against the shared Postgres database. Feature data is separated by Postgres schema:

| Area | Schema | Migration table |
| --- | --- | --- |
| Identity | `identity` | `identity_schema_migrations` |
| Budget | `budget` | `budget_schema_migrations` |
| Audit | `audit` | `audit_schema_migrations` |

The migration runner executes areas in a defined order so the production container can start from an empty database.

## Local dev

`make dev` starts Postgres in Docker and then the local API. Migrations run automatically on API startup.

To run backend checks after adding migrations:

```bash
make backend-test
make backend-build
```

The first Identity migrations intentionally use `IF NOT EXISTS` and `ON CONFLICT DO NOTHING` so older development databases that already contain `identity.users`, `identity.modules`, or `identity.sessions` can be adopted by the monolith migration table.

## Local dev reset

If an old dev database still contains obsolete service-era migration state, reset the dev volume:

```bash
make reset-dev-db
make dev
```
