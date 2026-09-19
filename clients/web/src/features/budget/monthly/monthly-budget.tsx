"use client"

import Link from "next/link"
import { useState } from "react"
import { IconPigMoney, IconPlus } from "@tabler/icons-react"

import { IconTile } from "@/components/app/grouped"
import { boardElements } from "@/components/app/board-elements"
import { WidgetBoard } from "@/components/app/widget-board"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  const controller = useMonthlyBudget(accessToken, locale)
  const { resource, presentation: view, copy, busy, run } = controller
  // The editor is a dialog; remember what opened it so focus can go back there.
  const [intent, setIntent] = useState<{ expense: ExpenseIntent; trigger: HTMLElement | null } | null>(null)
  const openExpense = (next: ExpenseIntent) =>
    setIntent({ expense: next, trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null })
  if (resource.status === "loading") return <p role="status" className="text-muted-foreground">{copy.loading}</p>
  if (resource.status === "failed") {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          {resource.message}
          <Button variant="outline" onClick={controller.retry}>{copy.retry}</Button>
        </AlertDescription>
      </Alert>
    )
  }
  if (!view || !accessToken) return null
  const state = resource.data
  // Without a plan there is nothing to show but the setup form.
  const page = !state.currentPlan ? "plan" : budgetViewFromPath(pathname)
  const allArchived = state.categories.every((category) => category.archived)
  const title = page === "plan" ? null : page === "savings" ? copy.savings : page === "expenses" ? copy.expenses : copy.overview

  return (
    <div className="space-y-7">
      {title ? (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold tracking-[-0.02em] lg:text-[34px]">{title}</h1>
            <p className="mt-0.5 text-muted-foreground">{view.period}</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="budget-period" className="text-[11px] text-muted-foreground">{copy.period}</Label>
              <Input
                id="budget-period"
                type="date"
                className="w-40"
                min={state.firstDate ?? undefined}
                max={state.today}
                value={controller.selectedDate || state.today}
                onChange={(event) => {
                  if (event.target.value) controller.setSelectedDate(event.target.value)
                }}
              />
            </div>
            <Button disabled={busy || allArchived} onClick={() => openExpense({ kind: "add" })}>
              <IconPlus />
              {copy.addExpense}
            </Button>
          </div>
        </div>
      ) : null}

      {page !== "plan" && allArchived ? (
        <p className="text-muted-foreground">
          {copy.emptyCategories}{" "}
          <Link className="text-primary hover:underline" href={budgetViews.plan.route}>
            {copy.plan}
          </Link>
        </p>
      ) : null}

      {controller.error ? <Alert variant="destructive"><AlertDescription>{controller.error}</AlertDescription></Alert> : null}
      {controller.message ? <p role="status" className="text-muted-foreground">{controller.message}</p> : null}
      {(state.summary?.fundingShortfallCents ?? 0) > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            {copy.shortfall}: {view.shortfall}. {copy.shortfallNote}
          </AlertDescription>
        </Alert>
      ) : null}

      {page === "plan" ? (
        <MonthlyPlanEditor key={state.revision} state={state} accessToken={accessToken} locale={locale} busy={busy}
          isAdmin={isAdmin} merchants={controller.merchants} saveMerchant={controller.saveMerchant} run={run} />
      ) : null}

      {page === "overview" ? (
        <WidgetBoard
          boardId="budget-overview"
          widgets={[...boardElements(t), ...budgetWidgets({ state, view, copy, locale, busy, openExpense })]}
          defaultIds={budgetOverviewWidgets}
          t={t}
        />
      ) : null}

      {page === "savings" ? (
        <section className="surface-group p-5">
          <div className="flex items-center gap-2">
            <IconTile icon={IconPigMoney} color="var(--sys-green)" size={22} />
            <span className="font-medium">{copy.totalSaved}</span>
          </div>
          <p className="mt-3 text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{view.savings}</p>
          <p className="mt-2 text-muted-foreground">
            {copy.plannedSavings}: {view.contribution}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">{copy.savingsNote}</p>
          <Button className="mt-4" disabled={busy || allArchived} onClick={() => openExpense({ kind: "add", source: "savings" })}>
            {copy.spendSavings}
          </Button>
        </section>
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
