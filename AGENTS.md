# Household

Household is a local-network-first, self-hosted household management app: one Docker
Compose stack with a Next.js web UI, a .NET 10 modular-monolith API, an updater
sidecar, and PostgreSQL. Budget is the first complete feature slice; shopping lists,
recipes, meal planning, calendar, and waste schedule are planned. It runs on a home
server for one household, so install reliability, safe defaults, and honest docs
matter as much as features.

These are good defaults, not hard rules. The developer's instructions in conversation
override anything here. If a rule fights the task in front of you, say so and get a
sign-off before breaking it.

## What we do not compromise on

1. **Financial history is append-only.** Actual transactions are corrected or voided,
   never edited in place or deleted. Recurring plans are versioned by effective date,
   and past occurrences keep the values that produced them. A report about a past
   period must give the same answer next year.
2. **Money is exact.** Amounts are integer cents. Nothing financial passes through
   binary floating point. Category splits must sum exactly to their transaction.
3. **Data is user-owned and authenticated.** Every Budget row belongs to one user.
   Identity decides who the user is; features never trust a client-supplied user id.
   Registration defaults to `pending` / `user` and admin-gated behavior stays intact.
4. **Self-hosted, local-network-first.** Core workflows need no cloud service. The
   stack installs from published images with a `.env` and nothing else.
5. **German and English, desktop and mobile, keyboard-operable.** Every user-facing
   string exists in both languages (`npm run check:i18n` enforces it), every workflow
   works on a phone, and every control is reachable without a mouse.

## Glossary

Shared vocabulary for talking about the code. The full Budget glossary with every
term is `docs/budget/glossary.md`; the ADRs in `docs/decisions/` are normative for
intended Budget behavior.

| Term | Meaning |
| --- | --- |
| Feature | A module under `Features/<Feature>` that owns its entities, `DbContext`, migrations, and endpoints. Identity, Budget, Audit, Updates. |
| Module (Identity) | A product area an admin can enable; active modules drive navigation visibility in the web UI. |
| Ledger | The dated, authoritative record of one user's actual Budget activity. Historical totals derive from it. |
| Ledger entry / split | One actual transaction and its categorized monetary portions. Splits sum exactly to the entry. |
| Correction / void | The only ways to change an actual transaction. The original stays; reports use the corrected state once. |
| Recurring plan | A dated rule for expected income or a commitment. Produces occurrences; changing it never rewrites the past. |
| Plan version | The immutable values of a plan for one effective-date range. Every edit creates a new version. |
| Occurrence | One dated realization of a plan, frozen with the values that applied when it was produced. |
| Posting | Turning an occurrence into a ledger entry, manually or by automatic posting when the plan allows it. |
| Budget period | The user's monthly interval, starting on a user-selected day. Late start days clamp in short months. |
| Budgeting mode | Per commitment: due-period budgeting or gradual reservation across periods. Effective-dated. |
| Buffer | Income withheld from ordinary spending. At period close its disposition is retained, allocated, or released. |
| Availability | The calculated ordinary spending amount for a period after commitments, reservations, allocations, buffer, and carryover. |
| Budget impact | How much a transaction or reservation changes availability. Separate from its amount so reserved expenses are not charged twice. |
| Allocation | Money moved from availability to a savings goal or investment. A change of purpose, not consumption. |
| Income variance | Expected minus actual income for a period. Positive variance is routed by configurable rules. |
| Monthly plan | The simplified single-plan model in `Features/Budget/Monthly` that everyday budgeting follows. See `docs/budget/monthly-budget-preview.md`. |
| Worktree stack | This checkout's own Compose project (`household-dev-<folder>-<hash>`) with its own API, web, database, and volume. |

## The ways to hurt yourself

1. **Production targets.** `make prod-*` and `.\make.ps1 prod-*` read `deployments/.env`
   and act on the production Compose stack. If that file is configured on this machine,
   they touch a real home server. Never run them unless explicitly asked. Development
   never reads `deployments/.env`.
2. **Destructive data commands.** `reset-dev-db` deletes this worktree's volumes.
   `prod-restore` overwrites production data. Data flows into a worktree, never out of
   it.
