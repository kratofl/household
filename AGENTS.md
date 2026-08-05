# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project shape

Household is a local-network-first modular monolith:

- `backend/src/Household.Api/`: .NET 10 ASP.NET Core API.
- `backend/src/Household.Updater/`: internal .NET updater sidecar.
- `backend/tests/Household.Api.Tests/`: authenticated HTTP and migration tests against real PostgreSQL.
- `clients/web/`: Next.js 16 App Router client with TypeScript, Tailwind CSS 4, and shadcn/ui.
- `deployments/`: Docker Compose and observability configuration.
- `docs/`: architecture, product, operational, and development documentation.

The API is one process with feature modules under `Features/<Feature>`. PostgreSQL remains one database with feature-owned schemas such as `identity`, `budget`, and `audit`. Features may use another feature's explicit internal interface but must not reach into its tables directly.

Budget product vocabulary and invariants are defined in `docs/budget/`, `docs/decisions/`, and `docs/superpowers/specs/2026-07-20-complete-budget-slice.md`. Preserve append-oriented financial history, effective-dated intent, exact money, authenticated ownership, and historical projections.

## General rules

- Prefer existing patterns over new abstractions.
- Do not edit `.env` or other local environment files unless explicitly asked.
- Keep feature code and EF Core migrations inside the owning feature.
- Put only genuinely reusable cross-cutting behavior in `Platform/`.
- Use `rg` / `rg --files` for searching.
- Do not commit generated output, caches, logs, backups, or `node_modules`.
- Treat existing working-tree changes as user-owned unless the active task clearly owns them.

## Common commands

From the repository root:

```bash
make bootstrap
make check
make backend-test
make backend-build
make web-lint
make web-build
make browser-test
make compose-config
```

Direct backend commands run from `backend/`:

```bash
dotnet restore Household.slnx
dotnet test Household.slnx
dotnet build Household.slnx
```

The Makefile recipes need a POSIX `sh` (run them from Git Bash or WSL). From Windows
PowerShell use the equivalent task runner instead: `.\make.ps1 <target>` (same target
names; see `.\make.ps1 help`).

Backend integration tests launch PostgreSQL through Docker, so Docker must be running.
Browser tests (`make browser-test`, Playwright in `clients/web/e2e/`) start their own
PostgreSQL container and the real .NET API, so Docker must be running for them too.

Local development:

```bash
make db-up
make api-dev
make web-dev
make dev
```

Create an EF Core migration with:

```bash
make create-migration feature=budget name=AddExample
```

## Backend conventions

- API host: `backend/src/Household.Api/Program.cs`.
- Feature modules: `backend/src/Household.Api/Features/<Feature>/`.
- Cross-cutting hosting/configuration: `backend/src/Household.Api/Platform/`.
- Each persistent feature owns a `DbContext`, migrations, entities, application behavior, and endpoint mapping.
- EF migration history lives in the owning PostgreSQL schema.
- Public errors use RFC-style problem JSON.
- Public JSON uses camelCase and language-neutral enum values.
- Identity owns opaque access/refresh sessions and exposes the internal current-user interface used by other features.
- User registration defaults to `pending` / `user`; admin-gated behavior must remain intact.
- Exact financial values must never use binary floating point.
- Use `TimeProvider` for time-dependent behavior.
- Test public behavior at the authenticated HTTP seam and use focused domain tests only for combinatorial logic.

## Frontend conventions

- Keep browser-side backend access behind `clients/web/src/lib/api.ts` and the Next route proxy.
- Use shadcn/ui components from `clients/web/src/components/ui`; do not rebuild common controls inside feature pages.
- Budget owns focused routes for Overview, Transactions, Planning, Saving & Investing, Wishlist, Categories, Reports, and Settings.
- Dashboard subnavigation belongs in the sidebar as nested navigation.
- Active modules control navigation and availability; do not show an “Active slices” content card/list.
- Keep Account and Admin entries singular and visually coherent.
- Budget workflows must support German and English, locale-aware formatting, responsive/mobile use, keyboard operation, and meaningful loading, empty, validation, conflict, success, and error states.

## Verification and documentation

Before handoff, run `make check`. Add focused tests for changed behavior. Update documentation when API behavior, migrations, configuration, containers, setup, or operational workflows change. Code and migrations are implementation truth; product specs and ADRs are normative for intended Budget behavior.
