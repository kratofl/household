# Frontend Dashboard And Budget Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the current monolithic web shell into a real Household dashboard plus feature-owned Budget pages with subnavigation and route-scoped alerts.

**Architecture:** Keep `AppShell` as the authenticated layout and session owner, but extract Budget types/API/UI into `clients/web/src/features/budget` and the Household dashboard into `clients/web/src/features/dashboard`. Use App Router routes for `/`, `/budget`, `/budget/transactions`, `/budget/planning`, `/budget/categories`, and `/budget/settings`; route pages stay thin and render through the shell.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, Tailwind CSS 4, shadcn/ui components, Recharts, existing `/api/backend/*` proxy.

---

### Task 1: Route And Module Helpers

**Files:**
- Modify: `clients/web/src/lib/modules.ts`
- Modify: `clients/web/src/app/[section]/page.tsx`
- Create: `clients/web/src/app/budget/[view]/page.tsx`

- [ ] **Step 1: Add Budget view metadata**

Add exported Budget subroute metadata to `clients/web/src/lib/modules.ts`:

```ts
export const budgetViews = {
  overview: { route: "/budget", segment: "", labelKey: "budget.nav.overview" },
  transactions: { route: "/budget/transactions", segment: "transactions", labelKey: "budget.nav.transactions" },
  planning: { route: "/budget/planning", segment: "planning", labelKey: "budget.nav.planning" },
  categories: { route: "/budget/categories", segment: "categories", labelKey: "budget.nav.categories" },
  settings: { route: "/budget/settings", segment: "settings", labelKey: "budget.nav.settings" },
} as const

export type BudgetViewKey = keyof typeof budgetViews

export function budgetViewFromPath(pathname: string): BudgetViewKey {
  const match = Object.entries(budgetViews).find(([, view]) => view.route === pathname)
  return (match?.[0] as BudgetViewKey | undefined) ?? "overview"
}
```

- [ ] **Step 2: Make static section routes include only top-level sections**

Keep `clients/web/src/app/[section]/page.tsx` as the catch-all for top-level sections. It should not try to generate Budget subroutes.

- [ ] **Step 3: Add static Budget subroute page**

Create `clients/web/src/app/budget/[view]/page.tsx`:

```tsx
const budgetViews = ["transactions", "planning", "categories", "settings"]

export const dynamicParams = false

export function generateStaticParams() {
  return budgetViews.map((view) => ({ view }))
}

export default function BudgetViewPage() {
  return null
}
```

- [ ] **Step 4: Verify route metadata compiles**

Run: `cd clients/web && npm run lint`

Expected: lint either passes or reports only pre-existing issues unrelated to these helpers. Fix helper-related issues before continuing.

### Task 2: Budget API And Types Extraction

**Files:**
- Create: `clients/web/src/features/budget/types.ts`
- Create: `clients/web/src/features/budget/api.ts`
- Modify: `clients/web/src/components/app/app-shell.tsx`

- [ ] **Step 1: Move Budget types**

Move `BudgetPeriod`, `BudgetCategory`, `BudgetAccount`, `PlannedExpense`, and `BudgetSummary` from `app-shell.tsx` into `features/budget/types.ts`, exporting each type.

- [ ] **Step 2: Create Budget API wrapper**

Create `features/budget/api.ts` with functions wrapping existing endpoints:

```ts
import { apiRequest } from "@/lib/api"
import type { BudgetCategory, BudgetSummary, PlannedExpense } from "./types"

export function loadBudgetSummary(accessToken: string) {
  return apiRequest<BudgetSummary>("/budget/summary", { accessToken })
}

export function createBudgetTransaction(accessToken: string, body: unknown) {
  return apiRequest("/budget/transactions", { method: "POST", accessToken, body })
}

export function updateCurrentBudgetPeriod(accessToken: string, body: unknown) {
  return apiRequest("/budget/periods/current", { method: "PATCH", accessToken, body })
}

export function createBudgetCategory(accessToken: string, body: Pick<BudgetCategory, "name" | "color" | "behavior">) {
  return apiRequest("/budget/categories", { method: "POST", accessToken, body })
}

export function updateBudgetCategory(accessToken: string, id: string, body: Pick<BudgetCategory, "name" | "color" | "behavior">) {
  return apiRequest(`/budget/categories/${id}`, { method: "PATCH", accessToken, body })
}

export function createPlannedExpense(accessToken: string, body: unknown) {
  return apiRequest("/budget/planned-expenses", { method: "POST", accessToken, body })
}

export function updatePlannedExpense(accessToken: string, id: string, body: unknown) {
  return apiRequest(`/budget/planned-expenses/${id}`, { method: "PATCH", accessToken, body })
}

export function applyCurrentPlannedExpenses(accessToken: string) {
  return apiRequest("/budget/planned-expenses/apply-current", { method: "POST", accessToken })
}
```

