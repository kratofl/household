"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Locale } from "@/lib/i18n"
import { loadMonthlyBudget } from "./api"
import { monthlyCopy, monthlyError } from "./copy"
import type { MonthlyExpense, MonthlyState } from "./types"

export function parseMoney(value: string): number | null {
  const match = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(value.trim())
  if (!match) return null
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"))
  return cents <= 10_000_000_000 ? cents : null
}
export function moneyInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`
}
export function formatters(locale: Locale, currency: string) {
  const amount = new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", { style: "currency", currency })
  const date = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { dateStyle: "medium", timeZone: "UTC" })
  const month = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
  const day = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
  return { money: (cents: number) => amount.format(cents / 100), date: (value: string) => date.format(new Date(`${value}T12:00:00Z`)),
    month: (value: string) => month.format(new Date(`${value}T12:00:00Z`)), day: (value: string) => day.format(new Date(`${value}T12:00:00Z`)) }
}
export type Formatters = ReturnType<typeof formatters>

/** One expense prepared for a list row. */
export type ExpenseRowModel = { expense: MonthlyExpense; voided: boolean; date: string; amount: string; sources: string }

/** Groups prepared rows by calendar day, newest first, with a signed day total (refunds count negative). */
export function groupRowsByDay(rows: ExpenseRowModel[], fmt: Formatters) {
  const byDay = new Map<string, ExpenseRowModel[]>()
  for (const row of [...rows].sort((a, b) => b.expense.occurredOn.localeCompare(a.expense.occurredOn))) {
    const list = byDay.get(row.expense.occurredOn) ?? []
    list.push(row)
    byDay.set(row.expense.occurredOn, list)
  }
  return [...byDay.entries()].map(([date, list]) => ({
    date, label: fmt.day(date), rows: list,
    total: fmt.money(list.filter(row => !row.voided).reduce((sum, row) => sum + (row.expense.kind === "refund" ? -row.expense.amountCents : row.expense.amountCents), 0)),
  }))
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000)
}

type Resource = { status: "loading" } | { status: "failed"; message: string } | { status: "ready"; data: MonthlyState }
export function useMonthlyBudget(accessToken: string | undefined, locale: Locale) {
  const copy = monthlyCopy(locale)
  const [resource, setResource] = useState<Resource>({ status: "loading" })
  const [reload, setReload] = useState(0)
  const [selectedDate, setSelectedDate] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    if (!accessToken) return
    loadMonthlyBudget(accessToken, selectedDate || undefined).then(data => {
      if (active) setResource({ status: "ready", data })
    }).catch((reason: unknown) => {
      if (active) setResource({ status: "failed", message: monthlyError(reason, copy) })
    })
    return () => { active = false }
  }, [accessToken, copy, reload, selectedDate])

  const run = useCallback(async (action: () => Promise<unknown>) => {
    if (busy || !accessToken) return false
    setBusy(true); setError(null); setMessage(null)
    try {
      await action()
      setResource({ status: "ready", data: await loadMonthlyBudget(accessToken, selectedDate || undefined) })
      setMessage(copy.saved)
      return true
    } catch (reason: unknown) {
      setError(monthlyError(reason, copy))
      return false
    } finally { setBusy(false) }
  }, [accessToken, busy, copy, selectedDate])

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
    const viewDate = selectedDate && summary && selectedDate <= summary.end ? selectedDate : state.today
    const pace = summary ? Math.min(1, Math.max(0, (daysBetween(summary.start, viewDate) + 1) / (daysBetween(summary.start, summary.end) + 1))) : 0
    const recent: ExpenseRowModel[] = state.entries
      .filter(({ expense, voided }) => !voided && summary && expense.occurredOn >= summary.start && expense.occurredOn <= viewDate)
      .sort((a, b) => b.expense.occurredOn.localeCompare(a.expense.occurredOn))
      .slice(0, 5)
      .map(({ expense, voided }) => ({ expense, voided, date: fmt.date(expense.occurredOn), amount: fmt.money(expense.amountCents),
        sources: expense.funding.some(part => part.source !== "fun") ? expense.funding.map(part => part.source === "category" ? copy.categorySource : part.source === "savings" ? copy.savingsSource : part.source === "buffer" ? copy.bufferSource : copy.fun).join(" · ") : "" }))
    return { fmt, categories, reserveCards: categories.filter(category => category.reservedCents > 0),
      period: summary ? `${fmt.date(summary.start)} – ${fmt.date(summary.end)}` : "",
      nextStart: fmt.date(state.nextStart), spent: fmt.money(spentCents), usedFraction, pace, recent,
      nextFun: fmt.money(state.forecast[1]?.funCents ?? state.forecast[0]?.funCents ?? 0),
      fun: fmt.money(state.summary?.funRemainingCents ?? 0), starting: fmt.money(state.summary?.startingFunCents ?? 0),
      savings: fmt.money(state.summary?.savingsBalanceCents ?? 0), buffer: fmt.money(state.summary?.bufferBalanceCents ?? 0),
      contribution: fmt.money(state.summary?.savingsContributionCents ?? 0),
      deficit: fmt.money(state.summary?.deficitCarryoverCents ?? 0), shortfall: fmt.money(state.summary?.fundingShortfallCents ?? 0) }
  }, [resource, locale, selectedDate, copy])
  return { resource, presentation, copy, busy, error, message, run, selectedDate, setSelectedDate, retry: () => setReload(value => value + 1) }
}
