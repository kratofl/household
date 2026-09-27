"use client"

// The Budget module's contribution to the widget boards: one definition per
// card, used both on the Budget overview and on the global dashboard. Widgets
// render their own heading; the board adds the frame.

import type { WidgetDefinition } from "@/components/app/widget-board"
import { Block, Disclosure, Group, IconTile, Meter, Row } from "@/components/app/grouped"
import { KpiCard } from "@/components/app/kpi-card"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/lib/i18n"
import { budgetViews, moduleCatalog } from "@/lib/modules"

import { categoryVisual } from "./category-visuals"
import type { useMonthlyBudget } from "./controller"
import type { MonthlyCopy } from "./copy"
import type { ExpenseIntent } from "./expense-editor"
import { ExpenseRow } from "./expense-history"
import { Forecast } from "./plan-editor"
import type { MonthlyState } from "./types"

type Presentation = NonNullable<ReturnType<typeof useMonthlyBudget>["presentation"]>

export type BudgetWidgetContext = {
  state: MonthlyState
  view: Presentation
  copy: MonthlyCopy
  locale: Locale
  busy: boolean
  /** Absent on the global dashboard, where the expense editor is not mounted. */
  openExpense?: (intent: ExpenseIntent) => void
}

/**
 * Every Budget widget, in the order the default boards use them. Returns an
 * empty list until the period summary exists, so a fresh budget shows nothing
 * rather than a row of zeroes.
 */
export function budgetWidgets(context: BudgetWidgetContext): WidgetDefinition[] {
  const { state, view, copy, busy } = context
  const group = moduleCatalog.budget.name[context.locale]
  const summary = state.summary
  if (!summary) return []
  const allArchived = state.categories.every((category) => category.archived)
  const spendable = context.openExpense && !busy && !allArchived ? context.openExpense : undefined

  return [
    {
      id: "budget.remaining",
      title: copy.remaining,
      w: 3,
      h: 3,
      group,
      render: () => (
        <KpiCard
          label={copy.remaining}
          value={view.fun}
          negative={summary.funRemainingCents < 0}
          meter={{ fraction: view.usedFraction, marker: view.pace, label: copy.paceNote }}
          delta={{
            text: summary.deficitCarryoverCents > 0
              ? `${copy.deficit}: ${view.deficit}`
              : `${copy.spent} ${view.spent} · ${copy.starting} ${view.starting}`,
            tone: summary.deficitCarryoverCents > 0 ? "negative" : "neutral",
          }}
        />
      ),
    },
    {
      id: "budget.savings",
      title: copy.totalSaved,
      w: 3,
      h: 3,
      group,
      render: () => (
        <KpiCard
          label={copy.totalSaved}
          value={view.savings}
          delta={{ text: `${copy.plannedSavings}: ${view.contribution}`, tone: "neutral" }}
          action={
            spendable ? (
              <Button size="sm" variant="secondary" className="h-auto min-h-7 max-w-full py-1.5 whitespace-normal" onClick={() => spendable({ kind: "add", source: "savings" })}>
                {copy.spendSavings}
              </Button>
            ) : null
          }
        />
      ),
    },
    {
      id: "budget.buffer",
      title: copy.buffer,
      w: 3,
      h: 3,
      group,
      render: () => <KpiCard label={copy.buffer} value={view.buffer} delta={{ text: copy.bufferNote, tone: "neutral" }} />,
    },
    {
      id: "budget.next",
      title: copy.next,
      w: 3,
      h: 3,
      group,
      render: () => <KpiCard label={copy.next} value={view.nextFun} delta={{ text: `${copy.from} ${view.nextStart}`, tone: "neutral" }} />,
    },
    {
      id: "budget.reserves",
      title: copy.reserved,
      w: 12,
      h: 5,
      group,
      render: () => (
        <Group title={copy.reserved} action={{ label: copy.openPlan, href: budgetViews.plan.route }}>
          {view.reserveCards.map((category) => {
            const visual = categoryVisual(category.name)
            return (
              <Row
                key={category.id}
                onClick={
                  spendable && !category.archived
                    ? () => spendable({ kind: "add", categoryId: category.id, source: "category" })
                    : undefined
                }
              >
                <IconTile icon={visual.icon} tone={visual.tone} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-medium">{category.name}</span>
                    <span className="tabular-nums">
                      {category.remaining} <span className="text-label-secondary">{copy.left}</span>
                    </span>
                  </div>
                  <Meter
                    className="mt-2"
                    fraction={category.reservedCents > 0 ? 1 - category.remainingCents / category.reservedCents : 0}
                  />
                </div>
                <Disclosure />
              </Row>
            )
          })}
          {view.reserveCards.length === 0 ? <Block className="text-label-secondary">{copy.emptyReserves}</Block> : null}
        </Group>
      ),
    },
    {
      id: "budget.recent",
      title: copy.recent,
      w: 12,
      h: 5,
      group,
      render: () => (
        <Group title={copy.recent} action={{ label: copy.showAll, href: budgetViews.expenses.route }}>
          {view.recent.length === 0 ? <Block className="text-label-secondary">{copy.emptyExpenses}</Block> : null}
          {view.recent.map((row) => (
            <ExpenseRow key={row.expense.id} row={row} copy={copy} showDate />
          ))}
        </Group>
      ),
    },
    {
      id: "budget.costs",
      title: copy.automaticCosts,
      w: 12,
      h: 4,
      group,
      render: () => (
        <Group title={copy.automaticCosts} footer={copy.automaticNote}>
          {summary.costs.map((cost) => (
            <Row key={cost.id}>
              <span className="flex-1">{cost.name}</span>
              <span className="tabular-nums text-label-secondary">{view.fmt.money(cost.amountCents)}</span>
            </Row>
          ))}
          {summary.costs.length === 0 ? <Block className="text-label-secondary">–</Block> : null}
        </Group>
      ),
    },
    {
      id: "budget.forecast",
      title: copy.forecast,
      w: 12,
      h: 8,
      group,
      render: () => <Forecast forecast={state.forecast} locale={context.locale} currency={state.currency} />,
    },
  ]
}

/** What the Budget overview shows before the user rearranges anything. */
export const budgetOverviewWidgets = [
  "budget.remaining",
  "budget.savings",
  "budget.buffer",
  "budget.next",
  "budget.reserves",
  "budget.recent",
  "budget.costs",
]

/**
 * The global dashboard starts with the numbers worth a glance, four KPIs in a
 * row: what is left and the three supporting figures. Then the reserves and the
 * last expenses.
 */
export const budgetDashboardWidgets = [
  "budget.remaining",
  "budget.savings",
  "budget.buffer",
  "budget.next",
  "budget.reserves",
  "budget.recent",
]
