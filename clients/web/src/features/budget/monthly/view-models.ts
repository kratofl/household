// Pure derivations behind the Budget list and plan pages: the expense filter, daily
// totals for the chart, day groups, the plan breakdown and the cost-list totals. No
// React, no I/O; views call these and render the result. All money is integer cents.

import type { Locale } from "@/lib/i18n"

import type { MonthlyCategory, MonthlyCost, MonthlyExpense, MonthlyState, MonthlySummary } from "./types"

// ---------- Expenses: filter row, chart, rows ----------

/**
 * Which money the Expenses filter row scopes to: everything, one funding source (fun
 * budget, savings, buffer), or the reserve of one category. Its string form is the
 * segment value: "all", the source name, or the category id (ids are UUIDs, so they
 * never collide with the words).
 */
export type ExpenseScope = { kind: "all" } | { kind: "source"; source: PotSource } | { kind: "category"; categoryId: string }
type PotSource = "fun" | "savings" | "buffer"

const potSources: PotSource[] = ["fun", "savings", "buffer"]

export function scopeFromKey(key: string): ExpenseScope {
  if (key === "all") return { kind: "all" }
  const source = potSources.find((candidate) => candidate === key)
  return source ? { kind: "source", source } : { kind: "category", categoryId: key }
}

/** The filter options: All, each category with a reserve in the period, then fun budget, savings and buffer. */
export function scopeOptions(summary: MonthlySummary | null, categories: MonthlyCategory[], labels: Record<"all" | PotSource, string>) {
  const reserved = (summary?.categories ?? [])
    .filter((item) => item.reservedCents > 0)
    .flatMap((item) => {
      const category = categories.find((candidate) => candidate.id === item.categoryId)
      return category ? [{ value: category.id, label: category.name }] : []
    })
  return [{ value: "all", label: labels.all }, ...reserved, ...potSources.map((source) => ({ value: source, label: labels[source] }))]
}

/** Whether any of the expense's money came from the scope. */
export function matchesScope(expense: MonthlyExpense, scope: ExpenseScope) {
  return scopedParts(expense, scope).length > 0
}

/**
 * What an entry moves within the scope, signed: spending positive, refunds negative.
 * For "all" that is the whole amount; otherwise only the funding parts from that pot.
 */
export function scopedCents(expense: MonthlyExpense, scope: ExpenseScope) {
  const cents = scope.kind === "all" ? expense.amountCents : scopedParts(expense, scope).reduce((sum, part) => sum + part.amountCents, 0)
  return expense.kind === "refund" ? -cents : cents
}

function scopedParts(expense: MonthlyExpense, scope: ExpenseScope) {
  if (scope.kind === "all") return expense.funding
  if (scope.kind === "source") return expense.funding.filter((part) => part.source === scope.source)
  return expense.funding.filter((part) => part.source === "category" && part.categoryId === scope.categoryId)
}

/** Case-insensitive match over description, category and merchant name. */
export function matchesSearch(expense: MonthlyExpense, merchantName: string, search: string, locale: Locale) {
  const needle = search.trim().toLocaleLowerCase(locale)
  if (!needle) return true
  return `${expense.description} ${expense.categoryName} ${merchantName}`.toLocaleLowerCase(locale).includes(needle)
}

/**
 * The entries a list page shows, newest last as stored: up to `through`, narrowed by the
 * scope, the category (null = every category) and the search. The Expenses page shows
 * the shown period only; the Savings page passes the savings scope and `allPeriods`, so
 * it lists every purchase paid from savings.
 */
export function expenseEntries(
  state: Pick<MonthlyState, "entries" | "summary">,
  filter: { through: string; allPeriods: boolean; scope: ExpenseScope; categoryId: string | null; search: string; locale: Locale; merchantName: (id: string | null) => string },
) {
  return state.entries.filter(({ expense }) =>
    expense.occurredOn <= filter.through &&
    (filter.allPeriods || !state.summary || expense.occurredOn >= state.summary.start) &&
    matchesScope(expense, filter.scope) &&
    (filter.categoryId === null || expense.categoryId === filter.categoryId) &&
    matchesSearch(expense, filter.merchantName(expense.merchantId), filter.search, filter.locale))
}

/**
 * Rows grouped by calendar day, newest day first. A day's total is what its non-voided
 * rows move within the scope, so it agrees with the chart and the filter.
 */
export function groupByDay<Row extends { expense: MonthlyExpense; voided: boolean }>(rows: Row[], scope: ExpenseScope) {
  const byDay = new Map<string, Row[]>()
  for (const row of [...rows].sort((a, b) => b.expense.occurredOn.localeCompare(a.expense.occurredOn))) {
    const day = byDay.get(row.expense.occurredOn) ?? []
    day.push(row)
    byDay.set(row.expense.occurredOn, day)
  }
  return [...byDay].map(([date, dayRows]) => ({
    date,
    rows: dayRows,
    totalCents: dayRows.reduce((sum, row) => (row.voided ? sum : sum + scopedCents(row.expense, scope)), 0),
  }))
}

