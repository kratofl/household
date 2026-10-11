"use client"

import { useEffect, useMemo, useState } from "react"
import { IconPlus, IconX } from "@tabler/icons-react"

import { FormSelect } from "@/components/app/form-select"
import { KpiCard } from "@/components/app/kpi-card"
import { Segmented } from "@/components/app/segmented"
import { Block, FormRow, Group, Row } from "@/components/app/grouped"
import { PageHeader } from "@/components/app/page-header"
import { FormFeedback } from "./form-feedback"
import { CategoryAppearancePicker } from "./category-appearance-picker"
import { categoryVisual } from "./category-visuals"
import { IconTile } from "@/components/app/grouped"
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
type Props = { section: string; serverError: string | null; state: MonthlyState; accessToken: string; locale: Locale; busy: boolean; isAdmin: boolean
  merchants: Merchant[]
  saveMerchant: (name: string, options?: { id?: string; archived?: boolean; global?: boolean }) => Promise<void>
  run: (action: () => Promise<unknown>) => Promise<boolean> }
const emptyPlan: MonthlyPlan = { incomeCents: 0, bufferCents: 0, savingsCents: 0, costs: [], reserves: [] }

export function MonthlyPlanEditor({ section, serverError, state, accessToken, locale, busy, isAdmin, merchants, saveMerchant, run }: Props) {
  const copy = monthlyCopy(locale)
  const fmt = useMemo(() => formatters(locale, state.currency), [locale, state.currency])
  const base = state.nextPlan ?? state.currentPlan ?? emptyPlan
  const [income, setIncome] = useState(moneyInput(base.incomeCents, locale))
  const [buffer, setBuffer] = useState(moneyInput(base.bufferCents, locale))
  const [savings, setSavings] = useState(moneyInput(base.savingsCents, locale))
  const [opening, setOpening] = useState(moneyInput(state.openingSavingsCents, locale))
  const [costs, setCosts] = useState<CostDraft[]>(() => base.costs.map(cost => ({ id: cost.id, name: cost.name,
    kind: cost.kind, amount: moneyInput(cost.amountCents, locale), month: String(cost.dueMonth ?? 1), day: String(cost.dueDay ?? 1) })))
  const [reserves, setReserves] = useState<Record<string, string>>(() => Object.fromEntries(base.reserves.map(reserve => [reserve.categoryId, moneyInput(reserve.amountCents, locale)])))
  const [step, setStep] = useState(0)
  const [color, setColor] = useState<string | null>(null)
  const [icon, setIcon] = useState("tag")
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
    if (await run(() => saveMonthlyPlan(accessToken, payload))) setError(null)
  }
  const groups: { kind: MonthlyCost["kind"]; title: string }[] = [
    { kind: "fixed", title: copy.fixed }, { kind: "monthly", title: copy.monthly }, { kind: "yearly", title: copy.yearly },
  ]
  const months = Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))

  return (
    <div className="space-y-4">
      <PageHeader
        title={!state.currentPlan ? copy.setupTitle : section === "plan" ? copy.incomeReserves : section === "fixed" ? copy.fixed : section === "monthly" ? copy.monthly : section === "yearly" ? copy.yearly : section === "categories" ? copy.categories : copy.merchants}
        subtitle={!state.currentPlan ? copy.setupNote : section !== "merchants" ? `${copy.effective} ${fmt.date(effectiveStart)}` : undefined}
      />
      {!state.currentPlan ? (
        <ol aria-label={copy.setupTitle} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[copy.income, copy.costs, copy.categories, copy.review].map((label, index) => (
            <li key={label} aria-current={step === index ? "step" : undefined} className={cn("rounded-md px-3 py-2 text-footnote", step === index ? "bg-brand-100 text-brand-900 dark:bg-brand-500/20 dark:text-brand-300" : "bg-fill text-label-secondary")}>
              {index + 1}. {label}
            </li>
          ))}
        </ol>
      ) : null}
      {state.currentPlan && section !== "merchants" ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Segmented
            ariaLabel={copy.appliesFrom}
            value={scope}
            options={[{ value: "next", label: copy.applyNext }, { value: "current", label: copy.applyCurrent }]}
            onChange={setScope}
          />
          {scope === "current" ? <p className="text-footnote text-label-secondary">{copy.applyCurrentNote}</p> : null}
        </div>
      ) : null}

      {state.nextPlan ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            {copy.pending}
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => { if (window.confirm(copy.confirmCancel)) void run(() => cancelMonthlyPlan(accessToken, state.revision)) }}>{copy.cancelPending}</Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <FormFeedback error={serverError || error || (!payload ? copy.invalid_input : null)} status={section !== "merchants" && payload && !previewCurrent ? copy.loading : null} />

      {state.currentPlan && section !== "merchants" ? (
        <div className="grid grid-cols-2 gap-4">
          <KpiCard label={`${copy.plannedFun} · ${copy.current}`} value={comparison.current} />
          <div aria-live="polite">
            <KpiCard label={`${scope === "current" ? copy.current : copy.next} · ${comparison.effectiveDate}`} value={comparison.next ?? "…"} />
          </div>
        </div>
      ) : null}

      <fieldset disabled={busy} className="space-y-4">
        {(state.currentPlan ? section === "plan" : step === 0) ? <Group title={copy.income}>
          <FormRow label={copy.income} htmlFor="plan-income"><MoneyInput id="plan-income" value={income} onChange={setIncome} /></FormRow>
          <FormRow label={copy.bufferRate} htmlFor="plan-buffer"><MoneyInput id="plan-buffer" value={buffer} onChange={setBuffer} /></FormRow>
          <FormRow label={copy.savingsRate} htmlFor="plan-savings"><MoneyInput id="plan-savings" value={savings} onChange={setSavings} /></FormRow>
          {!state.currentPlan ? <FormRow label={copy.opening} htmlFor="plan-opening"><MoneyInput id="plan-opening" value={opening} onChange={setOpening} /></FormRow> : null}
        </Group> : null}

        {groups.filter(group => state.currentPlan ? section === group.kind : step === 1).map(group => (
          <Group key={group.kind} title={group.title}>
            {costs.filter(cost => cost.kind === group.kind).map(cost => (
              <div key={cost.id} className="flex min-h-9 flex-wrap items-center gap-2 px-4 py-1.5 max-lg:min-h-12 max-lg:py-2">
                <Label htmlFor={`name-${cost.id}`} className="sr-only">{copy.name}</Label>
                <Input id={`name-${cost.id}`} className="min-w-40 flex-1" placeholder={copy.name} value={cost.name} maxLength={100} onChange={event => updateCost(cost.id, { name: event.target.value })} />
                {cost.kind === "yearly" ? (
                  <>
                    <Label htmlFor={`month-${cost.id}`} className="sr-only">{copy.dueMonth}</Label>
                    <FormSelect id={`month-${cost.id}`} className="w-20" aria-label={copy.dueMonth} value={cost.month} onValueChange={month => updateCost(cost.id, { month })} options={months} />
                    <Label htmlFor={`day-${cost.id}`} className="sr-only">{copy.dueDay}</Label>
                    <Input id={`day-${cost.id}`} className="w-16" type="number" min={1} max={31} aria-label={copy.dueDay} value={cost.day} onChange={event => updateCost(cost.id, { day: event.target.value })} />
                  </>
                ) : null}
                <Label htmlFor={`amount-${cost.id}`} className="sr-only">{copy.amount}</Label>
                <MoneyInput id={`amount-${cost.id}`} value={cost.amount} onChange={amount => updateCost(cost.id, { amount })} />
                <Button size="icon" variant="ghost" onClick={() => setCosts(current => current.filter(item => item.id !== cost.id))} aria-label={`${copy.remove}: ${cost.name || group.title}`}>
                  <IconX />
                </Button>
              </div>
            ))}
            <Row onClick={() => setCosts(current => [...current, { id: uuid(), name: "", amount: moneyInput(0, locale), kind: group.kind, month: "1", day: "1" }])}>
              <IconPlus className="size-[18px] text-brand-500" />
              <span className="font-medium text-link">{copy.add}</span>
            </Row>
          </Group>
        ))}

        {(state.currentPlan ? section === "categories" : step === 2) ? <Group title={copy.categories} footer={copy.noReserve}>
          {!state.currentPlan ? <Block>{copy.setupCategories}</Block> : null}
          {state.categories.map(category => (
            <div key={category.id} className={cn("flex min-h-9 flex-wrap items-center gap-2 px-4 py-1.5 max-lg:min-h-12 max-lg:py-2", category.archived && "text-label-secondary")}>
              <IconTile icon={categoryVisual(category.name, category).icon} tone={categoryVisual(category.name, category).tone} />
              <Label className="min-w-0 flex-1 truncate text-callout font-normal" htmlFor={`reserve-${category.id}`}>
                {category.name}{category.archived ? ` · ${copy.archived}` : ""}
              </Label>
              {!category.archived ? (
                <MoneyInput id={`reserve-${category.id}`} ariaLabel={`${copy.reserve}: ${category.name}`} value={reserves[category.id] ?? moneyInput(0, locale)} onChange={value => setReserves(current => ({ ...current, [category.id]: value }))} />
              ) : null}
              <Button size="sm" variant="secondary" onClick={() => { setEditingCategory(category.id); setCategoryName(category.name); setColor(category.color); setIcon(category.icon) }}>{copy.edit}</Button>
              <Button size="sm" variant="secondary" onClick={() => void run(() => saveMonthlyCategory(accessToken, category.name, { id: category.id, archived: !category.archived }))}>
                {category.archived ? copy.restore : copy.archive}
              </Button>
            </div>
          ))}
          <Block className="flex flex-wrap items-center gap-2">
            <Label htmlFor="category-name" className="sr-only">{copy.categoryName}</Label>
            <Input id="category-name" className="min-w-40 flex-1" placeholder={copy.categoryName} value={categoryName} maxLength={100} onChange={event => setCategoryName(event.target.value)} />
            <CategoryAppearancePicker allowAutomatic={!editingCategory} locale={locale} color={color} icon={icon} onColor={setColor} onIcon={setIcon} />
            <Button variant="secondary" disabled={!categoryName.trim()} onClick={async () => {
              const existing = state.categories.find(category => category.id === editingCategory)
              if (await run(() => saveMonthlyCategory(accessToken, categoryName.trim(), existing, { color, icon }))) { setCategoryName(""); setEditingCategory(null); setColor(null); setIcon("tag") }
            }}>{editingCategory ? copy.saveCategory : copy.addCategory}</Button>
            {editingCategory ? <Button variant="text" onClick={() => { setCategoryName(""); setEditingCategory(null); setColor(null); setIcon("tag") }}>{copy.cancel}</Button> : null}
          </Block>
        </Group> : null}
        {state.currentPlan && section === "merchants" ? <MerchantDirectory
          copy={copy}
          merchants={merchants}
          isAdmin={isAdmin}
          busy={busy}
          save={(name, options) => void run(() => saveMerchant(name, options))}
        /> : null}
      </fieldset>

      {!state.currentPlan && step === 3 ? (
        <Group title={copy.review} footer={copy.setupReview}>
          <Row><span className="flex-1">{copy.income}</span>{fmt.money(payload?.plan.incomeCents ?? 0)}</Row>
          <Row><span className="flex-1">{copy.bufferRate}</span>{fmt.money(payload?.plan.bufferCents ?? 0)}</Row>
          <Row><span className="flex-1">{copy.savingsRate}</span>{fmt.money(payload?.plan.savingsCents ?? 0)}</Row>
          <Row><span className="flex-1">{copy.opening}</span>{fmt.money(payload?.openingSavingsCents ?? 0)}</Row>
          <Row><span className="flex-1">{copy.categories}</span>{state.categories.filter(category => !category.archived).length}</Row>
        </Group>
      ) : null}
      {section !== "merchants" || !state.currentPlan ? <>
        <p className="text-footnote text-label-secondary">{copy.moneyHint}</p>
        <p className="text-footnote text-label-secondary">{copy.leftoverNote}</p>
        <div className="flex flex-wrap justify-between gap-3">
          {!state.currentPlan && step > 0 ? <Button variant="secondary" disabled={busy} onClick={() => setStep(current => current - 1)}>{copy.back}</Button> : null}
          {!state.currentPlan && step < 3 ? (
            <Button disabled={busy || !payload || (step === 2 && !state.categories.some(category => !category.archived))} onClick={() => setStep(current => current + 1)}>{copy.continue}</Button>
          ) : (
            <Button onClick={() => void save()} disabled={busy || !payload || !previewCurrent || previewing}>
              {!state.currentPlan ? copy.startPlan : scope === "current" ? copy.saveCurrentPlan : copy.savePlan}
            </Button>
          )}
        </div>
      </> : null}
      {(state.currentPlan ? section !== "merchants" : step === 3) && previewCurrent && forecast.length > 0 ? <Forecast forecast={forecast} locale={locale} currency={state.currency} /> : null}
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
            {row.bills ? <p className="text-footnote text-label-secondary">{row.bills}</p> : null}
          </div>
          <span className={cn("font-medium tabular-nums", row.negative && "text-danger-text")}>{row.amount}</span>
        </Row>
      ))}
    </Group>
  )
}
