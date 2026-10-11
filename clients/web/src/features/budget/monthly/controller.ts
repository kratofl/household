"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Locale } from "@/lib/i18n"
import { createMerchant, loadMerchants, updateMerchant, type Merchant } from "../merchants"
import { loadMonthlyBudget } from "./api"
import { type MonthlyCopy, monthlyCopy, monthlyError } from "./copy"
import type { CostDue, Funding, MonthlyCategory, MonthlyExpense, MonthlyState, MonthlySummary } from "./types"

export function parseMoney(value: string): number | null {
  const match = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(value.trim())
  if (!match) return null
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"))
  return cents <= 10_000_000_000 ? cents : null
}
export function moneyInput(cents: number, locale: Locale = "en"): string {
  return `${Math.floor(cents / 100)}${locale === "de" ? "," : "."}${String(cents % 100).padStart(2, "0")}`
}
export function formatters(locale: Locale, currency: string) {
  const tag = locale === "de" ? "de-DE" : "en-GB"
  const amount = new Intl.NumberFormat(tag, { style: "currency", currency })
  const whole = new Intl.NumberFormat(tag, { style: "currency", currency, maximumFractionDigits: 0 })
  const date = new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeZone: "UTC" })
  const month = new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" })
  const monthName = new Intl.DateTimeFormat(tag, { month: "long", timeZone: "UTC" })
  const monthShort = new Intl.DateTimeFormat(tag, { month: "short", timeZone: "UTC" })
  const day = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
  const dayShort = new Intl.DateTimeFormat(tag, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
  const dayMonth = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", timeZone: "UTC" })
  const dayOnly = new Intl.DateTimeFormat(tag, { day: "numeric", timeZone: "UTC" })
  const weekday = new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" })
  const at = (value: string) => new Date(`${value}T12:00:00Z`)
  return { money: (cents: number) => amount.format(cents / 100), whole: (cents: number) => whole.format(cents / 100),
    date: (value: string) => date.format(at(value)), month: (value: string) => month.format(at(value)),
    monthName: (value: string) => monthName.format(at(value)), monthShort: (value: string) => monthShort.format(at(value)),
    day: (value: string) => day.format(at(value)), dayShort: (value: string) => dayShort.format(at(value)),
    dayMonth: (value: string) => dayMonth.format(at(value)), dayOnly: (value: string) => dayOnly.format(at(value)),
    weekday: (value: string) => weekday.format(at(value)),
    range: (from: string, to: string) => dayMonth.formatRange(at(from), at(to)) }
}

/** Fills `{name}` placeholders in a copy string. */
export function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match))
}

/** The ISO date `days` days after `date` (negative steps back). */
function shiftDay(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

/** What an entry took from one funding source; negative for a refund, which gives it back. */
function sourceCents(expense: MonthlyExpense, source: Funding["source"]) {
  const cents = expense.funding.filter(part => part.source === source).reduce((sum, part) => sum + part.amountCents, 0)
  return expense.kind === "refund" ? -cents : cents
}

/**
 * Loads the period containing `date` as it stands at its end, or today while it
 * runs. The API answers "as of a date", so a step into a period lands on its first
 * day; this reloads at the right day so a period is always shown whole.
 */
async function loadPeriod(accessToken: string, date: string) {
  const data = await loadMonthlyBudget(accessToken, date || undefined)
  const through = data.summary && data.summary.end < data.today ? data.summary.end : data.today
  return !date || date === through ? data : loadMonthlyBudget(accessToken, through)
}
export type Formatters = ReturnType<typeof formatters>

/** What a write did; a failure carries the translated message. */
export type RunResult = { ok: true } | { ok: false; message: string }
/**
 * Runs a write, reloads the period and toasts. A failure goes to the page's error
 * banner, or with "sheet" only back to the caller, so a sheet shows it above the page.
 */
export type Run = (action: () => Promise<unknown>, report?: "page" | "sheet") => Promise<RunResult>

/** One expense prepared for a list row, merchant already looked up. */
export type ExpenseRowModel = { expense: MonthlyExpense; voided: boolean; date: string; amount: string; sources: string
  merchant: Merchant | null; category?: MonthlyCategory }

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000)
}

/**
 * The month a period is named after: the one most of its days fall in, the earlier
 * one on a tie. With a late start day a period spans two months, so 25 Sep – 24 Oct
 * is October and 10 Sep – 9 Oct is September. Returns a day inside that month for
 * the `month`, `monthName` and `monthShort` formatters; every period label uses it.
 */
export function periodMonth(start: string, end: string) {
  return shiftDay(start, Math.floor(daysBetween(start, end) / 2))
}

/**
 * The toolbar's period: stepper label, caption, and the dates the chevrons load
 * (null where no step exists: before the first period, or past today's).
 */
