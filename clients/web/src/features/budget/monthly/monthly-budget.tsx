"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { IconChartBar, IconPigMoney, IconPlus, IconShieldCheck } from "@tabler/icons-react"

import { Block, Disclosure, Group, IconTile, Row, ThinBar } from "@/components/app/grouped"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { voidMonthlyExpense } from "./api"
import { categoryVisual } from "./category-visuals"
import { useMonthlyBudget } from "./controller"
import { MonthlyExpenseEditor, type ExpenseIntent } from "./expense-editor"
import { ExpenseRow, MonthlyExpenseHistory } from "./expense-history"
import { MonthlyPlanEditor } from "./plan-editor"

export function MonthlyBudget({ accessToken, locale, pathname }: { accessToken?: string; locale: Locale; pathname: string }) {
  const controller = useMonthlyBudget(accessToken, locale)
  const { resource, presentation: view, copy, busy, run } = controller
  const [intent, setIntent] = useState<ExpenseIntent | null>(null)
  const expenseTrigger = useRef<HTMLElement | null>(null)
  const openExpense = (next: ExpenseIntent) => {
    expenseTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setIntent(next)
  }
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
  const page = !state.currentPlan || pathname.endsWith("/plan") ? "plan" : pathname.endsWith("/expenses") ? "expenses" : pathname.endsWith("/savings") ? "savings" : "overview"
  const allArchived = state.categories.every((category) => category.archived)
  const title = page === "plan" ? null : page === "savings" ? copy.savings : page === "expenses" ? copy.expenses : copy.overview

  return (
    <div className="space-y-7">
      <p className="text-[11px] text-muted-foreground">
        <span className="font-semibold">{copy.preview}</span> · {copy.previewNote}
      </p>

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
            {state.currentPlan ? (
              <Button disabled={busy || allArchived} onClick={() => openExpense({ kind: "add" })}>
                <IconPlus />
                {copy.addExpense}
              </Button>
            ) : null}
          </div>
        </div>
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
        <MonthlyPlanEditor key={state.revision} state={state} accessToken={accessToken} locale={locale} busy={busy} run={run} />
      ) : null}

      {page === "overview" && state.summary ? (
        <>
          <section className="surface-group p-5">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="font-medium text-muted-foreground">{copy.remaining}</p>
                <p
                  className={cn(
                    "mt-0.5 text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums lg:text-[52px]",
                    state.summary.funRemainingCents < 0 && "text-destructive",
                  )}
                >
                  {view.fun}
                </p>
                {state.summary.deficitCarryoverCents > 0 ? (
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

          <div className="grid gap-3 sm:grid-cols-3">
            <MiniCard icon={IconPigMoney} color="var(--sys-green)" label={copy.totalSaved} value={view.savings} note={`${copy.plannedSavings}: ${view.contribution}`}>
              <Button size="xs" variant="outline" disabled={busy || allArchived} onClick={() => openExpense({ kind: "add", source: "savings" })}>
                {copy.spendSavings}
              </Button>
            </MiniCard>
            <MiniCard icon={IconShieldCheck} color="var(--sys-blue)" label={copy.buffer} value={view.buffer} note={copy.bufferNote} />
            <MiniCard icon={IconChartBar} color="var(--sys-gray)" label={copy.next} value={view.nextFun} note={`${copy.from} ${view.nextStart}`} />
          </div>

          <Group title={copy.reserved} action={{ label: copy.openPlan, href: "/budget/preview/plan" }} footer={view.reserveCards.length === 0 ? copy.emptyReserves : undefined}>
            {view.reserveCards.map((category) => {
              const visual = categoryVisual(category.name)
              return (
                <Row key={category.id} onClick={category.archived || busy ? undefined : () => openExpense({ kind: "add", categoryId: category.id, source: "category" })}>
                  <IconTile icon={visual.icon} color={visual.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="font-medium">{category.name}</span>
                      <span className="tabular-nums">
                        {category.remaining} <span className="text-muted-foreground">{copy.left}</span>
                      </span>
                    </div>
                    <ThinBar className="mt-1.5 h-1" fraction={category.reservedCents > 0 ? 1 - category.remainingCents / category.reservedCents : 0} color={visual.color} />
                  </div>
                  <Disclosure />
                </Row>
              )
            })}
            {view.reserveCards.length === 0 ? <Block className="text-muted-foreground">{copy.emptyReserves}</Block> : null}
          </Group>

          <Group title={copy.recent} action={{ label: copy.showAll, href: "/budget/preview/expenses" }}>
            {view.recent.length === 0 ? <Block className="text-muted-foreground">{copy.emptyExpenses}</Block> : null}
            {view.recent.map((row) => (
              <ExpenseRow key={row.expense.id} row={row} copy={copy} showDate />
            ))}
          </Group>

          <Group title={copy.automaticCosts} footer={copy.automaticNote}>
            {state.summary.costs.map((cost) => (
              <Row key={cost.id}>
                <span className="flex-1">{cost.name}</span>
                <span className="tabular-nums text-muted-foreground">{view.fmt.money(cost.amountCents)}</span>
              </Row>
            ))}
            {state.summary.costs.length === 0 ? <Block className="text-muted-foreground">–</Block> : null}
          </Group>
        </>
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
          savingsOnly={page === "savings"}
          busy={busy}
          open={openExpense}
          voidEntry={(expense) => {
            if (window.confirm(copy.confirmVoid)) void run(() => voidMonthlyExpense(accessToken, expense.id, crypto.randomUUID()))
          }}
        />
      ) : null}

      {page !== "plan" && state.categories.length === 0 ? (
        <p className="text-muted-foreground">
          {copy.emptyCategories}{" "}
          <Link className="text-primary hover:underline" href="/budget/preview/plan">
            {copy.plan}
          </Link>
        </p>
      ) : null}

      {intent ? (
        <MonthlyExpenseEditor
          intent={intent}
          state={state}
          accessToken={accessToken}
          locale={locale}
          busy={busy}
          serverError={controller.error}
          run={run}
          close={() => setIntent(null)}
          restoreFocus={() => expenseTrigger.current?.focus()}
        />
      ) : null}
    </div>
  )
}

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
  children?: React.ReactNode
}) {
  return (
    <div className="surface-group p-4">
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
