---
name: test-household-app
description: Start, keep alive, seed, and inspect this worktree's isolated Household dev stack (Docker Compose with web, API, PostgreSQL) to verify UI or API behavior in a real browser or with curl. Use when a change needs to be seen working in the app rather than proven by build, lint, or tests.
---

# Test the Household app

Everything runs in this worktree's own Compose project. Nothing here touches another
worktree, `deployments/.env`, or a production stack.

## Start or reuse the stack

1. Run `make dev-info` first. If it lists running services and a Web URL, the stack is
   already up: reuse it. Do not start a second Watch session in the same worktree.
2. Otherwise run `make dev` in the background and keep it running. It builds images,
   waits for the database and API health checks, prints the URL, then watches source
   changes. The first start takes a few minutes.
3. Read the URL from the `Web:` line. The host port is assigned by Docker and can change
   after a rebuild, so re-run `make dev-info` instead of remembering it.
4. Sign in as `admin` / `admin`. Set the UI language via `localStorage`
   key `household.locale` (`de` or `en`) before the first navigation when a test depends
   on it.

Source edits sync into the containers automatically. Backend edits restart the API through
`dotnet watch`; expect a few seconds of unavailability. Changes to `package.json`,
`Dockerfile`, or the Compose files rebuild the affected image; run `make dev` again after
Compose changes.

## Realistic data

An empty database proves little. Restore a dump into this worktree's database with:

```bash
make seed-dev BACKUP=deployments/backups/<file>.dump
```

The dump comes from `make prod-backup` on the home server or from another worktree. The
target's API and web containers are stopped during the restore and started again
afterwards, so pending migrations apply on top of the restored data. Accounts and
passwords are the ones from the dump, not `admin` / `admin`.

Data flows into a worktree only. Never restore a worktree dump into production and never
point a dev command at `deployments/.env`.

## Inspect the database

```bash
docker compose --project-name "$(make -s dev-project)" -f deployments/docker-compose.dev.yml \
  exec household-db psql -U household -d household
```

Schemas are `identity`, `budget`, and `audit`. Read freely; change data through the API
so ledger invariants hold.

## Verify in the browser

- Use the browser automation available to you and open the URL from `dev-info`.
- Cover both languages when text changed, and a narrow viewport when layout changed.
- Take screenshots for PR evidence; do not commit them.
- The Playwright specs under `clients/web/e2e` have no runner and a missing `stack`
  helper. Do not rely on them until that is fixed.

## Tear down

Leave the stack running while the user may still want to look. When the task is finished
and nothing is pending, stop it with `make dev-down`; data is retained. `make reset-dev-db`
deletes this worktree's volumes and asks for the project name to confirm.
