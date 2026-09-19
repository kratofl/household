"use client"

// The Budget module's contribution to the widget boards: one definition per
// card, used both on the Budget overview and on the global dashboard. Widgets
// render their own heading; the board adds the frame.

import type { ReactNode } from "react"
import { IconChartBar, IconPigMoney, IconShieldCheck } from "@tabler/icons-react"

import type { WidgetDefinition } from "@/components/app/widget-board"
import { Block, Disclosure, Group, IconTile, Row, ThinBar } from "@/components/app/grouped"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/lib/i18n"
import { budgetViews, moduleCatalog } from "@/lib/modules"
import { cn } from "@/lib/utils"

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
      w: 12,
      h: 4,
      group,
      render: () => (
        <section className="surface-group p-5">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="font-medium text-muted-foreground">{copy.remaining}</p>
              <p
                className={cn(
                  "mt-0.5 text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums lg:text-[52px]",
                  summary.funRemainingCents < 0 && "text-destructive",
                )}
              >
                {view.fun}
              </p>
              {summary.deficitCarryoverCents > 0 ? (
                <p className="mt-2 text-muted-foreground">{copy.deficit}: {view.deficit}</p>
              ) : null}
            </div>
            <dl className="grid grid-cols-2 gap-x-8">
              <Stat label={copy.starting} value={view.starting} />
              <Stat label={copy.spent} value={view.spent} />
            </dl>
          </div>
          <ThinBar className="mt-5" fraction={view.usedFraction} marker={view.pace} />
          <p className="mt-1.5 text-[11px] text-muted-foreground">{copy.paceNote}</p>
        </section>
      ),
    },
    {
      id: "budget.savings",
      title: copy.totalSaved,
      w: 4,
      h: 3,
      group,
      render: () => (
        <MiniCard
          icon={IconPigMoney}
          color="var(--sys-green)"
          label={copy.totalSaved}
          value={view.savings}
          note={`${copy.plannedSavings}: ${view.contribution}`}
        >
          {spendable ? (
            <Button size="xs" variant="outline" onClick={() => spendable({ kind: "add", source: "savings" })}>
              {copy.spendSavings}
            </Button>
          ) : null}
        </MiniCard>
      ),
    },
    {
      id: "budget.buffer",
      title: copy.buffer,
      w: 4,
      h: 3,
      group,
      render: () => (
        <MiniCard icon={IconShieldCheck} color="var(--sys-blue)" label={copy.buffer} value={view.buffer} note={copy.bufferNote} />
      ),
    },
    {
      id: "budget.next",
      title: copy.next,
      w: 4,
      h: 3,
      group,
      render: () => (
        <MiniCard icon={IconChartBar} color="var(--sys-gray)" label={copy.next} value={view.nextFun} note={`${copy.from} ${view.nextStart}`} />
      ),
    },
    {
      id: "budget.reserves",
      title: copy.reserved,
      w: 12,
      h: 5,
      group,
      render: () => (
        <Group
          title={copy.reserved}
          action={{ label: copy.openPlan, href: budgetViews.plan.route }}
          footer={view.reserveCards.length === 0 ? copy.emptyReserves : undefined}
        >
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
                <IconTile icon={visual.icon} color={visual.color} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-medium">{category.name}</span>
                    <span className="tabular-nums">
                      {category.remaining} <span className="text-muted-foreground">{copy.left}</span>
                    </span>
                  </div>
                  <ThinBar
                    className="mt-1.5 h-1"
                    fraction={category.reservedCents > 0 ? 1 - category.remainingCents / category.reservedCents : 0}
                    color={visual.color}
                  />
                </div>
                <Disclosure />
              </Row>
            )
          })}
          {view.reserveCards.length === 0 ? <Block className="text-muted-foreground">{copy.emptyReserves}</Block> : null}
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
          {view.recent.length === 0 ? <Block className="text-muted-foreground">{copy.emptyExpenses}</Block> : null}
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
              <span className="tabular-nums text-muted-foreground">{view.fmt.money(cost.amountCents)}</span>
            </Row>
          ))}
          {summary.costs.length === 0 ? <Block className="text-muted-foreground">–</Block> : null}
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

/** The global dashboard starts with the few numbers worth a glance. */
export const budgetDashboardWidgets = ["budget.remaining", "budget.savings", "budget.buffer", "budget.recent"]

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function MiniCard({
  icon,
  color,
  label,
  value,
  note,
  children,
}: {
  icon: typeof IconPigMoney
  color: string
  label: string
  value: string
  note: string
  children?: ReactNode
}) {
  return (
    <div className="surface-group h-full p-4">
      <div className="flex items-center gap-2">
        <IconTile icon={icon} color={color} size={22} />
        <span className="font-medium">{label}</span>
      </div>
      <p className="mt-3 text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{note}</p>
        {children}
      </div>
    </div>
  )
}
