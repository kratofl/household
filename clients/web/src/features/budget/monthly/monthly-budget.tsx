"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { IconPlus, IconArrowUpRight } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Locale } from "@/lib/i18n"
import { useMonthlyBudget } from "./controller"
import { voidMonthlyExpense } from "./api"
import { MonthlyPlanEditor } from "./plan-editor"
import { MonthlyExpenseEditor, type ExpenseIntent } from "./expense-editor"
import { MonthlyExpenseHistory } from "./expense-history"

export function MonthlyBudget({ accessToken, locale, pathname }: { accessToken?: string; locale: Locale; pathname: string }) {
  const controller = useMonthlyBudget(accessToken, locale)
  const { resource, presentation: view, copy, busy, run } = controller
  const [intent, setIntent] = useState<ExpenseIntent | null>(null)
  const expenseTrigger = useRef<HTMLElement | null>(null)
  const openExpense = (next: ExpenseIntent) => {
    expenseTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setIntent(next)
  }
  if (resource.status === "loading") return <p role="status">{copy.loading}</p>
  if (resource.status === "failed") return <Alert variant="destructive"><AlertDescription>{resource.message}<Button variant="outline" onClick={controller.retry}>{copy.retry}</Button></AlertDescription></Alert>
  if (!view || !accessToken) return null
  const state = resource.data
  const page = !state.currentPlan || pathname.endsWith("/plan") ? "plan" : pathname.endsWith("/expenses") ? "expenses" : pathname.endsWith("/savings") ? "savings" : "overview"
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{copy.preview}</p><p className="mt-1 text-sm text-muted-foreground">{copy.previewNote}</p></div>
      {state.currentPlan && <Button disabled={busy || state.categories.every(category => category.archived)} onClick={() => openExpense({ kind: "add" })}><IconPlus />{copy.addExpense}</Button>}
    </div>
    {controller.error && <Alert variant="destructive"><AlertDescription>{controller.error}</AlertDescription></Alert>}
    {controller.message && <p role="status" className="text-sm text-muted-foreground">{controller.message}</p>}
    {page === "plan" ? <MonthlyPlanEditor key={state.revision} state={state} accessToken={accessToken} locale={locale} busy={busy} run={run} /> : <>
      {state.summary && <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">{page === "savings" ? copy.savings : page === "expenses" ? copy.expenses : copy.overview}</h2><p className="text-sm text-muted-foreground">{view.period}</p></div>
        <div className="space-y-1"><Label htmlFor="budget-period">{copy.period}</Label><Input id="budget-period" type="date" min={state.firstDate ?? undefined} max={state.today} value={controller.selectedDate || state.today} onChange={event => { if (event.target.value) controller.setSelectedDate(event.target.value) }} /></div></div>}
      {(state.summary?.fundingShortfallCents ?? 0) > 0 && <Alert variant="destructive"><AlertDescription>{copy.shortfall}: {view.shortfall}. {copy.shortfallNote}</AlertDescription></Alert>}
      {page === "overview" && <>
        <Card><CardContent className="space-y-4 p-6"><p className="text-sm text-muted-foreground">{copy.remaining}</p><p className={(state.summary?.funRemainingCents ?? 0) < 0 ? "text-4xl font-semibold tabular-nums text-destructive sm:text-5xl" : "text-4xl font-semibold tabular-nums sm:text-5xl"}>{view.fun}</p>
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground"><span>{copy.starting}: {view.starting}</span>{(state.summary?.deficitCarryoverCents ?? 0) > 0 && <span>{copy.deficit}: {view.deficit}</span>}</div>
          <Button asChild variant="outline"><Link href="/budget/preview/plan">{copy.openPlan}<IconArrowUpRight /></Link></Button></CardContent></Card>
        <section className="space-y-3"><h3 className="font-semibold">{copy.reserved}</h3>{view.reserveCards.length === 0 ? <p className="text-sm text-muted-foreground">{copy.emptyReserves}</p> :
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{view.reserveCards.map(category => <Card key={category.id}><CardHeader><CardTitle>{category.name}</CardTitle><CardDescription>{copy.reserve}: {category.reserved}</CardDescription></CardHeader>
            <CardContent className="space-y-3"><p className="text-2xl font-semibold tabular-nums">{category.remaining}</p><Button variant="outline" disabled={busy || category.archived} onClick={() => openExpense({ kind: "add", categoryId: category.id, source: "category" })}>{copy.spendCategory}</Button></CardContent></Card>)}</div>}</section>
        <div className="grid gap-4 sm:grid-cols-2"><Card><CardHeader><CardTitle>{copy.totalSaved}</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-2xl font-semibold tabular-nums">{view.savings}</p><Button variant="outline" disabled={busy || state.categories.every(category => category.archived)} onClick={() => openExpense({ kind: "add", source: "savings" })}>{copy.spendSavings}</Button></CardContent></Card>
          <Card><CardHeader><CardTitle>{copy.buffer}</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold tabular-nums">{view.buffer}</p></CardContent></Card></div>
        <Card><CardHeader><CardTitle>{copy.automaticCosts}</CardTitle><CardDescription>{copy.automaticNote}</CardDescription></CardHeader><CardContent><dl className="divide-y">{state.summary?.costs.map(cost => <div key={cost.id} className="flex justify-between gap-3 py-2"><dt>{cost.name}</dt><dd className="tabular-nums">{view.fmt.money(cost.amountCents)}</dd></div>)}</dl></CardContent></Card>
      </>}
      {page === "savings" && <Card><CardHeader><CardTitle>{copy.totalSaved}</CardTitle><CardDescription>{copy.savingsNote}</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-4xl font-semibold tabular-nums">{view.savings}</p><p className="text-sm text-muted-foreground">{copy.plannedSavings}: {view.contribution}</p><Button disabled={busy || state.categories.every(category => category.archived)} onClick={() => openExpense({ kind: "add", source: "savings" })}>{copy.spendSavings}</Button></CardContent></Card>}
      {(page === "expenses" || page === "savings") && <MonthlyExpenseHistory state={state} through={controller.selectedDate || state.today} locale={locale} savingsOnly={page === "savings"} busy={busy} open={openExpense}
        voidEntry={expense => { if (window.confirm(copy.confirmVoid)) void run(() => voidMonthlyExpense(accessToken, expense.id, crypto.randomUUID())) }} />}
      {state.categories.length === 0 && <p className="text-sm text-muted-foreground">{copy.emptyCategories} <Link className="underline" href="/budget/preview/plan">{copy.plan}</Link></p>}
    </>}
    {intent && <MonthlyExpenseEditor intent={intent} state={state} accessToken={accessToken} locale={locale} busy={busy} serverError={controller.error} run={run} close={() => setIntent(null)} restoreFocus={() => expenseTrigger.current?.focus()} />}
  </div>
}