function periodView(state: MonthlyState, summary: MonthlySummary, through: string, fmt: Formatters, copy: MonthlyCopy) {
  const days = daysBetween(summary.start, summary.end) + 1
  const running = summary.end >= state.today
  const range = fmt.range(summary.start, summary.end)
  const previous = shiftDay(summary.start, -1)
  return {
    label: fmt.month(periodMonth(summary.start, summary.end)),
    caption: running ? `${range} · ${fill(copy.dayOfPeriod, { day: daysBetween(summary.start, through) + 1, days })}` : range,
    previous: state.firstDate && previous >= state.firstDate ? previous : null,
    next: running ? null : shiftDay(summary.end, 1),
  }
}

/**
 * The overview's hero: fun money left, the supporting line, the "over plan" chip
 * and the pace chart's series (cumulative fun spending per day against a straight
 * plan line from 0 to the starting allowance).
 */
function heroView(state: MonthlyState, summary: MonthlySummary, expenses: MonthlyExpense[], through: string, fmt: Formatters, copy: MonthlyCopy) {
  const days = daysBetween(summary.start, summary.end) + 1
  const today = daysBetween(summary.start, through) + 1
  const running = summary.end >= state.today
  const daily = Array.from({ length: today }, () => 0)
  for (const expense of expenses) daily[daysBetween(summary.start, expense.occurredOn)] += sourceCents(expense, "fun")
  const cumulative = daily.map((_, index) => daily.slice(0, index + 1).reduce((sum, cents) => sum + cents, 0))
  const overCents = (cumulative[today - 1] ?? 0) - Math.round((summary.startingFunCents * today) / days)
  const daysLeft = days - today
  const remaining = summary.funRemainingCents
  const parts = [fill(copy.ofAmount, { amount: fmt.money(summary.startingFunCents) })]
  if (!running) parts.push(copy.periodClosed)
  else parts.push(daysLeft === 0 ? copy.lastDay : daysLeft === 1 ? copy.dayLeft : fill(copy.daysLeft, { count: daysLeft }))
  if (summary.deficitCarryoverCents > 0) parts.push(`${copy.deficit}: ${fmt.money(summary.deficitCarryoverCents)}`)
  const dayOf = (day: number) => shiftDay(summary.start, day - 1)
  return {
    value: fmt.money(remaining),
    negative: remaining < 0,
    parts,
    // Money left per remaining day, rounded down so it never promises more than there is.
    perDay: running && daysLeft > 0 && remaining > 0 ? fill(copy.perDay, { amount: fmt.money(Math.floor(remaining / daysLeft)) }) : null,
    status: overCents > 0 ? fill(copy.overPlan, { amount: fmt.money(overCents) }) : null,
    chart: {
      days, today, cumulative, budget: summary.startingFunCents,
      dayLabel: (day: number) => fmt.dayShort(dayOf(day)),
      tickLabel: (day: number) => day === 1 ? fmt.dayMonth(dayOf(day)) : fmt.dayOnly(dayOf(day)),
      // A closed period ends at the plan line, where a marker label would collide with "Plan".
      labels: { title: fill(copy.paceTitle, { month: fmt.monthName(periodMonth(summary.start, summary.end)) }), today: running ? copy.today : "", plan: copy.planLine, spent: copy.spent },
    },
  }
}

/** The day a yearly cost falls on inside the period; late due days clamp to short months. */
function dueDate(month: number, day: number, start: string, end: string) {
  for (const year of new Set([Number(start.slice(0, 4)), Number(end.slice(0, 4))])) {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const date = `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`
    if (date >= start && date <= end) return date
  }
  return null
}

const costOrder: Record<CostDue["kind"], number> = { yearly: 0, fixed: 1, monthly: 2 }

/** How many costs the overview lists before it folds the rest into one row. */
const upcomingRows = 5

type UpcomingRow = { id: string; name: string; kind: CostDue["kind"]; amount: string; date: { day: string; weekday: string } | null
  merchant: Merchant | null; description: string | null }
/** A closed period has nothing left to come; an open one lists its costs. */
export type UpcomingView = { status: "closed" } | { status: "open"; rows: UpcomingRow[]; more: string | null; total: string }

/**
 * The costs the plan already covers this period. Only yearly costs have a due day,
 * so they lead, by date; fixed costs and monthly subscriptions follow by kind and
 * amount, labelled by kind instead of a date the model does not have. The total
 * covers every cost, including the ones folded into `more`. A closed period shows
 * no list: its costs are behind it, and `currentPlan` is today's plan, whose due
 * days need not be the ones that period used.
 */