3. **Stopping the wrong stack.** Every worktree's containers are named `household-dev-*`.
   Stop yours with `make dev-down`, never with `docker rm` or `docker stop` by name
   pattern. Kill processes only by a PID you captured yourself.
4. **Two Watch sessions.** Do not run `make dev` twice in one worktree; the sync loops
   fight. If a stack is already up, use `make dev-info`.
5. **Environment files.** Do not edit `.env` or other local environment files unless
   asked.

## Hit every surface

The most common defect is a change that works on the path you tested and is missing
everywhere else. Before calling work done, walk this list and say which entries applied:

- **Task runners.** Every Makefile target has a `make.ps1` twin, including help text.
  `scripts/dev.sh` is shared by both; put shell logic there, not in the Makefile.
- **Languages.** Every string in German and English. Locale-aware dates and money.
- **Backend seam.** A new endpoint needs a client function in `clients/web/src/lib/api.ts`.
  Browser code never calls the API directly; the Next route proxy forwards `/api/backend/*`.
- **Migrations.** Inside the owning feature, history in the owning schema. Migrations run
  on API startup and must be additive-safe for existing installs.
- **Reverse states.** Archive needs restore, pause needs resume, stop needs a visible
  stopped state, a wishlist promotion needs a way to see where it went.
- **UI states.** Loading, empty, validation, conflict, success, error. Mobile layout and
  keyboard operation.
- **Docs.** `docs/configuration.md` when env vars change; install and update docs when
  the Compose stack changes; `docs/db/migrations.md` when migration conventions change.

## Dev stack

- `make dev` (or `.\make.ps1 dev`) builds and starts this worktree's isolated stack and
  watches source changes. `make dev-info` prints the URL; the port is Docker-assigned
  and can change on recreation. Sign in with `admin` / `admin`.
- `make dev-down` stops the stack and keeps data. Host-side checks and migration
  generation need .NET 10 and Node.js; run `make bootstrap` once.
- Backend tests spawn their own PostgreSQL container through Docker, independent of the
  worktree database. Docker must be running.
- An empty database is a bad test for UI work. `make seed-dev BACKUP=<file>` restores a
  Postgres dump from `make prod-backup` into this worktree's database. Copy in, never
  out. See `docs/development/local-setup.md`.
- The Playwright specs under `clients/web/e2e` currently have no runner or `stack`
  helper. Do not count them as verification.

## Verifying

- Smallest proof that the change works: `dotnet build`, `dotnet test --filter`, or
  `npm run lint` for the scope you changed. `make check` is the pre-PR gate, and CI owns
  the full suite; do not run it after every edit.
- Test public behavior at the authenticated HTTP seam. Use focused domain tests only for
  combinatorial logic such as recurrence, availability, or split allocation. Do not write
  tests that mirror the implementation or only assert wiring.
- Use `TimeProvider` for anything time-dependent so tests can pin the clock.
- C# style is part of the build (`backend/.editorconfig`): no `var`, `this.` on instance
  member access, `_camelCase` private fields. `dotnet format style Household.slnx` fixes
  most violations; rerun it until it reports no changes.
- Never call work done without verifying it. Say explicitly what you did not verify.

## Pull requests

- Never open a PR unless the developer asks. Open real PRs, not drafts.
- Title says what changed for a user or maintainer and why, in plain language.
- Body: the problem in a sentence or two, then how you fixed it. Call out migrations,
  config changes, breaking changes, and operational follow-up. UI changes need
  before/after screenshots.
- One concern per PR. If the description says "also", split it.
- Branch names: `feature/`, `enhancement/`, `bug/`, `chore/`, `docs/`.

## Documentation

Most code changes do not need a documentation change. Agents can read the code.

- `docs/decisions/` holds ADRs. They are normative for Budget behavior; when a decision
  changes, add a superseding ADR rather than editing the old one.
- `docs/budget/` holds product vocabulary and definitions. `docs/specs/` holds the
  accepted feature specs. Code and migrations are implementation truth.
