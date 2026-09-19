"use client"

import { useEffect, useMemo, useState } from "react"
import { IconPlus, IconX } from "@tabler/icons-react"

import { FormSelect } from "@/components/app/form-select"
import { Segmented } from "@/components/app/segmented"
import { Block, FormRow, Group, Row } from "@/components/app/grouped"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Locale } from "@/lib/i18n"
import { uuid } from "@/lib/uuid"
import { cn } from "@/lib/utils"

import type { Merchant } from "../merchants"
import { MerchantDirectory } from "../merchant-directory"
import { cancelMonthlyPlan, previewMonthlyPlan, saveMonthlyCategory, saveMonthlyPlan } from "./api"
import { formatters, moneyInput, parseMoney } from "./controller"
import { monthlyCopy, monthlyError } from "./copy"
import type { MonthlyCost, MonthlyForecast, MonthlyPlan, MonthlyState, SavePlan } from "./types"

type CostDraft = { id: string; name: string; amount: string; kind: MonthlyCost["kind"]; month: string; day: string }
type Props = { state: MonthlyState; accessToken: string; locale: Locale; busy: boolean; isAdmin: boolean
  merchants: Merchant[]
  saveMerchant: (name: string, options?: { id?: string; archived?: boolean; global?: boolean }) => Promise<void>
  run: (action: () => Promise<unknown>) => Promise<boolean> }
const emptyPlan: MonthlyPlan = { incomeCents: 0, bufferCents: 0, savingsCents: 0, costs: [], reserves: [] }