function upcomingView(state: MonthlyState, summary: MonthlySummary, merchantById: Map<string, Merchant>, fmt: Formatters, copy: MonthlyCopy): UpcomingView {
  if (summary.end < state.today) return { status: "closed" }
  const rows = summary.costs.map(cost => {
    const planned = state.currentPlan?.costs.find(item => item.id === cost.id)
    const date = cost.kind === "yearly" && planned?.dueMonth && planned.dueDay ? dueDate(planned.dueMonth, planned.dueDay, summary.start, summary.end) : null
    return { id: cost.id, name: cost.name, kind: cost.kind, amountCents: cost.amountCents, amount: fmt.money(cost.amountCents), sortDate: date ?? "",
      merchant: cost.merchantId ? merchantById.get(cost.merchantId) ?? null : null, description: cost.description,
      date: date ? { day: fmt.dayOnly(date), weekday: fmt.weekday(date) } : null }
  }).sort((a, b) => costOrder[a.kind] - costOrder[b.kind] || a.sortDate.localeCompare(b.sortDate) || b.amountCents - a.amountCents)
  const hidden = rows.length - upcomingRows
  return { status: "open", rows: rows.slice(0, upcomingRows), more: hidden > 0 ? fill(copy.moreCosts, { count: hidden }) : null,
    total: fmt.money(rows.reduce((sum, row) => sum + row.amountCents, 0)) }
}

/** Fun money spent against the allowance in each of the last periods (up to six). */
function trendView(state: MonthlyState, fmt: Formatters, copy: MonthlyCopy) {
  const periods = state.history.map(period => ({
    label: fmt.monthShort(periodMonth(period.start, period.end)), spent: period.startingFunCents - period.funRemainingCents, budget: period.startingFunCents,
    running: period.start <= state.today && state.today <= period.end,
  }))
  return {
    periods,
    title: periods.length > 1 ? fill(copy.trendTitle, { count: periods.length }) : copy.trendTitleOne,
    labels: { spent: copy.spent, budget: copy.budgetLine, running: copy.running, overBudget: copy.overBudget, leftOver: copy.leftOver },
  }
}

