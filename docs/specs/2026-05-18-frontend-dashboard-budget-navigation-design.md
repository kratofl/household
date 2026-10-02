# Frontend Dashboard And Budget Navigation Design

## Context

Household is in the middle of a modular-monolith migration. The backend now lives under `backend/`, the web app is a Next.js App Router client under `clients/web/`, and feature activation is driven by Identity modules. The current web shell is functional but too large: `clients/web/src/components/app/app-shell.tsx` owns session hydration, navigation, login/register, admin settings, update checks, audit display, the general module view, Budget data loading, Budget forms, Budget charts, and alert state.

Product notes in iCloud Drive describe Budget as the first real slice, with a dashboard overview, expense categories, planned fixed costs and subscriptions, future month-safe recurring definitions, budget carryover, accounts, income, and savings planning. The current backend already exposes the first Budget slice through `/budget/summary`, `/budget/transactions`, `/budget/categories`, `/budget/periods/current`, and `/budget/planned-expenses`.

## Goals

- Add a real Household dashboard at `/` with key figures from active slices.
- Stop redirecting `/` to the first active module.
- Give Budget its own subnavigation and split the current single Budget surface into focused views.
- Keep active module visibility controlled by Identity modules.
- Fix persistent alert boxes by scoping alerts to their owning view or clearing global alerts on route changes.
- Keep this UI-first: reuse existing backend endpoints and avoid new backend tables or dashboard endpoints in this pass.
- Extract feature-owned UI, API, and types out of `AppShell` so future slices can be added without growing the shell.

## Non-Goals

- Do not implement new Budget backend domain concepts such as income, savings plans, month-start rules, or recurring definition snapshots in this pass.
- Do not introduce a new `/dashboard/summary` backend endpoint yet.
- Do not replace shadcn `Alert` with a toast system yet.
- Do not change Identity module activation semantics.
- Do not refactor unrelated backend or deployment code.

## Routing

The web app should support these user-facing routes:

```text
/                    Household Dashboard
/budget              Budget Dashboard
/budget/transactions Expense entry and transaction-focused workflow
/budget/planning     Fixed costs, subscriptions, and apply-current-month workflow
/budget/categories   Category names, colors, and behavior
/budget/settings     Current period limit and carryover settings
/account             Account and password settings
/settings            Admin settings
```

Budget subroutes are part of Budget, not standalone slices. Direct access to an inactive slice route should show the existing inactive-area state instead of rendering the feature.

## Architecture

`AppShell` should become a shell, not a feature container. It remains responsible for:

- session hydration and logout,
- locale and theme controls,
- loading Identity modules,
- global layout, header, and main navigation,
- admin/settings and account surfaces until they are split later,
- explicitly global alert state.

Budget should move into `clients/web/src/features/budget/`:

```text
clients/web/src/features/budget/
  api.ts
  types.ts
  budget-layout.tsx
  budget-dashboard-page.tsx
  transactions-page.tsx
  planning-page.tsx
  categories-page.tsx
  settings-page.tsx
  budget-summary-card.tsx
  budget-limit-chart.tsx
  budget-forms.tsx
```

The Household dashboard should live under `clients/web/src/features/dashboard/`:

```text
clients/web/src/features/dashboard/
  dashboard-page.tsx
  household-metrics.tsx
  slice-summary.ts
```

Shared shell/navigation pieces should move under `clients/web/src/components/app/`:

```text
clients/web/src/components/app/
  app-shell.tsx
  main-nav.tsx
  section-header.tsx
  global-alerts.tsx
```

The implementation may consolidate small files if the code stays clearer, but feature UI and Budget API/types should not remain embedded in `AppShell`.

## Household Dashboard

`/` renders a general Household overview. It should only include active and enabled slices. For the current product state, Budget is the only slice with live metrics, so the Budget card can use `/budget/summary` and show:

- monthly limit,
- spending counted toward the limit,
- remaining budget,
- total account balance.

Other active-but-not-implemented slices should be represented conservatively. They can appear as active slice cards with module metadata, but they should not pretend to have live metrics.

If no slices are active, `/` should show a useful empty state explaining that modules can be activated in Admin Settings.

## Budget Views

`/budget` is an overview page. It should focus on scanning, not data entry:

- current period,
- monthly limit,
- spent,
- remaining,
- account balance,
- category spending chart,
- planned expense status summary.

`/budget/transactions` owns new expense entry and transaction-related controls currently embedded in the monolithic Budget panel. If the backend does not expose a transaction list yet, the page should still support expense entry and use summary/category/account context.

`/budget/planning` owns fixed costs and subscriptions. It should keep the current apply-current-month behavior and editing controls.

`/budget/categories` owns category creation and editing. It should preserve protected-category behavior from the current UI.

`/budget/settings` owns current month settings such as monthly limit and overspend carryover.

Budget subnavigation should be visible on Budget routes on desktop and mobile. The active subroute should be visually distinct.

## Data Flow

Budget data access should move behind a small frontend API layer:

- `loadBudgetSummary(accessToken)` calls `GET /budget/summary`.
- `createBudgetTransaction(accessToken, payload)` calls `POST /budget/transactions`.
- `updateCurrentBudgetPeriod(accessToken, payload)` calls `PATCH /budget/periods/current`.
- `createBudgetCategory(accessToken, payload)` calls `POST /budget/categories`.
- `updateBudgetCategory(accessToken, id, payload)` calls `PATCH /budget/categories/{id}`.
- `createPlannedExpense(accessToken, payload)` calls `POST /budget/planned-expenses`.
- `updatePlannedExpense(accessToken, id, payload)` calls `PATCH /budget/planned-expenses/{id}`.
- `applyCurrentPlannedExpenses(accessToken)` calls `POST /budget/planned-expenses/apply-current`.

Budget types should move to `features/budget/types.ts`.

The dashboard slice-summary interface should allow future slices to expose cards without changing the shell. Budget can be the first concrete implementation. Unsupported slices should return module metadata only, not fake numeric data.

## Alert Behavior

Alerts should not persist after unrelated navigation.

- Login/register alerts remain local to the unauthenticated login screen.
- Global shell alerts are reserved for global actions and are cleared on `pathname` changes.
- Budget alerts live inside Budget views or shared Budget state and are reset when switching Budget pages.
- Admin settings alerts can remain shell-level for now, but they should also clear on route changes.

This fixes the current bug where an alert shown by one page is still visible after navigating to another page.

## Testing And Verification

Before handoff:

- Run `npm run lint` from `clients/web/`.
- Run `npm run build` from `clients/web/`.
- Manually verify `/`, `/budget`, `/budget/transactions`, `/budget/planning`, `/budget/categories`, `/budget/settings`, `/account`, and `/settings`.
- Verify that an alert shown on one route disappears after navigating to another route.

Backend tests are not required unless the implementation changes backend behavior.

## Implementation Notes

Keep the implementation compatible with the existing dirty working tree. Do not revert unrelated changes. Move code in small steps so the app remains buildable after each step. Prefer extracting existing behavior before redesigning behavior. Keep UI copy in `src/lib/i18n.ts` and keep module visibility anchored in `src/lib/modules.ts` and Identity module data.
