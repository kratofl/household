"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Locale } from "@/lib/i18n"
import { loadMonthlyBudget } from "./api"
import { monthlyCopy, monthlyError } from "./copy"
import type { MonthlyState } from "./types"

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
  return { money: (cents: number) => amount.format(cents / 100), date: (value: string) => date.format(new Date(`${value}T12:00:00Z`)),
    month: (value: string) => month.format(new Date(`${value}T12:00:00Z`)) }
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
    return { fmt, categories, reserveCards: categories.filter(category => category.reservedCents > 0),
      period: state.summary ? `${fmt.date(state.summary.start)} – ${fmt.date(state.summary.end)}` : "",
      nextStart: fmt.date(state.nextStart),
      fun: fmt.money(state.summary?.funRemainingCents ?? 0), starting: fmt.money(state.summary?.startingFunCents ?? 0),
      savings: fmt.money(state.summary?.savingsBalanceCents ?? 0), buffer: fmt.money(state.summary?.bufferBalanceCents ?? 0),
      contribution: fmt.money(state.summary?.savingsContributionCents ?? 0),
      deficit: fmt.money(state.summary?.deficitCarryoverCents ?? 0), shortfall: fmt.money(state.summary?.fundingShortfallCents ?? 0) }
  }, [resource, locale])
  return { resource, presentation, copy, busy, error, message, run, selectedDate, setSelectedDate, retry: () => setReload(value => value + 1) }
}
