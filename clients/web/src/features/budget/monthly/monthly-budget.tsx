"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import { IconPlus } from "@tabler/icons-react"

import { boardElements } from "@/components/app/board-elements"
import { KpiCard } from "@/components/app/kpi-card"
import { PageHeader } from "@/components/app/page-header"
import { useToast } from "@/components/app/toast"
import { ToolbarButton, ToolbarContent, ToolbarGroup } from "@/components/app/toolbar"
import { WidgetBoard } from "@/components/app/widget-board"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Locale, Translator } from "@/lib/i18n"
import { budgetViewFromPath, budgetViews } from "@/lib/modules"
import { uuid } from "@/lib/uuid"

import { voidMonthlyExpense } from "./api"
import { useMonthlyBudget } from "./controller"
import { MonthlyExpenseEditor, type ExpenseIntent } from "./expense-editor"
import { MonthlyExpenseHistory } from "./expense-history"
import { MonthlyPlanEditor } from "./plan-editor"
import { budgetOverviewWidgets, budgetWidgets } from "./widgets"

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
  const openExpense = (next: ExpenseIntent) =>
    setIntent({ expense: next, trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null })
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
  const title = page === "plan" ? null : page === "savings" ? copy.savings : page === "expenses" ? copy.expenses : copy.overview

  const notices = (
    <>
      {page !== "plan" && allArchived ? (
        <p className="text-label-secondary">
          {copy.emptyCategories}{" "}
          <Link className="font-medium text-link hover:underline" href={budgetViews.plan.route}>
            {copy.plan}
          </Link>
        </p>
      ) : null}

      {controller.error ? <Alert variant="destructive"><AlertDescription>{controller.error}</AlertDescription></Alert> : null}
      {(state.summary?.fundingShortfallCents ?? 0) > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            {copy.shortfall}: {view.shortfall}. {copy.shortfallNote}
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  )

  // The toolbar content and the notices under it. The overview hands this to its
  // widget board, so Customize sits in the toolbar's icon group with Add expense.
  // The period picker sits in the toolbar; phones have no room there, so it moves
  // next to the period line instead.
  const periodPicker = (className: string) => (
    <Input
      type="date"
      aria-label={copy.period}
      className={className}
      title={copy.period}
      min={state.firstDate ?? undefined}
      max={state.today}
      value={controller.selectedDate || state.today}
      onChange={(event) => {
        if (event.target.value) controller.setSelectedDate(event.target.value)
      }}
    />
  )
  const top = (customize?: ReactNode) => (
    <>
      {title ? (
        <PageHeader
          title={title}
          subtitle={
            <span className="flex flex-wrap items-center justify-between gap-3">
              {view.period}
              {periodPicker("w-44 sm:hidden")}
            </span>
          }
          actions={
            <>
              {periodPicker("w-40 max-sm:hidden")}
              <ToolbarGroup>
                {customize}
                <ToolbarButton icon={<IconPlus />} label={copy.addExpense} disabled={busy || allArchived} onClick={() => openExpense({ kind: "add" })} />
              </ToolbarGroup>
            </>
          }
        />
      ) : null}
      {notices}
    </>
  )

  return (
    <div className="space-y-4">
      {page === "overview" ? null : top()}

      {page === "plan" ? (
        <MonthlyPlanEditor key={state.revision} state={state} accessToken={accessToken} locale={locale} busy={busy}
          isAdmin={isAdmin} merchants={controller.merchants} saveMerchant={controller.saveMerchant} run={run} />
      ) : null}

      {page === "overview" ? (
        <WidgetBoard
          boardId="budget-overview"
          widgets={[...boardElements(t), ...budgetWidgets({ state, view, copy, locale, busy, openExpense })]}
          defaultIds={budgetOverviewWidgets}
          header={top}
          t={t}
        />
      ) : null}

      {page === "savings" ? (
        <KpiCard
          className="max-w-md"
          label={copy.totalSaved}
          value={view.savings}
          delta={{ text: `${copy.plannedSavings}: ${view.contribution}. ${copy.savingsNote}`, tone: "neutral" }}
          action={
            <Button disabled={busy || allArchived} onClick={() => openExpense({ kind: "add", source: "savings" })}>
              {copy.spendSavings}
            </Button>
          }
        />
      ) : null}

      {page === "expenses" || page === "savings" ? (
        <MonthlyExpenseHistory
          state={state}
          through={controller.selectedDate || state.today}
          locale={locale}
          merchantById={controller.merchantById}
          savingsOnly={page === "savings"}
          busy={busy}
          open={openExpense}
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
          serverError={controller.error}
          run={run}
          close={() => setIntent(null)}
          restoreFocus={() => intent.trigger?.focus()}
        />
      ) : null}
    </div>
  )
}