- [ ] **Step 3: Update imports**

Import Budget types and API functions into `app-shell.tsx`, replacing inline type definitions and direct `apiRequest` calls in Budget code.

- [ ] **Step 4: Verify**

Run: `cd clients/web && npm run lint`

Expected: no new type or lint errors from extracted Budget types/API.

### Task 3: Household Dashboard Feature

**Files:**
- Create: `clients/web/src/features/dashboard/dashboard-page.tsx`
- Create: `clients/web/src/features/dashboard/household-metrics.tsx`
- Modify: `clients/web/src/components/app/app-shell.tsx`
- Modify: `clients/web/src/lib/i18n.ts`

- [ ] **Step 1: Add i18n keys**

Add German and English keys for:

```ts
"dashboard.title"
"dashboard.description"
"dashboard.noActiveSlicesTitle"
"dashboard.noActiveSlicesDescription"
"dashboard.budgetCardTitle"
"dashboard.budgetCardDescription"
"dashboard.sliceUnavailable"
```

- [ ] **Step 2: Create dashboard page component**

Create a client component that receives `accessToken`, `modules`, `locale`, and `t`, then loads Budget summary only when Budget is active. It renders active slice cards and Budget metrics from live summary.

- [ ] **Step 3: Render dashboard at `/`**

In `app-shell.tsx`, remove the redirect from `/` to the first active module and render `DashboardPage` when `pathname === "/"`.

- [ ] **Step 4: Verify**

Run: `cd clients/web && npm run lint`

Expected: dashboard imports and i18n keys are valid.

### Task 4: Budget Feature Pages And Subnavigation

**Files:**
- Create: `clients/web/src/features/budget/budget-layout.tsx`
- Create: `clients/web/src/features/budget/budget-dashboard-page.tsx`
- Create: `clients/web/src/features/budget/transactions-page.tsx`
- Create: `clients/web/src/features/budget/planning-page.tsx`
- Create: `clients/web/src/features/budget/categories-page.tsx`
- Create: `clients/web/src/features/budget/settings-page.tsx`
- Create: `clients/web/src/features/budget/budget-limit-chart.tsx`
- Modify: `clients/web/src/components/app/app-shell.tsx`
- Modify: `clients/web/src/lib/i18n.ts`

- [ ] **Step 1: Add Budget nav i18n keys**

Add German and English keys for:

```ts
"budget.nav.overview"
"budget.nav.transactions"
"budget.nav.planning"
"budget.nav.categories"
"budget.nav.settings"
"budget.dashboardTitle"
"budget.dashboardDescription"
```

- [ ] **Step 2: Extract Budget layout**

Create `BudgetLayout` with the subnavigation, shared summary loading, local error state, and route selection via `budgetViewFromPath(pathname)`.

- [ ] **Step 3: Split Budget views**

Move existing Budget UI chunks into route-specific components:

- overview metrics and chart into `budget-dashboard-page.tsx`,
- new transaction form into `transactions-page.tsx`,
- planned expense controls into `planning-page.tsx`,
- category controls into `categories-page.tsx`,
- period limit/carryover controls into `settings-page.tsx`.

- [ ] **Step 4: Wire AppShell**

Replace the old monolithic `BudgetPanel` rendering with `BudgetLayout` for Budget routes.

- [ ] **Step 5: Verify**

Run: `cd clients/web && npm run lint`

Expected: no JSX/type errors from the split.

### Task 5: Alert Lifecycle Fix

**Files:**
- Modify: `clients/web/src/components/app/app-shell.tsx`
- Modify: `clients/web/src/features/budget/budget-layout.tsx`

- [ ] **Step 1: Clear shell alerts on route changes**

Add a route-change effect in `AppShell`:

```ts
useEffect(() => {
  setError(null)
  setMessage(null)
}, [pathname])
```

Keep login/register behavior intact because the unauthenticated screen does not route through the app surface.

- [ ] **Step 2: Clear Budget alerts on subroute changes**

In `BudgetLayout`, reset local Budget error when the selected Budget view changes.

- [ ] **Step 3: Verify manually**

Start the dev server and navigate between routes after producing a validation error. The alert should disappear on the next route.

### Task 6: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Lint**

Run: `cd clients/web && npm run lint`

Expected: PASS.

- [ ] **Step 2: Build**

Run: `cd clients/web && npm run build`

Expected: PASS.

- [ ] **Step 3: Browser smoke test**

Run: `cd clients/web && npm run dev`

Open the local URL and verify:

- `/` renders Household dashboard,
- `/budget` renders Budget overview,
- `/budget/transactions` renders expense entry,
- `/budget/planning` renders planned expenses,
- `/budget/categories` renders categories,
- `/budget/settings` renders current-period settings,
- `/account` still renders account settings,
- `/settings` still renders admin settings,
- alerts disappear after route changes.
