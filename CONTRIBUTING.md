# Contributing

Thanks for considering a contribution to Household. The project is local-network-first, self-hosted software, so reliability, clear setup, and safe defaults matter as much as features.

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before opening an issue

- Search existing issues and discussions first.
- Do not include secrets, real `.env` values, tokens, passwords, or private backup contents.
- For security issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Development setup

Prerequisites:

- Go 1.26.x
- Node.js 24.x and npm
- Docker Engine with the Docker Compose plugin
- Optional: `air` for backend hot reload

Bootstrap a clean clone:

```bash
git clone https://github.com/kratofl/household.git
cd household
make setup-env
make bootstrap
make doctor
```

Start the local development stack:

```bash
make dev
```

This starts Postgres in Docker, then runs the Go API and Next.js locally. Local development seeds an admin user with `admin` / `admin` unless `HOUSEHOLD_DEV_SEED_DEMO_USER_PASSWORD` overrides the password.

More details:

- [Local setup](docs/development/local-setup.md)
- [Testing and checks](docs/development/testing.md)
- [Database migrations](docs/db/migrations.md)
- [Architecture](docs/architecture.md)

## Checks before a pull request

Run:

```bash
make check
```

For focused checks:

```bash
make backend-test
make backend-build
make web-lint
make web-build
make compose-config
```

## Project boundaries

- Backend code lives in `backend/`.
- Feature modules live under `backend/internal/features/<feature>`.
- Shared backend platform code lives under `backend/internal/platform`.
- Feature data should stay in feature-owned Postgres schemas, such as `identity`, `budget`, and `audit`.
- The web UI lives in `clients/web/`.
- Docker and operations files live in `deployments/`.

Keep feature code inside the owning feature unless a helper is genuinely reusable platform code.

## Backend conventions

- API entry point: `backend/cmd/household-api`.
- Updater entry point: `backend/cmd/household-updater`.
- Route registration happens through feature `RegisterRoutes` implementations.
- Migrations run on API startup.
- Use table-driven Go tests for pure logic.
- Use `httptest` and small fakes for handler behavior where possible.
- Run `gofmt` on changed Go files.

Create feature migrations with:

```bash
make create-migration feature=budget name=add_accounts
```

## Frontend conventions

- The frontend is a Next.js App Router app in `clients/web`.
- Backend calls should go through `src/lib/api.ts`.
- Browser-facing backend access is proxied through `src/app/api/backend/[...path]/route.ts`.
- Use existing shadcn/ui components in `src/components/ui`.
- Keep UI state and feature code close to the App Router route that uses it until there is a clear reason to extract it.

## Documentation expectations

Update docs when you change:

- Install or upgrade behavior.
- Environment variables.
- Docker Compose or Make targets.
- API behavior visible to users or contributors.
- Database migration conventions.

Docs should describe current behavior honestly. If a feature is planned but not implemented, mark it as planned.

## Branch naming

Suggested branch names:

- `feature/name-of-feature`
- `enhancement/name-of-enhancement`
- `bug/issue-id-description`
- `chore/name-of-chore`
- `docs/topic`

## Pull requests

- Keep PRs focused and explain the user-visible change.
- Include screenshots or short recordings for UI changes when helpful.
- Call out database migrations, config changes, breaking changes, or operational follow-up.
- Reference related issues with `Relates #123` or `Fixes #123`.
- Make sure generated output, local databases, backups, logs, and real env files are not committed.