/** Whole days from one ISO date to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000)
}

/** The ISO date `days` after `start`. */
export function addDays(start: string, days: number) {
  return new Date(Date.parse(`${start}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Spending per day for the daily chart: one entry per day from the period start
 * through `through` (index 0 = day 1), signed cents within the scope. Voided
 * entries count nothing.
 */
export function dailyTotals(entries: { expense: MonthlyExpense; voided: boolean }[], start: string, through: string, scope: ExpenseScope) {
  const totals = Array.from({ length: Math.max(0, daysBetween(start, through) + 1) }, () => 0)
  for (const { expense, voided } of entries) {
    const index = daysBetween(start, expense.occurredOn)
    if (voided || index < 0 || index >= totals.length) continue
    totals[index] += scopedCents(expense, scope)
  }
  return totals
}

/**
 * Where an expense was paid from, as row tags: the reserved category's name, the fun
 * budget, savings or buffer. A purchase that overdrew its reserve shows both pots.
 */
export function budgetTags(expense: MonthlyExpense, categories: MonthlyCategory[], labels: { fun: string; savings: string; buffer: string }) {
  return expense.funding.map((part) =>
    part.source === "category"
      ? categories.find((category) => category.id === part.categoryId)?.name ?? expense.categoryName
      : part.source === "savings" ? labels.savings : part.source === "buffer" ? labels.buffer : labels.fun,
  )
}

// ---------- Plan: breakdown of the period ----------

/** Where one period's income went, in cents. `fun` is what was left for ordinary spending. */
export type PeriodBreakdown = {
  income: number
  fixed: number
  monthly: number
  yearly: number
  reserves: number
  savings: number
  buffer: number
  deficit: number
  fun: number
}

/**
 * Splits the backend's period summary into the parts of the plan that produced it. The
 * summary already carries the plan in effect for that period: income, the costs due
 * (yearly ones only in the period they fall due), the funded reserves and saving, and
 * the starting fun money. The buffer is the one part not listed, so it is what remains
 * between them; when the period could not be funded, reserves, saving and buffer are
 * all zero, exactly as the backend books it. The parts always sum to income − fun.
 */
export function periodBreakdown(summary: MonthlySummary): PeriodBreakdown {
  const costs = (kind: MonthlyCost["kind"]) => summary.costs.filter((cost) => cost.kind === kind).reduce((sum, cost) => sum + cost.amountCents, 0)
  const fixed = costs("fixed"), monthly = costs("monthly"), yearly = costs("yearly")
  const reserves = summary.categories.reduce((sum, item) => sum + item.reservedCents, 0)
  const savings = summary.savingsContributionCents
  const deficit = summary.deficitCarryoverCents
  const fun = summary.startingFunCents
  const buffer = summary.incomeCents - fixed - monthly - yearly - deficit - reserves - savings - fun
  return { income: summary.incomeCents, fixed, monthly, yearly, reserves, savings, buffer, deficit, fun }
}

// ---------- Plan: cost lists ----------

/** The editable shape of a cost row; amounts stay text until the plan is saved. An empty merchant or description means none. */
export type CostDraft = { id: string; name: string; amount: string; kind: MonthlyCost["kind"]; month: string; day: string
  merchantId: string; description: string }

/** How many costs of a kind the draft lists and what they add up to; unparseable amounts count as zero. */
export function costTotal(costs: CostDraft[], kind: MonthlyCost["kind"], parse: (value: string) => number | null) {
  const items = costs.filter((cost) => cost.kind === kind)
  return { count: items.length, cents: items.reduce((sum, cost) => sum + (parse(cost.amount) ?? 0), 0) }
}

/**
 * The next date a yearly cost falls due on or after `today`, with the due day clamped
 * to short months like the backend does. Null when no cost has a valid due date.
 */
export function nextYearlyDue(costs: { name: string; amountCents: number; month: number; day: number }[], today: string) {
  const year = Number(today.slice(0, 4))
  let next: { name: string; amountCents: number; date: string } | null = null
  for (const cost of costs) {
    if (!Number.isInteger(cost.month) || cost.month < 1 || cost.month > 12 || !Number.isInteger(cost.day) || cost.day < 1 || cost.day > 31) continue
    for (const candidate of [year, year + 1]) {
      const last = new Date(Date.UTC(candidate, cost.month, 0)).getUTCDate()
      const date = `${candidate}-${String(cost.month).padStart(2, "0")}-${String(Math.min(cost.day, last)).padStart(2, "0")}`
      if (date < today) continue
      if (!next || date < next.date) next = { name: cost.name, amountCents: cost.amountCents, date }
      break
    }
  }
  return next
}