export function MonthlyPlanEditor({ state, accessToken, locale, busy, isAdmin, merchants, saveMerchant, run }: Props) {
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
  const [scope, setScope] = useState<"next" | "current">("next")
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
      applyToCurrentPeriod: scope === "current",
      plan: { incomeCents, bufferCents, savingsCents, costs: parsedCosts, reserves: parsedReserves } }
  }, [income, buffer, savings, opening, costs, reserves, scope, state])
  const [previewPayload, setPreviewPayload] = useState("")
  const payloadKey = JSON.stringify(payload)
  const previewCurrent = payloadKey === previewPayload
  const effectiveStart = scope === "current" ? state.summary?.start ?? state.today : state.nextStart
  const comparison = useMemo(() => ({ current: fmt.money(state.forecast[0]?.funCents ?? 0),
    next: previewCurrent && forecast[0] ? fmt.money(forecast[0].funCents) : null,
    effectiveDate: fmt.date(effectiveStart),
  }), [fmt, state.forecast, effectiveStart, previewCurrent, forecast])
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
  const months = Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em] lg:text-[34px]">{state.currentPlan ? copy.plan : copy.setupTitle}</h1>
          <p className="mt-0.5 text-muted-foreground">{state.currentPlan ? `${copy.effective} ${fmt.date(effectiveStart)}` : copy.setupNote}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {state.currentPlan ? (
            <Segmented
              ariaLabel={copy.appliesFrom}
              value={scope}
              options={[{ value: "next", label: copy.applyNext }, { value: "current", label: copy.applyCurrent }]}
              onChange={setScope}
            />
          ) : null}
          {!previewCurrent ? <p className="text-muted-foreground" role="status">{payload ? copy.loading : copy.invalid_input}</p> : null}
          <Button onClick={() => void save()} disabled={busy || !payload || !previewCurrent || previewing}>
            {!state.currentPlan ? copy.startPlan : scope === "current" ? copy.saveCurrentPlan : copy.savePlan}
          </Button>
        </div>
      </div>
      {scope === "current" ? <p className="text-[11px] text-muted-foreground">{copy.applyCurrentNote}</p> : null}

      {state.nextPlan ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            {copy.pending}
            <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm(copy.confirmCancel)) void run(() => cancelMonthlyPlan(accessToken, state.revision)) }}>{copy.cancelPending}</Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}

      {state.currentPlan ? (
        <section className="surface-group grid grid-cols-2 divide-x divide-separator">
          <div className="p-4">
            <p className="text-[11px] text-muted-foreground">{copy.plannedFun} · {copy.current}</p>
            <p className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{comparison.current}</p>
          </div>
          <div className="p-4">
            <p className="text-[11px] text-muted-foreground">{scope === "current" ? copy.current : copy.next} · {comparison.effectiveDate}</p>
            <p className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums" aria-live="polite">{comparison.next ?? "…"}</p>
          </div>
        </section>
      ) : null}

      <fieldset disabled={busy} className="space-y-7">
        <Group title={copy.income}>
          <FormRow label={copy.income} htmlFor="plan-income"><MoneyInput id="plan-income" value={income} onChange={setIncome} /></FormRow>
          <FormRow label={copy.bufferRate} htmlFor="plan-buffer"><MoneyInput id="plan-buffer" value={buffer} onChange={setBuffer} /></FormRow>
          <FormRow label={copy.savingsRate} htmlFor="plan-savings"><MoneyInput id="plan-savings" value={savings} onChange={setSavings} /></FormRow>
          {!state.currentPlan ? <FormRow label={copy.opening} htmlFor="plan-opening"><MoneyInput id="plan-opening" value={opening} onChange={setOpening} /></FormRow> : null}
        </Group>

        {groups.map(group => (
          <Group key={group.kind} title={group.title}>
            {costs.filter(cost => cost.kind === group.kind).map(cost => (
              <div key={cost.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <Label htmlFor={`name-${cost.id}`} className="sr-only">{copy.name}</Label>
                <Input id={`name-${cost.id}`} className="min-w-40 flex-1" placeholder={copy.name} value={cost.name} maxLength={100} onChange={event => updateCost(cost.id, { name: event.target.value })} />
                {cost.kind === "yearly" ? (
                  <>
                    <Label htmlFor={`month-${cost.id}`} className="sr-only">{copy.dueMonth}</Label>
                    <FormSelect id={`month-${cost.id}`} className="w-16" aria-label={copy.dueMonth} value={cost.month} onValueChange={month => updateCost(cost.id, { month })} options={months} />
                    <Label htmlFor={`day-${cost.id}`} className="sr-only">{copy.dueDay}</Label>
                    <Input id={`day-${cost.id}`} className="w-16" type="number" min={1} max={31} aria-label={copy.dueDay} value={cost.day} onChange={event => updateCost(cost.id, { day: event.target.value })} />
                  </>
                ) : null}
                <Label htmlFor={`amount-${cost.id}`} className="sr-only">{copy.amount}</Label>
                <MoneyInput id={`amount-${cost.id}`} value={cost.amount} onChange={amount => updateCost(cost.id, { amount })} />
                <Button size="icon-sm" variant="ghost" onClick={() => setCosts(current => current.filter(item => item.id !== cost.id))} aria-label={`${copy.remove}: ${cost.name || group.title}`}>
                  <IconX />
                </Button>
              </div>
            ))}
            <Row onClick={() => setCosts(current => [...current, { id: uuid(), name: "", amount: "0.00", kind: group.kind, month: "1", day: "1" }])}>
              <IconPlus className="size-4 text-primary" />
              <span className="text-primary">{copy.add}</span>
            </Row>
          </Group>
        ))}

        <Group title={copy.categories} footer={copy.noReserve}>
          {state.categories.map(category => (
            <div key={category.id} className={cn("flex flex-wrap items-center gap-2 px-3 py-2", category.archived && "text-muted-foreground")}>
              <Label className="min-w-0 flex-1 truncate" htmlFor={`reserve-${category.id}`}>
                {category.name}{category.archived ? ` · ${copy.archived}` : ""}
              </Label>
              {!category.archived ? (
                <MoneyInput id={`reserve-${category.id}`} ariaLabel={`${copy.reserve}: ${category.name}`} value={reserves[category.id] ?? "0.00"} onChange={value => setReserves(current => ({ ...current, [category.id]: value }))} />
              ) : null}
              <Button size="xs" variant="outline" onClick={() => { setEditingCategory(category.id); setCategoryName(category.name) }}>{copy.rename}</Button>
              <Button size="xs" variant="outline" onClick={() => void run(() => saveMonthlyCategory(accessToken, category.name, { id: category.id, archived: !category.archived }))}>
                {category.archived ? copy.restore : copy.archive}
              </Button>
            </div>
          ))}
          <Block className="flex flex-wrap items-center gap-2">
            <Label htmlFor="category-name" className="sr-only">{copy.categoryName}</Label>
            <Input id="category-name" className="min-w-40 flex-1" placeholder={copy.categoryName} value={categoryName} maxLength={100} onChange={event => setCategoryName(event.target.value)} />
            <Button variant="outline" disabled={!categoryName.trim()} onClick={async () => {
              const existing = state.categories.find(category => category.id === editingCategory)
              if (await run(() => saveMonthlyCategory(accessToken, categoryName.trim(), existing))) { setCategoryName(""); setEditingCategory(null) }
            }}>{editingCategory ? copy.rename : copy.addCategory}</Button>
            {editingCategory ? <Button variant="ghost" onClick={() => { setCategoryName(""); setEditingCategory(null) }}>{copy.cancel}</Button> : null}
          </Block>
        </Group>
        <MerchantDirectory
          copy={copy}
          merchants={merchants}
          isAdmin={isAdmin}
          busy={busy}
          save={(name, options) => void run(() => saveMerchant(name, options))}
        />
      </fieldset>

      {previewCurrent && forecast.length > 0 ? <Forecast forecast={forecast} locale={locale} currency={state.currency} /> : null}
      <p className="text-[11px] text-muted-foreground">{copy.leftoverNote}</p>
    </div>
  )
}

function MoneyInput({ id, value, onChange, ariaLabel }: { id: string; value: string; onChange: (value: string) => void; ariaLabel?: string }) {
  return <Input id={id} className="w-28 text-right" inputMode="decimal" aria-label={ariaLabel} value={value} onChange={event => onChange(event.target.value)} />
}

export function Forecast({ forecast, locale, currency }: { forecast: MonthlyForecast[]; locale: Locale; currency: string }) {
  const copy = monthlyCopy(locale)
  const rows = useMemo(() => {
    const fmt = formatters(locale, currency)
    return forecast.map(period => ({ key: period.start, period: `${fmt.date(period.start)} – ${fmt.date(period.end)}`, amount: fmt.money(period.funCents),
      negative: period.funCents < 0, bills: period.costs.filter(cost => cost.kind === "yearly").map(cost => `${cost.name} ${fmt.money(cost.amountCents)}`).join(", ") }))
  }, [forecast, locale, currency])
  return (
    <Group title={copy.forecast} footer={copy.forecastNote}>
      {rows.map(row => (
        <Row key={row.key}>
          <div className="min-w-0 flex-1">
            <p>{row.period}</p>
            {row.bills ? <p className="text-[11px] text-muted-foreground">{row.bills}</p> : null}
          </div>
          <span className={cn("font-medium tabular-nums", row.negative && "text-destructive")}>{row.amount}</span>
        </Row>
      ))}
    </Group>
  )
}
