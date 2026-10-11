"use client"

// The Budget module's contribution to the widget boards: one definition per
// card, used both on the Budget overview and on the global dashboard. Widgets
// render their own card at the full height of their board row, so cards in one
// row line up; the controller's presentation has already worked out every number.

import { IconAlertTriangle, IconCalendarEvent, IconPigMoney, IconReceipt, IconRepeat, IconShield } from "@tabler/icons-react"

import { PaceChart, PeriodTrendChart } from "@/components/app/charts"
import { Block, Disclosure, Group, IconTile, Row } from "@/components/app/grouped"
import { HeroMetric } from "@/components/app/hero-metric"
import { MetricStrip, type MetricCell } from "@/components/app/metric-strip"
import type { WidgetDefinition } from "@/components/app/widget-board"
import type { WidgetPosition } from "@/components/app/widget-layout"
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

/** Lets a Group card fill its board cell, so cards in one row share their height. */
const fullHeight = "h-full *:h-full"

/**
 * Every Budget widget. Returns an empty list until the period summary exists, so
 * a fresh budget shows nothing rather than a row of zeroes.
 */
export function budgetWidgets(context: BudgetWidgetContext): WidgetDefinition[] {
  const { state, view, copy, busy } = context
  const group = moduleCatalog.budget.name[context.locale]
  const { hero, upcoming } = view
  if (!state.summary || !hero || !upcoming) return []
  const allArchived = state.categories.every((category) => category.archived)
  const spendable = context.openExpense && !busy && !allArchived ? context.openExpense : undefined

  return [
    {
      id: "budget.hero",
      title: copy.remaining,
      w: 8,
      h: 6,
      group,
      render: () => (
        <HeroMetric
          label={copy.remaining}
          value={hero.value}
          negative={hero.negative}
          supporting={
            <>
              {hero.parts.join(" · ")}
              {hero.perDay ? <> · <strong>{hero.perDay}</strong></> : null}
            </>
          }
          status={hero.status ? { label: hero.status, icon: IconAlertTriangle } : undefined}
        >
          <PaceChart {...hero.chart} formatMoney={view.fmt.money} formatTick={view.fmt.whole} height={210} />
        </HeroMetric>
      ),
    },
    {
      id: "budget.upcoming",
      title: copy.upcoming,
      w: 4,
      h: 6,
      group,
      render: () => (
        <Group title={copy.upcoming} action={{ label: copy.plan, href: budgetViews.plan.route }} className={fullHeight}>
          {upcoming.rows.length === 0 ? <Block className="text-label-secondary">{copy.emptyUpcoming}</Block> : null}
          {upcoming.rows.map((row) => (
            <Row key={row.id}>
              <span className="flex w-[34px] shrink-0 justify-center">
                {row.date ? (
                  <span className="text-center leading-none">
                    <span className="block text-headline font-bold">{row.date.day}</span>
                    <span className="block text-caption text-label-secondary uppercase">{row.date.weekday}</span>
                  </span>
                ) : (
                  <IconTile icon={row.kind === "fixed" ? IconReceipt : IconRepeat} tone="neutral" size={26} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{row.name}</span>
                <span className="block truncate text-footnote text-label-secondary">{costKind(row.kind, copy)}</span>
              </span>
              <span className="font-semibold tabular-nums">{row.amount}</span>
            </Row>
          ))}
          {upcoming.more ? (
            <Row href={budgetViews.plan.route} className="text-label-secondary">
              <span className="w-[34px] shrink-0" />
              <span className="flex-1">{upcoming.more}</span>
              <Disclosure />
            </Row>
          ) : null}
          {upcoming.rows.length > 0 ? (
            <Row className="bg-fill text-footnote text-label-secondary">
              <span className="flex-1">{copy.upcomingFooter}</span>
              <span className="font-semibold tabular-nums">{upcoming.total}</span>
            </Row>
          ) : null}
        </Group>
      ),
    },
    {
      id: "budget.pots",
      title: copy.pots,
      w: 12,
      h: 3,
      group,
      render: () => {
        // The fun-money pot is the hero; the strip holds everything else.
        const cells: MetricCell[] = [
          ...view.pots.map((pot) => {
            const visual = categoryVisual(pot.category.name, pot.category)
            return { label: pot.category.name, value: pot.value, negative: pot.negative, note: pot.note, meter: pot.meter,
              icon: { glyph: visual.icon, tone: visual.tone } }
          }),
          {
            label: copy.savedPot,
            value: view.savings,
            icon: { glyph: IconPigMoney, tone: "purple" },
            note: <><span className="font-semibold text-success-text">{view.contributionDelta}</span> {copy.thisPeriod}</>,
            action: spendable ? (
              <Button size="sm" variant="secondary" className="h-auto min-h-6 max-w-full py-1 whitespace-normal max-lg:py-1.5" onClick={() => spendable({ kind: "add", source: "savings" })}>
                {copy.spendSavings}
              </Button>
            ) : undefined,
          },
          { label: copy.bufferPot, value: view.buffer, icon: { glyph: IconShield, tone: "yellow" }, note: copy.bufferShort },
          { label: copy.next, value: view.nextFun, icon: { glyph: IconCalendarEvent, tone: "blue" }, note: view.nextFrom },
        ]
        return <MetricStrip title={copy.pots} action={{ label: copy.manage, href: budgetViews.categories.route }} cells={cells} className="h-full" />
      },
    },
    {
      id: "budget.trend",
      title: view.trend.title,
      w: 6,
      h: 6,
      group,
      render: () => (
        <Group title={view.trend.title} className={fullHeight}>
          <div className="px-2 pt-2 pb-1.5">
            <PeriodTrendChart
              periods={view.trend.periods}
              formatMoney={view.fmt.money}
              formatTick={view.fmt.whole}
              labels={{ title: view.trend.title, ...view.trend.labels }}
              height={250}
            />
          </div>
        </Group>
      ),
    },
    {
      id: "budget.recent",
      title: copy.recent,
      w: 6,
      h: 6,
      group,
      render: () => (
        <Group title={copy.recent} action={{ label: copy.showAll, href: budgetViews.expenses.route }} className={fullHeight}>
          {view.recent.length === 0 ? <Block className="text-label-secondary">{copy.emptyExpenses}</Block> : null}
          {view.recent.map((row) => (
            <ExpenseRow key={row.expense.id} row={row} copy={copy} showDate />
          ))}
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

function costKind(kind: "fixed" | "monthly" | "yearly", copy: MonthlyCopy) {
  return kind === "fixed" ? copy.costFixed : kind === "monthly" ? copy.costMonthly : copy.costYearly
}

/**
 * The Budget overview before the user rearranges anything (DESIGN.md, Overview):
 * the hero beside what is due, the pots across, then the trend beside the latest
 * expenses.
 */
export const budgetOverviewWidgets: WidgetPosition[] = [
  { id: "budget.hero", x: 0, y: 0, w: 8, h: 6 },
  { id: "budget.upcoming", x: 8, y: 0, w: 4, h: 6 },
  { id: "budget.pots", x: 0, y: 6, w: 12, h: 3 },
  { id: "budget.trend", x: 0, y: 9, w: 6, h: 6 },
  { id: "budget.recent", x: 6, y: 9, w: 6, h: 6 },
]

/**
 * The global dashboard is a glance, not the whole overview: what is left beside
 * the latest expenses, then the pots.
 */
export const budgetDashboardWidgets: WidgetPosition[] = [
  { id: "budget.hero", x: 0, y: 0, w: 8, h: 6 },
  { id: "budget.recent", x: 8, y: 0, w: 4, h: 6 },
  { id: "budget.pots", x: 0, y: 6, w: 12, h: 3 },
]
