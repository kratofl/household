"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import { IconPigMoney, IconPlus } from "@tabler/icons-react"

import { boardElements } from "@/components/app/board-elements"
import { MetricStrip } from "@/components/app/metric-strip"
import { PageHeader } from "@/components/app/page-header"
import { PeriodStepper } from "@/components/app/period-stepper"
import { useToast } from "@/components/app/toast"
import { ToolbarContent, ToolbarGroup, type ToolbarPrimaryAction } from "@/components/app/toolbar"
import { WidgetBoard } from "@/components/app/widget-board"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { Locale, Translator } from "@/lib/i18n"
import { budgetViewFromPath, budgetViews } from "@/lib/modules"
import { uuid } from "@/lib/uuid"

import { voidMonthlyExpense } from "./api"
import { useMonthlyBudget } from "./controller"
import { MonthlyExpenseEditor, type ExpenseIntent } from "./expense-editor"
import { MonthlyExpenseHistory } from "./expense-history"
import { FormFeedback } from "./form-feedback"
import { MonthlyPlanEditor } from "./plan-editor"
import { budgetOverviewWidgets, budgetWidgets } from "./widgets"

/**
 * The Budget hub: the overview board, the Expenses and Savings lists, and the plan
 * pages, all on one controller. Overview, Expenses and Savings share the toolbar
 * (title, period stepper, caption, primary action); the plan pages render their
 * own header inside the plan editor.
 */
export function MonthlyBudget({
  accessToken,
  locale,
  pathname,
  isAdmin = false,
  t,
}: {
  accessToken?: string
  locale: Locale
  pathname: string
  /** Admins may publish a merchant to every user; everyone else only adds their own. */
  isAdmin?: boolean
  t: Translator
}) {
  const controller = useMonthlyBudget(accessToken, locale, useToast())
  const { resource, presentation: view, copy, busy, run } = controller
  // The editor is a dialog; remember what opened it so focus can go back there.
  const [intent, setIntent] = useState<{ expense: ExpenseIntent; trigger: HTMLElement | null } | null>(null)
  const openExpense = (next: ExpenseIntent) => {
    controller.dismissError()
    setIntent({ expense: next, trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null })
  }
  if (resource.status === "loading") {
    return (
      <>
        <ToolbarContent title={copy.overview} />
        <p role="status" className="text-label-secondary">{copy.loading}</p>
      </>
    )
  }
  if (resource.status === "failed") {
    return (
      <>
        <ToolbarContent title={copy.overview} />
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            {resource.message}
            <Button variant="secondary" size="sm" onClick={controller.retry}>{copy.retry}</Button>
          </AlertDescription>
        </Alert>
      </>
    )
  }
  if (!view || !accessToken) return null
  const state = resource.data
  // Without a plan there is nothing to show but the setup form.
  const page = !state.currentPlan ? "plan" : budgetViewFromPath(pathname)
  const allArchived = state.categories.every((category) => category.archived)
  const planning = page !== "overview" && page !== "expenses" && page !== "savings"
  const title = page === "savings" ? copy.savings : page === "expenses" ? copy.expenses : copy.overview
  const period = view.period
  const primaryAction: ToolbarPrimaryAction =
    page === "savings"
      ? { label: copy.spendSavings, icon: <IconPigMoney />, onClick: () => openExpense({ kind: "add", source: "savings" }), disabled: busy || allArchived }
      : { label: copy.addExpense, icon: <IconPlus />, onClick: () => openExpense({ kind: "add" }), disabled: busy || allArchived }

  // Page-level states as banners at the top of the content.
  const notices = (
    <>
      {!planning && allArchived ? (
        <Alert variant="warning">
          <AlertDescription>
            {copy.emptyCategories}{" "}
            <Link className="font-semibold underline underline-offset-2" href={budgetViews.categories.route}>
              {copy.categories}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}
      {!planning ? <FormFeedback error={intent ? null : controller.error} /> : null}
      {(state.summary?.fundingShortfallCents ?? 0) > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            {copy.shortfall}: {view.shortfall}. {copy.shortfallNote}
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  )

  // The toolbar and the banners under it. The overview hands this to its widget
  // board, which passes its Customize action for the toolbar's icon group.
  const top = (customize?: ReactNode) => (
    <>
      <PageHeader
        title={title}
        scope={
          period ? (
            <PeriodStepper
              label={period.label}
              previousLabel={copy.previousPeriod}
              nextLabel={copy.next}
              previousDisabled={busy || !period.previous}
              nextDisabled={busy || !period.next}
              onPrevious={() => { if (period.previous) controller.setSelectedDate(period.previous) }}
              onNext={() => { if (period.next) controller.setSelectedDate(period.next) }}
            />
          ) : undefined
        }
        caption={period?.caption}
        actions={customize ? <ToolbarGroup>{customize}</ToolbarGroup> : undefined}
        primaryAction={primaryAction}
      />
      {notices}
    </>
  )

  // A list page leads with its totals (DESIGN.md, List).
  const metrics =
    page === "savings" ? (
      <MetricStrip
        cells={[
          { label: copy.totalSaved, value: view.savings, note: copy.savingsAllocation },
          { label: copy.savedThisPeriod, value: view.contribution, note: copy.contribution },
          { label: copy.paidFromSavings, value: view.totals.savingsSpent, note: view.totals.savingsCount },
        ]}
      />
    ) : (
      <MetricStrip
        cells={[
          { label: copy.spent, value: view.totals.spent, note: view.totals.fromFun },
          { label: copy.remaining, value: view.fun, negative: (state.summary?.funRemainingCents ?? 0) < 0,
            note: `${copy.starting} ${view.starting}`, meter: { fraction: view.usedFraction, marker: view.pace, label: view.totals.usedLabel } },
          { label: copy.expenseCount, value: view.totals.count, note: view.totals.since },
          { label: copy.totalSaved, value: view.savings, note: <><span className="font-semibold text-success-text">{view.contributionDelta}</span> {copy.thisPeriod}</> },
        ]}
      />
    )

  return (
    <div className="space-y-4">
      {page === "expenses" || page === "savings" ? top() : null}
      {planning ? notices : null}

      {planning ? (
        <MonthlyPlanEditor key={state.revision} state={state} accessToken={accessToken} locale={locale} busy={busy}
          section={page} serverError={controller.error} isAdmin={isAdmin} merchants={controller.merchants} saveMerchant={controller.saveMerchant} run={run} />
      ) : null}

      {page === "overview" ? (
        <WidgetBoard
          boardId="budget-overview-v2"
          widgets={[...boardElements(t), ...budgetWidgets({ state, view, copy, locale, busy, openExpense })]}
          defaults={budgetOverviewWidgets}
          header={top}
          t={t}
        />
      ) : null}

      {page === "expenses" || page === "savings" ? (
        <MonthlyExpenseHistory
          state={state}
          through={view.through}
          locale={locale}
          merchantById={controller.merchantById}
          savingsOnly={page === "savings"}
          busy={busy}
          open={openExpense}
          metrics={metrics}
          voidEntry={(expense) => {
            if (window.confirm(copy.confirmVoid)) void run(() => voidMonthlyExpense(accessToken, expense.id, uuid()))
          }}
        />
      ) : null}

      {intent ? (
        <MonthlyExpenseEditor
          intent={intent.expense}
          state={state}
          accessToken={accessToken}
          locale={locale}
          busy={busy}
          merchants={controller.merchants}
          run={run}
          close={() => setIntent(null)}
          restoreFocus={() => intent.trigger?.focus()}
        />
      ) : null}
    </div>
  )
}
