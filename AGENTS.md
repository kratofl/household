# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Shape

This is currently a multi-module household application, moving toward a modular-monolith architecture:

- `identity/`: Go HTTP API for users and auth, using Chi, GORM, PostgreSQL, `golang-migrate`, and shared packages.
- `budget/`: Go HTTP API scaffold, using Chi, GORM, PostgreSQL, and shared packages.
- `shared/`: Go module for shared config, logging, validation, HTTP middleware, error responses, and database migration helpers.
- `clients/web/`: Next.js 16 App Router client with TypeScript, Tailwind CSS 4, and shadcn/ui preset `b6FAZ7jW6a`.
- `deployments/`: Docker Compose files for dev and prod infrastructure.
- `docs/`: Project documentation. Some docs are currently stale; verify against code before relying on them.

The repository root is a Go workspace (`go.work`), not a Go module.

Target architecture:

- Prefer a modular monolith over microservices.
- Keep feature folders/packages separate. Do not collapse identity, budget, and future modules into one mixed package.
- Use one Postgres database for the application.
- Use Postgres schemas per feature, for example `identity`, `budget`, `shopping`, `recipes`, and `calendar`.
- Feature code may call another feature through explicit internal services/interfaces, but should not reach into another feature's tables directly.
- Identity is the central auth/OAuth/OIDC-style module for the app. Other features should depend on Identity for current user, claims, active modules, and permissions.
- Budget and other feature modules should store owner references such as `user_id` or `household_id`, not duplicate auth logic.

## Product Context From Notes

Project notes live outside the repo in:

`/Users/kratofl/Library/Mobile Documents/com~apple~CloudDocs/01 Notes/Dev/household`

Use those notes as product context, but keep repository code and checked-in docs as the implementation source of truth.

Current product direction from the notes:

- The application is intended to be hosted in the local network first, not as a public internet service.
- The user model is admin-gated: an admin can create/provision credentials, or users can register and remain pending until an admin approves them.
- Users must be able to change their own password after login.
- The broader app should eventually cover budget, shopping list, recipes, meal planning, calendar, and waste schedule.
- Budget is the most developed concept and should replace an existing spreadsheet for tracking and categorizing expenses.
- Budget should support connected accounts, including a shared account.
- Identity is intended to grow beyond the current implemented endpoints into auth refresh/logout, current-user access, user administration, and module activation.

Budget domain concepts from the notes:

- Monthly spending limit with a visual bar that shows spending categories and remaining budget.
- Pre-planned expenses split into fixed costs and subscriptions.
- Fixed costs can have behaviors such as subtract from budget or move into savings plan.
- Subscriptions can be monthly or yearly. Yearly subscriptions may be represented as yearly subscriptions in overview views while being distributed into monthly transactions for budgeting.
- Changes to pre-planned expenses should apply either to the current month or a future month without rewriting past months.
- The intended model is a working copy plus month-specific copied versions for fixed costs and similar recurring expense definitions.
- Overspending carries into the next month. Underspending does not automatically increase the next month, unless this is later made configurable.
- Month start should be configurable: calendar month start or salary arrival.
- Expenses can be marked as excluded from the spending limit while still affecting real bank-account tracking.
- Income should be configurable, with salary as the default source.
- Categories should be editable, colored, and behavior-driven. Deleted categories should leave expenses as uncategorized.
- A special non-deletable category should represent expenses that are not counted toward the limit.
- Savings plan receives fixed-cost entries with the "move into savings plan" behavior and tracks planned large expenses plus a configurable minimum buffer.

Planned identity endpoints from notes:

```text
POST   /auth/authorize
POST   /auth/logout
POST   /auth/refresh
GET    /users
GET    /users/me
PUT    /users
PUT    /users/{id}
DELETE /users/{id}
GET    /modules
PUT    /modules/{id}
PATCH  /modules/active
```

Currently implemented identity routes include `POST /auth/authorize`, `POST /auth/refresh`, `POST /auth/logout`, `GET /users`, `GET /users/me`, `PUT /users`, `PUT /users/me/password`, `GET /users/{id}`, `PUT /users/{id}`, `GET /modules`, `PUT /modules/{id}`, and `PATCH /modules/active` under `/api/v1`.

## General Rules

- Prefer existing patterns over new abstractions.
- Do not edit local environment files such as `.env`, `.env.dev`, or service-specific `.env` files unless explicitly asked.
- Keep service-local code inside the owning service module. Put only reusable cross-service helpers in `shared/`.
- Use `rg` / `rg --files` for searching.
- For Go code, run `gofmt` on changed files.
- Keep frontend components focused and colocated under the Next.js app structure.
- Do not commit generated build output, local caches, logs, or `node_modules`.

## Common Commands