type Resource = { status: "loading" } | { status: "failed"; message: string } | { status: "ready"; data: MonthlyState }
/** `notify` receives the confirmation after a successful change, for a toast. */
export function useMonthlyBudget(accessToken: string | undefined, locale: Locale, notify?: (message: string) => void) {
  const copy = monthlyCopy(locale)
  const [resource, setResource] = useState<Resource>({ status: "loading" })
  const [reload, setReload] = useState(0)
  const [selectedDate, setSelectedDate] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    if (!accessToken) return
    loadPeriod(accessToken, selectedDate).then(data => {
      if (active) setResource({ status: "ready", data })
    }).catch((reason: unknown) => {
      if (active) setResource({ status: "failed", message: monthlyError(reason, copy) })
    })
    return () => { active = false }
  }, [accessToken, copy, reload, selectedDate])

  // A failing catalog leaves tiles on the monogram instead of breaking the budget page.
  const [merchants, setMerchants] = useState<Merchant[]>([])
  useEffect(() => {
    let active = true
    if (!accessToken) return
    loadMerchants(accessToken).then(list => { if (active) setMerchants(list) }).catch(() => undefined)
    return () => { active = false }
  }, [accessToken])
  const merchantById = useMemo(() => new Map(merchants.map(merchant => [merchant.id, merchant])), [merchants])
  /** Creates or renames, then replaces the list so the picker and the tiles agree again. */
  const saveMerchant = useCallback(async (name: string, options: { id?: string; archived?: boolean; global?: boolean } = {}) => {
    if (!accessToken) return
    if (options.id) await updateMerchant(accessToken, options.id, { name, archived: options.archived ?? false })
    else await createMerchant(accessToken, name, options.global ?? false)
    setMerchants(await loadMerchants(accessToken))
  }, [accessToken])
  const run: Run = useCallback(async (action, report = "page") => {
    if (busy || !accessToken) return { ok: false, message: copy.errors }
    setBusy(true); setError(null)
    try {
      await action()
      setResource({ status: "ready", data: await loadPeriod(accessToken, selectedDate) })
      notify?.(copy.saved)
      return { ok: true }
    } catch (reason: unknown) {
      const message = monthlyError(reason, copy)
      if (report === "page") setError(message)
      return { ok: false, message }
    } finally { setBusy(false) }
  }, [accessToken, busy, copy, notify, selectedDate])

  const presentation = useMemo(() => {
    if (resource.status !== "ready") return null
    const state = resource.data
    const fmt = formatters(locale, state.currency)
    const categories = state.categories.map(category => {
      const reserve = state.summary?.categories.find(item => item.categoryId === category.id)
      return { ...category, reservedCents: reserve?.reservedCents ?? 0, remainingCents: reserve?.remainingCents ?? 0,
        reserved: fmt.money(reserve?.reservedCents ?? 0), remaining: fmt.money(reserve?.remainingCents ?? 0) }
    })
    const summary = state.summary
    const spentCents = summary ? summary.startingFunCents - summary.funRemainingCents : 0
    const usedFraction = summary && summary.startingFunCents > 0 ? Math.min(1, Math.max(0, spentCents / summary.startingFunCents)) : 0
    // A period is shown through its end, or through today while it runs (see loadPeriod).
    const through = summary && summary.end < state.today ? summary.end : state.today
    const pace = summary ? Math.min(1, Math.max(0, (daysBetween(summary.start, through) + 1) / (daysBetween(summary.start, summary.end) + 1))) : 0
    const inPeriod = state.entries.filter(({ expense, voided }) => !voided && summary && expense.occurredOn >= summary.start && expense.occurredOn <= through)
    const recent: ExpenseRowModel[] = [...inPeriod]
      .sort((a, b) => b.expense.occurredOn.localeCompare(a.expense.occurredOn))
      .slice(0, 6)
      .map(({ expense, voided }) => ({ expense, voided, category: state.categories.find(category => category.id === expense.categoryId), date: fmt.date(expense.occurredOn), amount: fmt.money(expense.amountCents),
        merchant: expense.merchantId ? merchantById.get(expense.merchantId) ?? null : null,
        sources: expense.funding.some(part => part.source !== "fun") ? expense.funding.map(part => part.source === "category" ? copy.categorySource : part.source === "savings" ? copy.savingsSource : part.source === "buffer" ? copy.bufferSource : copy.fun).join(" · ") : "" }))
    const savingsSpentCents = inPeriod.reduce((sum, { expense }) => sum + sourceCents(expense, "savings"), 0)
    const totalSpentCents = inPeriod.reduce((sum, { expense }) => sum + (expense.kind === "refund" ? -expense.amountCents : expense.amountCents), 0)
    const expenseCount = inPeriod.filter(({ expense }) => expense.kind === "expense").length
    const countLabel = (count: number) => count === 1 ? copy.expenseCountOne : fill(copy.expensesCount, { count })
    const savingsCount = inPeriod.filter(({ expense }) => expense.kind === "expense" && expense.funding.some(part => part.source === "savings")).length
    return { fmt, categories, through, spent: fmt.money(spentCents), usedFraction, pace, recent,
      nextFun: fmt.money(state.forecast[1]?.funCents ?? state.forecast[0]?.funCents ?? 0),
      nextFrom: fill(copy.funFrom, { date: fmt.dayMonth(state.nextStart) }),
      fun: fmt.money(state.summary?.funRemainingCents ?? 0), starting: fmt.money(state.summary?.startingFunCents ?? 0),
      savings: fmt.money(state.summary?.savingsBalanceCents ?? 0), buffer: fmt.money(state.summary?.bufferBalanceCents ?? 0),
      contribution: fmt.money(state.summary?.savingsContributionCents ?? 0),
      contributionDelta: `+${fmt.money(state.summary?.savingsContributionCents ?? 0)}`,
      shortfall: fmt.money(state.summary?.fundingShortfallCents ?? 0),
      totals: { spent: fmt.money(totalSpentCents), fromFun: fill(copy.fromFun, { amount: fmt.money(spentCents) }), count: String(expenseCount),
        since: summary ? fill(copy.since, { date: fmt.dayMonth(summary.start) }) : "", usedLabel: fill(copy.usedPercent, { percent: Math.round(usedFraction * 100) }),
        savingsSpent: fmt.money(savingsSpentCents), savingsCount: countLabel(savingsCount) },
      period: summary ? periodView(state, summary, through, fmt, copy) : null,
      hero: summary ? heroView(state, summary, inPeriod.map(({ expense }) => expense), through, fmt, copy) : null,
      upcoming: summary ? upcomingView(state, summary, merchantById, fmt, copy) : null,
      pots: categories.filter(category => category.reservedCents > 0).map(category => {
        const usedCents = category.reservedCents - category.remainingCents
        const used = Math.min(1, Math.max(0, usedCents / category.reservedCents))
        return { category, value: category.remaining, negative: category.remainingCents < 0, addLabel: fill(copy.spendFromPot, { name: category.name }),
          note: fill(category.remainingCents < 0 ? copy.overOf : copy.leftOf, { amount: category.reserved }),
          meter: { fraction: used, marker: pace, label: fill(copy.usedPercent, { percent: Math.round(used * 100) }) } }
      }),
      trend: trendView(state, fmt, copy) }
  }, [resource, locale, copy, merchantById])
  return { resource, presentation, copy, busy, error, run, selectedDate, setSelectedDate, dismissError: () => setError(null),
    merchants, merchantById, saveMerchant, retry: () => setReload(value => value + 1) }
}
