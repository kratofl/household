"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FormSelect } from "@/components/app/form-select"
import type { Locale } from "@/lib/i18n"
import { cancelMonthlyPlan, previewMonthlyPlan, saveMonthlyCategory, saveMonthlyPlan } from "./api"
import { formatters, moneyInput, parseMoney } from "./controller"
import { monthlyCopy, monthlyError } from "./copy"
import type { MonthlyCost, MonthlyForecast, MonthlyPlan, MonthlyState, SavePlan } from "./types"

type CostDraft = { id: string; name: string; amount: string; kind: MonthlyCost["kind"]; month: string; day: string }
type Props = { state: MonthlyState; accessToken: string; locale: Locale; busy: boolean; run: (action: () => Promise<unknown>) => Promise<boolean> }
const emptyPlan: MonthlyPlan = { incomeCents: 0, bufferCents: 0, savingsCents: 0, costs: [], reserves: [] }

export function MonthlyPlanEditor({ state, accessToken, locale, busy, run }: Props) {
  const copy = monthlyCopy(locale)
  const fmt = useMemo(() => formatters(locale, state.currency), [locale, state.currency])
  const base = state.nextPlan ?? state.currentPlan ?? emptyPlan
  const [income, setIncome] = useState(moneyInput(base.incomeCents))
  const [buffer, setBuffer] = useState(moneyInput(base.bufferCents))
  const [savings, setSavings] = useState(moneyInput(base.savingsCents))
  const [opening, setOpening] = useState(moneyInput(state.openingSavingsCents))
  const [costs, setCosts] = useState<CostDraft[]>(() => base.costs.map(cost => ({ id: cost.id, name: cost.name,
    kind: cost.kind, amount: moneyInput(cost.amountCents), month: String(cost.dueMonth ?? 1), day: String(cost.dueDay ?? 1) })))
  const [reserves, setReserves] = useState<Record<string, string>>(() => Object.fromEntries(base.reserves.map(reserve => [reserve.categoryId, moneyInput(reserve.amountCents)])))
  const [categoryName, setCategoryName] = useState("")
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [forecast, setForecast] = useState<MonthlyForecast[]>([])
  const [previewing, setPreviewing] = useState(false)

  const payload = useMemo<SavePlan | null>(() => {
    const incomeCents = parseMoney(income), bufferCents = parseMoney(buffer), savingsCents = parseMoney(savings), openingSavingsCents = parseMoney(opening)
    if (incomeCents === null || bufferCents === null || savingsCents === null || openingSavingsCents === null) return null
    const parsedCosts: MonthlyCost[] = []
    for (const cost of costs) {
      const amountCents = parseMoney(cost.amount)
      if (amountCents === null || !cost.name.trim()) return null
      const dueMonth = cost.kind === "yearly" ? Number(cost.month) : null
      const dueDay = cost.kind === "yearly" ? Number(cost.day) : null
      if (dueMonth !== null && (!Number.isInteger(dueMonth) || dueMonth < 1 || dueMonth > 12)) return null
      if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) return null
      parsedCosts.push({ id: cost.id, name: cost.name.trim(), amountCents, kind: cost.kind, dueMonth, dueDay })
    }
    const parsedReserves: MonthlyPlan["reserves"] = []
    for (const category of state.categories) {
      if (category.archived) continue
      const amountCents = parseMoney(reserves[category.id] ?? "0")
      if (amountCents === null) return null
      if (amountCents > 0) parsedReserves.push({ categoryId: category.id, amountCents })
    }
    return { revision: state.revision, openingSavingsCents,
      timeZoneId: state.currentPlan ? state.timeZoneId : Intl.DateTimeFormat().resolvedOptions().timeZone,
      plan: { incomeCents, bufferCents, savingsCents, costs: parsedCosts, reserves: parsedReserves } }
  }, [income, buffer, savings, opening, costs, reserves, state])
  const [previewPayload, setPreviewPayload] = useState("")
  const payloadKey = JSON.stringify(payload)
  const previewCurrent = payloadKey === previewPayload
  const comparison = useMemo(() => ({ current: fmt.money(state.forecast[0]?.funCents ?? 0),
    next: previewCurrent && forecast[0] ? fmt.money(forecast[0].funCents) : null,
    effectiveDate: fmt.date(state.nextStart),
  }), [fmt, state.forecast, state.nextStart, previewCurrent, forecast])
  const updateCost = (id: string, update: Partial<CostDraft>) => setCosts(current => current.map(cost => cost.id === id ? { ...cost, ...update } : cost))
  useEffect(() => {
    let active = true
    if (!payload) return
    const timer = window.setTimeout(() => {
      setPreviewing(true)
      previewMonthlyPlan(accessToken, payload).then(result => {
        if (active) { setForecast(result); setPreviewPayload(JSON.stringify(payload)); setError(null) }
      }).catch((reason: unknown) => { if (active) setError(monthlyError(reason, copy)) })
        .finally(() => { if (active) setPreviewing(false) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [accessToken, payload, copy])
  const save = async () => {
    if (!payload) { setError(copy.invalid_input); return }
    await run(() => saveMonthlyPlan(accessToken, payload))
  }
  const groups: { kind: MonthlyCost["kind"]; title: string }[] = [
    { kind: "fixed", title: copy.fixed }, { kind: "monthly", title: copy.monthly }, { kind: "yearly", title: copy.yearly },
  ]
  return <div className="space-y-6">
    <div><h2 className="text-xl font-semibold">{state.currentPlan ? copy.plan : copy.setupTitle}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{state.currentPlan ? `${copy.effective} ${fmt.date(state.nextStart)}` : copy.setupNote}</p></div>
    {state.nextPlan && <Alert><AlertDescription className="flex flex-wrap items-center justify-between gap-3">{copy.pending}
      <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm(copy.confirmCancel)) void run(() => cancelMonthlyPlan(accessToken, state.revision)) }}>{copy.cancelPending}</Button>
    </AlertDescription></Alert>}
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {state.currentPlan && <Card><CardHeader><CardTitle>{copy.plannedFun}</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4">
      <div><p className="text-sm text-muted-foreground">{copy.current}</p><p className="text-2xl font-semibold tabular-nums">{comparison.current}</p></div>
      <div><p className="text-sm text-muted-foreground">{copy.next} · {comparison.effectiveDate}</p><p className="text-2xl font-semibold tabular-nums" aria-live="polite">{comparison.next ?? "…"}</p></div>
    </CardContent></Card>}
    <fieldset disabled={busy} className="space-y-6">
      <Card><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[{ id: "income", label: copy.income, value: income, set: setIncome }, { id: "buffer", label: copy.bufferRate, value: buffer, set: setBuffer },
          { id: "savings", label: copy.savingsRate, value: savings, set: setSavings }].map(field => <div key={field.id} className="space-y-2">
          <Label htmlFor={`plan-${field.id}`}>{field.label}</Label><Input id={`plan-${field.id}`} inputMode="decimal" value={field.value} onChange={event => field.set(event.target.value)} /></div>)}
        {!state.currentPlan && <div className="space-y-2"><Label htmlFor="plan-opening">{copy.opening}</Label><Input id="plan-opening" inputMode="decimal" value={opening} onChange={event => setOpening(event.target.value)} /></div>}
      </CardContent></Card>
      {groups.map(group => <Card key={group.kind}><CardHeader><CardTitle>{group.title}</CardTitle></CardHeader><CardContent className="space-y-3">
        {costs.filter(cost => cost.kind === group.kind).map(cost => <div key={cost.id} className="flex flex-wrap items-end gap-3 rounded-md border p-3">
          <div className="min-w-0 flex-1 space-y-2"><Label htmlFor={`name-${cost.id}`}>{copy.name}</Label><Input id={`name-${cost.id}`} value={cost.name} maxLength={100} onChange={event => updateCost(cost.id, { name: event.target.value })} /></div>
          <div className="w-32 space-y-2"><Label htmlFor={`amount-${cost.id}`}>{copy.amount}</Label><Input id={`amount-${cost.id}`} inputMode="decimal" value={cost.amount} onChange={event => updateCost(cost.id, { amount: event.target.value })} /></div>
          {cost.kind === "yearly" && <><div className="w-28 space-y-2"><Label htmlFor={`month-${cost.id}`}>{copy.dueMonth}</Label><FormSelect id={`month-${cost.id}`} value={cost.month} onValueChange={month => updateCost(cost.id, { month })} options={Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))} /></div>
            <div className="w-24 space-y-2"><Label htmlFor={`day-${cost.id}`}>{copy.dueDay}</Label><Input id={`day-${cost.id}`} type="number" min={1} max={31} value={cost.day} onChange={event => updateCost(cost.id, { day: event.target.value })} /></div></>}
          <Button variant="ghost" onClick={() => setCosts(current => current.filter(item => item.id !== cost.id))} aria-label={`${copy.remove}: ${cost.name || group.title}`}>{copy.remove}</Button>
        </div>)}
        <Button variant="outline" onClick={() => setCosts(current => [...current, { id: crypto.randomUUID(), name: "", amount: "0.00", kind: group.kind, month: "1", day: "1" }])}>{copy.add} · {group.title}</Button>
      </CardContent></Card>)}
      <Card><CardHeader><CardTitle>{copy.categories}</CardTitle><CardDescription>{copy.noReserve}</CardDescription></CardHeader><CardContent className="space-y-4">
        {state.categories.map(category => <div key={category.id} className="flex flex-wrap items-center gap-3 border-b pb-3">
          <Label className="flex-1" htmlFor={`reserve-${category.id}`}>{category.name}{category.archived ? ` · ${copy.archived}` : ""}</Label>
          {!category.archived && <Input className="w-32" aria-label={`${copy.reserve}: ${category.name}`} id={`reserve-${category.id}`} inputMode="decimal" value={reserves[category.id] ?? "0.00"} onChange={event => setReserves(current => ({ ...current, [category.id]: event.target.value }))} />}
          <Button variant="ghost" onClick={() => { setEditingCategory(category.id); setCategoryName(category.name) }}>{copy.rename}</Button>
          <Button variant="ghost" onClick={() => void run(() => saveMonthlyCategory(accessToken, category.name, { id: category.id, archived: !category.archived }))}>{category.archived ? copy.restore : copy.archive}</Button>
        </div>)}
        <div className="flex flex-wrap items-end gap-3"><div className="flex-1 space-y-2"><Label htmlFor="category-name">{copy.categoryName}</Label><Input id="category-name" value={categoryName} maxLength={100} onChange={event => setCategoryName(event.target.value)} /></div>
          <Button variant="outline" disabled={!categoryName.trim()} onClick={async () => {
            const existing = state.categories.find(category => category.id === editingCategory)
            if (await run(() => saveMonthlyCategory(accessToken, categoryName.trim(), existing))) { setCategoryName(""); setEditingCategory(null) }
          }}>{editingCategory ? copy.rename : copy.addCategory}</Button>
          {editingCategory && <Button variant="ghost" onClick={() => { setCategoryName(""); setEditingCategory(null) }}>{copy.cancel}</Button>}
        </div>
      </CardContent></Card>
      <div className="flex flex-wrap items-center gap-3"><Button onClick={() => void save()} disabled={!payload || !previewCurrent || previewing}>{state.currentPlan ? copy.savePlan : copy.startPlan}</Button>
        {!previewCurrent && <p className="text-sm text-muted-foreground" role="status">{payload ? copy.loading : copy.invalid_input}</p>}</div>
    </fieldset>
    {previewCurrent && forecast.length > 0 && <Forecast forecast={forecast} locale={locale} currency={state.currency} />}
    <p className="text-sm text-muted-foreground">{copy.leftoverNote}</p>
  </div>
}

export function Forecast({ forecast, locale, currency }: { forecast: MonthlyForecast[]; locale: Locale; currency: string }) {
  const copy = monthlyCopy(locale)
  const rows = useMemo(() => {
    const fmt = formatters(locale, currency)
    return forecast.map(period => ({ key: period.start, period: `${fmt.date(period.start)} – ${fmt.date(period.end)}`, amount: fmt.money(period.funCents),
      negative: period.funCents < 0, bills: period.costs.filter(cost => cost.kind === "yearly").map(cost => `${cost.name} ${fmt.money(cost.amountCents)}`).join(", ") }))
  }, [forecast, locale, currency])
  return <Card><CardHeader><CardTitle>{copy.forecast}</CardTitle><CardDescription>{copy.forecastNote}</CardDescription></CardHeader><CardContent>
    <dl className="divide-y">{rows.map(row => <div key={row.key} className="flex flex-wrap justify-between gap-3 py-3"><dt><span>{row.period}</span>{row.bills && <p className="text-muted-foreground">{row.bills}</p>}</dt><dd className={row.negative ? "font-semibold text-destructive" : "font-semibold tabular-nums"}>{row.amount}</dd></div>)}</dl>
  </CardContent></Card>
}