### Go

Run Go checks from each module, not from the repository root:

```bash
make test
```

The root `make test` target runs:

```bash
cd identity && go test ./...
cd budget && go test ./...
cd shared && go test ./...
```

`go test ./...` from the repository root currently fails because `.` is not one of the modules listed in `go.work`.

Build service binaries:

```bash
make build
```

### Web

Install dependencies and run Next.js commands from `clients/web/`:

```bash
cd clients/web
npm install
npm run lint
npm run build
npm run dev
```

The web UI proxies backend calls through `src/app/api/backend/[...path]/route.ts`. Set `HOUSEHOLD_API_URL` or `NEXT_PUBLIC_HOUSEHOLD_API_URL` when the Identity API is not reachable at `http://localhost:8090/api/v1`.

### Local Dev

The `Makefile` is the main local orchestration surface:

```bash
make core-up
make core-down
make services-dev SERVICE=identity
make services-dev SERVICE=budget
make services-dev SERVICE=identity,budget
make web-dev
make dev
```

Go service hot reload expects `air` to be installed and uses each service's `.air.toml`.

Create SQL migrations with:

```bash
make create-migration service=identity name=add_example_table
```

This uses `golang-migrate` style files in `<service>/database/migrations`.

## Backend Conventions

- Service entry points live in `cmd/api/main.go`.
- HTTP routers live in `internal/router/router.go`.
- Resource code is grouped under `internal/resource/<name>/`.
- Shared error responses use `shared/pkg/err` and RFC-style problem JSON.
- Shared config comes from `shared/pkg/config` with service prefixes such as `IDENTITY_` and `BUDGET_`.
- Identity migrations run at startup via `shared/pkg/database.Migrate("file://./database/migrations", ...)`.
- Budget uses the same Postgres DSN style as Identity.
- Identity tables should be schema-qualified under `identity.*`.
- Budget tables should be schema-qualified under `budget.*`.
- Auth currently uses opaque access and refresh tokens stored as SHA-256 hashes in `identity.sessions`.
- User registrations default to `status=pending` and `role=user`.
- Admin-only operations currently include updating users and managing modules.
- Local dev may seed an active admin via `IDENTITY_SEED_DEMO_USER=true`. Production should leave seed flags disabled and run migrations only.

Watch for current inconsistencies:

- `docs/db/migrations.md` references Goose and `internal/db/migrations`, but current code and the `Makefile` use `golang-migrate` and `database/migrations`.
- The code is still physically split into service modules, while the target architecture is a modular monolith with separate feature folders.
- The budget service is still mostly scaffolded and has no resource routes.
- Budget implementation should start with a narrow domain slice, but it must preserve the monthly snapshot requirement for recurring expense definitions. Do not model recurring fixed costs or subscriptions in a way that mutates historical months in place.

## Frontend Conventions

- The frontend is Next.js App Router under `clients/web/src/app`.
- Use shadcn/ui components from `clients/web/src/components/ui`.
- Do not hand-roll buttons, inputs, selects, alerts, cards, tabs, navigation controls, or form controls directly in feature pages when a shadcn/ui component or a shared local wrapper exists. Put reusable UI patterns in a shared component area and reuse them.
- Keep browser-side backend access behind `clients/web/src/lib/api.ts`.
- Use the Next route proxy for Identity/Budget calls to avoid local-network CORS issues.
- Slice/module toggles are driven by Identity modules. Active and enabled modules determine navigation visibility.
- Do not show an "Active slices" dashboard/card/list on user-facing pages. Active slices are a navigation/availability concern, not page content.
- Dashboard subnavigation must be integrated into the sidebar as a real dashboard-style nested navigation. Do not implement slice subnavigation as loose buttons/tabs floating in page content.
- Keep the sidebar, account entry, and admin settings entry singular and visually coherent. Do not duplicate Account/Admin controls between header and sidebar in a way that makes the page feel like two competing navigation systems.
- Use a clear, readable primary UI font. Avoid decorative serif/display fonts as the global app font; reserve them only for deliberate brand moments if explicitly requested.
- Admin and account settings should look like first-class settings screens, not temporary cards dropped into content. Keep settings layout consistent with the dashboard navigation model and avoid duplicated controls.

## Testing Status

There are still only a few committed Go `_test.go` files and no committed frontend tests. Existing `make test`, `make build`, `make web-lint`, and `make web-build` should pass before handoff.

When adding behavior, add focused tests near the changed package or component. For backend handlers, prefer `httptest` plus fake or in-memory dependencies where possible. For pure shared helpers, use table-driven Go tests.

## Documentation Notes

The top-level `README.md` and several docs are sparse or stale. Treat code, `Makefile`, and Compose files as the source of truth until docs are refreshed.