- `docs/architecture.md`, `docs/db/`, and `docs/development/` explain constraints and
  traps a maintainer would get wrong from the source alone. Before adding a paragraph,
  ask what would go wrong without it. Do not narrate control flow or catalog files.
- `docs/install/`, `docs/operations/`, and `docs/configuration.md` help someone run the
  stack. Keep them in the shipped product's voice and update them when behavior changes.
- When a documented decision changes, rewrite the affected text. Do not append a second
  account of the new behavior.
- Do not commit implementation plans, research notes, design explorations, or agent
  scratch files. `.plans/` is gitignored for that purpose. A merged PR is the record.

## How it works

One ASP.NET Core process hosts feature modules under `Features/<Feature>`. Each feature
owns its `DbContext`, EF Core migrations, entities, application behavior, and endpoint
mapping; PostgreSQL stays one database with feature-owned schemas (`identity`, `budget`,
`audit`). A feature may call another feature's explicit internal interface, never its
tables. Identity issues opaque access and refresh sessions and exposes the current-user
interface everyone else uses.

Budget keeps a ledger of actual entries and splits. Recurring income plans and
commitments produce occurrences through projectors; postings turn occurrences into ledger
entries; the availability calculation and period close derive what is spendable, with
buffer disposition decided at close. Savings goals and investments are allocations out of
availability. Everyday budgeting follows the simplified monthly plan in
`Features/Budget/Monthly` on top of this model.

The web client is a Next.js App Router app. `src/lib/api.ts` is the only place that talks
to the backend, through the route proxy. Views render state and raise intent; shadcn/ui
primitives live in `src/components/ui`.

## Where code lives

- `backend/src/Household.Api/Program.cs` - host and feature registration.
- `backend/src/Household.Api/Features/<Feature>/` - Identity, Budget, Audit, Updates.
- `backend/src/Household.Api/Platform/` - hosting, configuration, problem responses,
  migration orchestration. Only genuinely cross-cutting code.
- `backend/src/Household.Updater/` - internal updater sidecar.
- `backend/tests/Household.Api.Tests/` - HTTP and migration tests against real
  PostgreSQL, plus focused domain tests.
- `clients/web/src/lib/api.ts` - typed backend client. `src/features/` - feature UI.
  `src/components/ui/` - shadcn/ui primitives.
- `deployments/` - Compose files, `dev.env`, observability config, `backups/`.
- `scripts/dev.sh` - shared implementation of the development targets.

## Common commands

```bash
make bootstrap                    # restore .NET and npm dependencies
make dev / dev-info / dev-down    # this worktree's stack
make seed-dev BACKUP=<file>       # restore a dump into this worktree's database
make backend-build                # includes style enforcement
make backend-test
make web-lint / web-build
make check                        # everything CI runs; use before a PR
make create-migration feature=budget name=AddExample
```

Windows PowerShell uses `.\make.ps1 <target>` with the same names.

## Taste

- Complexity belongs at the boundary: parsers, CSV import, HTTP adapters, the updater.
  Orchestration stays pure and testable without I/O. UI stays dumb.
- Prefer existing patterns over new abstractions. YAGNI: no config knobs or plugin
  systems nobody asked for.
- TypeScript: `any` is the enemy, no assertions to silence errors, discriminated unions
  over optional-field soup, `unknown` at the edges narrowed once.
- C#: records for data, classes for behavior, async all the way with
  `CancellationToken`, pattern matching over cast chains, `using` declarations. Public
  JSON is camelCase with language-neutral enum values; errors are problem JSON.
- Web UI: use shadcn/ui primitives, do not rebuild common controls in feature pages.
  Dashboard subnavigation is nested sidebar navigation, not page-level tab rows. Do not
  render an "Active slices" card; active modules only control navigation. Keep Account
  and Admin as single, coherent entries. No decorative display fonts as the app font.
  No continuously repainting animations.
- Comments describe how a thing is used and move with the code. Keep them current.
- Use `rg` for searching. Do not commit generated output, caches, logs, backups, or
  `node_modules`. Treat existing working-tree changes as user-owned unless the task
  clearly owns them.
