# Budget Current-State Gap Analysis

- Baseline date: 2026-07-17
- Compared against: `docs/budget/product-definition.md` and accepted ADRs in
  `docs/decisions/`
- Purpose: establish the implementation gap without starting implementation

## Executive summary

The current Budget code is an early vertical prototype, not the completed slice
defined by the product interview. It proves authentication integration, basic
user ownership, current-month summary calculation, manual expense creation,
basic categories, and mutable monthly or yearly planned expenses. Most target
domain invariants and user journeys require new persistence, API, and frontend
work.

ADR 0040 is the largest architectural divergence: the target has one Budget
ledger per user and no modeled bank-account list, while the current schema and
every transaction or planned expense require an `account_id` and mutate an
account balance.

## What exists today

### Backend

`backend/internal/features/budget/` currently provides:

- authenticated, per-user Budget access;
- an automatically created calendar-month period;
- a summary endpoint;
- current-period limit and carryover update;
- category creation and update;
- planned fixed-cost or subscription creation, update, listing, and manual
  application to the current period;
- one-way manual expense creation; and
- summary, planned-expense, configuration, and migration unit tests.

Current routes are limited to summary, current-period patching, category create
and patch, planned-expense list/create/patch/apply-current, and transaction
creation. There is no transaction-list endpoint.

### Frontend

The web client currently exposes Budget overview, transactions, planning,
categories, and settings from a large `BudgetPanel` inside
`clients/web/src/components/app/app-shell.tsx`. Its API wrapper covers the same
narrow backend surface.

It can show summary values and submit basic expenses, period settings,
categories, and planned expenses. The earlier navigation extraction is only
partial; Budget feature UI remains embedded in the application shell.

## Material gaps

### 0. Backend platform migration

- Replace the current Go API with one .NET 10/ASP.NET Core modular monolith
  rather than adding a second Budget service.
- Recreate the existing Identity, authentication, module activation, platform,
  configuration, migration, health, and deployment behavior with verified
  functional parity.
- Use EF Core and PostgreSQL while preserving feature-owned schemas and explicit
  feature boundaries.
- Preserve existing users and migrate existing Budget records into the final
  ledger model without silent data loss.
- Update development, CI, container, deployment, and operational documentation
  only when the .NET runtime becomes the implementation source of truth.

### 1. Ledger and persistence model

- Remove the target-domain dependency on modeled bank accounts and required
  `account_id` values.
- Replace mutable account-balance updates with the single user Budget ledger and
  purpose balances defined by ADR 0040.
- Add traceable corrections, voids, refunds, Budget impact, status history, and
  opening allocations.
- Add transaction category splits with historical snapshots.

### 2. Period and availability calculation

- Replace calendar-month-only creation with the user-selected start-day model,
  including short-month clamping and prospective configuration changes.
- Replace freely stored spending limit as the source of truth with calculated
  ordinary spending availability.
- Add buffer targets, actual buffer, shortfall, disposition, overspend coverage,
  and deficit carryover rules.
- Distinguish forecast, actual, reserve coverage, transaction amount, and Budget
  impact.

### 3. Income

- Add one-time and versioned recurring income plans.
- Add expected and actual income, confirmation or automatic posting, variance,
  global routing defaults, and per-plan overrides.
- Add all agreed recurrence presets and Custom schedules.

### 4. Recurring commitments and reservations

- Replace mutable planned-expense rows with effective-dated plan versions and
  occurrence overrides.
- Add weekly, quarterly, daily where applicable, every-N schedules, multiple
  custom weekdays, clamped due dates, pause, stop, reminders, and explicit edit
  scope.
- Add per-item due-period versus gradual-reservation behavior.
- Add normal-cycle reservation, late-entry warnings, optional first-shortfall
  charging, and non-duplicated transaction Budget impact.
- Replace manual “apply current” as the primary model with expected-occurrence and
  posting state transitions.

### 5. Transactions, categories, and merchants

- Add timeline listing, search, filters, paging, detail, correction, void, refund,
  expected/actual matching, and status transitions.
- Add merchant identities, suggestions, user history, logo fallback, and category
  suggestions.
- Add category icons, versions, archival, historic behavior, and per-split Budget
  impact overrides.
- Remove the target requirement for a protected synthetic excluded category.

### 6. Saving, investing, and wishlist

- Add purpose balances, exclusive goal allocations, contribution splits, and
  opening allocations.
- Add date- and rate-driven goals, behind-plan projections, fully-funded and
  completed states, automatic contribution pause, and purchase funding.
- Add manual investment valuation snapshots, contribution/performance separation,
  and explicit withdrawal routing.
- Add the financially focused wishlist and promotion or linking to savings goals.

### 7. API and data portability

- Define and document the expanded HTTP contracts and stable language-neutral
  enums.
- Add staged CSV import, validation, mapping, duplicate review, commit, import
  history, and stable CSV exports.
- Ensure all writes enforce ownership and are idempotent where scheduling or
  automatic posting can retry.

### 8. Frontend information architecture

- Implement the agreed eight Budget sidebar destinations: Overview,
  Transactions, Planning, Saving & Investing, Wishlist, Categories, Reports, and
  Settings.
- Extract Budget workflows from `AppShell` into feature-owned components.
- Add functional first-use Budget setup.
- Add reports, in-app reminders, responsive full-function mobile layouts, and all
  required empty, loading, validation, and error states.
- Complete German and English copy and locale-aware formatting.

### 9. Quality coverage

- Add focused migration and domain tests for every historical, scheduling,
  allocation, rounding, correction, and calculation invariant.
- Add handler or API tests for ownership, validation, status transitions,
  idempotency, and CSV workflows.
- Add frontend and browser tests for critical user journeys; no frontend test
  files currently exist.
- Add accessibility and representative mobile verification.

## Documentation reconciliations

The following older descriptions are context, not the current target where they
conflict with accepted ADRs:

- The product notes in `AGENTS.md` mention connected accounts; direct bank
  connections remain deferred by ADR 0003, and current target behavior uses one
  Budget ledger per user under ADR 0040.
- The notes say deleted categories become uncategorized; ADR 0031 preserves their
  historical category snapshots instead.
- The notes describe a protected excluded category; ADR 0059 separates Budget
  impact from category identity and removes that target requirement.
- The earlier frontend navigation design under `docs/superpowers/specs/` predates
  Saving & Investing, Wishlist, Reports, and the final sidebar structure in
  ADR 0057.

## Verification performed

On 2026-07-17:

- `go test ./...` from `backend/` passed.
- Web lint and build were not run because `clients/web/node_modules` is absent;
  dependencies were not installed as part of this read-only audit.
- No frontend test files were found under `clients/web/`.
- `git diff --check` passed for the documentation changes.

Passing current backend tests establishes a clean starting baseline; it does not
cover the target capabilities listed above.
