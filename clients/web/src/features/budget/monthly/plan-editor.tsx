"use client"

// The plan pages and the guided setup. One draft of the monthly plan (usePlanDraft) is
// shared by every section, so changes on Fixed costs and on Categories save together.
// Each page puts its title, the "takes effect" segmented control, its date and the
// page's action into the toolbar, and keeps hints, errors and the save summary inside
// the card they belong to (DESIGN.md, Layout).
//
//   Income & reserves  Plan type: breakdown of the period, its parts as a strip, the form.
//   Fixed / monthly / yearly costs, Categories  List type: totals strip, one card of rows.
//   Merchants  merchant-directory.tsx.
//   No plan yet  the setup: one card per step in a settings-width column.

import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  IconCheck, IconDots, IconMoodSmile, IconPigMoney, IconPlus, IconReceipt, IconRepeat, IconTag, IconX,
} from "@tabler/icons-react"

import { BreakdownChart } from "@/components/app/charts"
import { FormSelect } from "@/components/app/form-select"
import { Field } from "@/components/app/field"
import { FormRow, Group, IconTile, listCardClass, Row } from "@/components/app/grouped"
import { MetricStrip, type MetricCell } from "@/components/app/metric-strip"
import { PageHeader } from "@/components/app/page-header"
import { Segmented } from "@/components/app/segmented"
import { ToolbarButton, type ToolbarPrimaryAction } from "@/components/app/toolbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import type { Locale } from "@/lib/i18n"
import { budgetViews } from "@/lib/modules"
import { uuid } from "@/lib/uuid"
import { cn } from "@/lib/utils"

import type { Merchant } from "../merchants"
import { MerchantDirectory } from "../merchant-directory"
import { cancelMonthlyPlan, previewMonthlyPlan, saveMonthlyCategory, saveMonthlyPlan } from "./api"
import { CategoryAppearancePicker } from "./category-appearance-picker"
import { categoryVisual } from "./category-visuals"
import { fill, formatters, moneyInput, parseMoney, type Formatters } from "./controller"
import { type MonthlyCopy, monthlyCopy, monthlyError } from "./copy"
import type { MonthlyCategory, MonthlyCost, MonthlyForecast, MonthlyPlan, MonthlyState, SavePlan } from "./types"
import { addDays, costTotal, daysBetween, nextYearlyDue, periodBreakdown, type CostDraft } from "./view-models"

type Run = (action: () => Promise<unknown>) => Promise<boolean>
type Props = { section: string; serverError: string | null; state: MonthlyState; accessToken: string; locale: Locale; busy: boolean; isAdmin: boolean
  merchants: Merchant[]
  saveMerchant: (name: string, options?: { id?: string; archived?: boolean; global?: boolean }) => Promise<void>
  run: Run }
/** What the category sheet edits: a new category or an existing one. */
type CategoryTarget = { kind: "new" } | { kind: "edit"; category: MonthlyCategory }
type Draft = ReturnType<typeof usePlanDraft>
/** What every plan page needs besides its own section. */
type PageProps = Props & { draft: Draft; copy: MonthlyCopy; fmt: Formatters }

const emptyPlan: MonthlyPlan = { incomeCents: 0, bufferCents: 0, savingsCents: 0, costs: [], reserves: [] }
const costKinds: MonthlyCost["kind"][] = ["fixed", "monthly", "yearly"]

export function MonthlyPlanEditor(props: Props) {
  const copy = monthlyCopy(props.locale)
  const fmt = useMemo(() => formatters(props.locale, props.state.currency), [props.locale, props.state.currency])
  const draft = usePlanDraft(props, copy)
  const page: PageProps = { ...props, draft, copy, fmt }
  if (!props.state.currentPlan) return <PlanSetup {...page} />
  if (props.section === "merchants") {
    return <MerchantDirectory copy={copy} merchants={props.merchants} isAdmin={props.isAdmin} busy={props.busy}
      save={(name, options) => props.run(() => props.saveMerchant(name, options))} />
  }
  if (props.section === "fixed" || props.section === "monthly" || props.section === "yearly") return <CostsPage {...page} kind={props.section} />
  if (props.section === "categories") return <CategoriesPage {...page} />
  return <IncomePage {...page} />
}

/**
 * The editable plan: text fields for every amount, the payload they parse to (null while
 * any field is invalid), a debounced server preview of the next 12 periods, and save.
 * Edits the pending plan when there is one, otherwise the current plan.
 */
function usePlanDraft({ state, accessToken, locale, run }: Props, copy: MonthlyCopy) {
  const base = state.nextPlan ?? state.currentPlan ?? emptyPlan
  const [income, setIncome] = useState(moneyInput(base.incomeCents, locale))
  const [buffer, setBuffer] = useState(moneyInput(base.bufferCents, locale))
  const [savings, setSavings] = useState(moneyInput(base.savingsCents, locale))
  const [opening, setOpening] = useState(moneyInput(state.openingSavingsCents, locale))
  const [costs, setCosts] = useState<CostDraft[]>(() => base.costs.map(cost => ({ id: cost.id, name: cost.name,
    kind: cost.kind, amount: moneyInput(cost.amountCents, locale), month: String(cost.dueMonth ?? 1), day: String(cost.dueDay ?? 1) })))
  const [reserves, setReserves] = useState<Record<string, string>>(() => Object.fromEntries(base.reserves.map(reserve => [reserve.categoryId, moneyInput(reserve.amountCents, locale)])))
  const [scope, setScope] = useState<"next" | "current">("next")
  const [error, setError] = useState<string | null>(null)
  const [forecast, setForecast] = useState<MonthlyForecast[]>([])
  const [previewing, setPreviewing] = useState(false)
  // The cost row just added, so its name field takes focus.
  const [added, setAdded] = useState<string | null>(null)

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
  const previewCurrent = JSON.stringify(payload) === previewPayload
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

  const effectiveStart = scope === "current" ? state.summary?.start ?? state.today : state.nextStart
  return {
    income, setIncome, buffer, setBuffer, savings, setSavings, opening, setOpening, costs, reserves, scope, setScope, payload,
    forecast, previewCurrent, previewing, error, effectiveStart, added,
    /** Planned fun money from the effective date: with this draft, and with the saved plans. */
    fun: { draft: previewCurrent ? forecast[0]?.funCents ?? null : null, saved: state.forecast.find(period => period.start === effectiveStart)?.funCents ?? null },
    canSave: payload !== null && previewCurrent && !previewing,
    updateCost: (id: string, update: Partial<CostDraft>) => setCosts(current => current.map(cost => cost.id === id ? { ...cost, ...update } : cost)),
    addCost: (kind: MonthlyCost["kind"]) => {
      const id = uuid()
      setCosts(current => [...current, { id, name: "", amount: moneyInput(0, locale), kind, month: "1", day: "1" }])
      setAdded(id)
    },
    removeCost: (id: string) => setCosts(current => current.filter(cost => cost.id !== id)),
    setReserve: (categoryId: string, value: string) => setReserves(current => ({ ...current, [categoryId]: value })),
    save: async () => {
      if (!payload) { setError(copy.invalid_input); return }
      if (await run(() => saveMonthlyPlan(accessToken, payload))) setError(null)
    },
  }
}

// ---------- shared pieces ----------

/** Title, the "takes effect" control, its date and the page action, all in the toolbar. Save is the default action. */
function PlanToolbar({ title, draft, copy, fmt, busy, primaryAction, actions }: {
  title: string; draft: Draft; copy: MonthlyCopy; fmt: Formatters; busy: boolean; primaryAction?: ToolbarPrimaryAction; actions?: ReactNode
}) {
  return (
    <PageHeader
      title={title}
      scope={<Segmented ariaLabel={copy.appliesFrom} value={draft.scope} options={[{ value: "next", label: copy.applyNext }, { value: "current", label: copy.applyCurrent }]} onChange={draft.setScope} />}
      caption={`${copy.appliesFrom} ${fmt.date(draft.effectiveStart)}`}
      actions={actions}
      primaryAction={primaryAction ?? { label: copy.saveChanges, icon: <IconCheck />, onClick: () => void draft.save(), disabled: busy || !draft.canSave }}
    />
  )
}

/**
 * The summary row at the bottom of an editing card: what the draft does to fun money
 * from its effective date, or what is wrong with it; the note for rewriting the running
 * period; and a pending plan with the way to discard it.
 */
function PlanFooter({ draft, copy, fmt, state, busy, serverError, accessToken, run }: PageProps) {
  const problem = serverError || draft.error || (!draft.payload ? copy.invalid_input : null)
  const changed = draft.fun.draft !== null && draft.fun.saved !== null && draft.fun.draft !== draft.fun.saved
  return (
    <div className="space-y-1 border-t border-separator bg-fill px-4 py-2 text-footnote text-label-secondary">
      <p aria-live="polite" className={cn(problem && "text-danger-text")}>
        {problem ?? (
          <>
            {fill(copy.funFrom, { date: fmt.date(draft.effectiveStart) })}:{" "}
            <strong className={cn("font-semibold text-label tabular-nums", (draft.fun.draft ?? 0) < 0 && "text-danger-text")}>
              {draft.fun.draft === null ? "…" : fmt.money(draft.fun.draft)}
            </strong>
            {changed && draft.fun.saved !== null ? ` · ${fill(copy.funNow, { amount: fmt.money(draft.fun.saved) })}` : ""}
          </>
        )}
      </p>
      {draft.scope === "current" ? <p>{copy.applyCurrentNote}</p> : null}
      {state.nextPlan ? (
        <p className="flex flex-wrap items-center gap-x-2">
          {copy.pending}
          <Button variant="text" size="sm" className="px-0" disabled={busy}
            onClick={() => { if (window.confirm(copy.confirmCancel)) void run(() => cancelMonthlyPlan(accessToken, state.revision)) }}>
            {copy.cancelPending}
          </Button>
        </p>
      ) : null}
    </div>
  )
}

/** A card header: headline title, an optional hint under it, optional content on the right. */
function CardHeader({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 px-4 py-2 max-lg:min-h-12">
      <div className="min-w-0">
        <h2 className="text-headline">{title}</h2>
        {hint ? <p className="text-footnote text-label-secondary">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}

function MoneyInput({ id, value, onChange, ariaLabel, autoFocus }: { id: string; value: string; onChange: (value: string) => void; ariaLabel?: string; autoFocus?: boolean }) {
  return <Input id={id} className="w-28 text-right tabular-nums" inputMode="decimal" aria-label={ariaLabel} aria-invalid={parseMoney(value) === null || undefined}
    autoFocus={autoFocus} value={value} onChange={event => onChange(event.target.value)} />
}

function EditLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="text-footnote font-medium text-link hover:underline">{label}</Link>
}

// ---------- Income & reserves (Plan type) ----------

function IncomePage(page: PageProps) {
  const { state, draft, copy, fmt, busy } = page
  const summary = state.summary
  const view = useMemo(() => {
    if (!summary) return null
    const parts = periodBreakdown(summary)
    // The period's month is the one most of its days fall in.
    const middle = addDays(summary.start, Math.floor(daysBetween(summary.start, summary.end) / 2))
    const count = (kind: MonthlyCost["kind"]) => summary.costs.filter(cost => cost.kind === kind).length
    return { parts, month: fmt.monthName(middle),
      counts: { fixed: count("fixed"), monthly: count("monthly"), yearly: count("yearly"), reserves: summary.categories.filter(item => item.reservedCents > 0).length },
      nextFun: state.forecast.find(period => period.start === state.nextStart)?.funCents ?? null }
  }, [summary, state.forecast, state.nextStart, fmt])

  const cells: MetricCell[] = view ? [
    { label: copy.fixed, value: fmt.money(view.parts.fixed), icon: { glyph: IconReceipt, tone: "blue" }, note: fill(copy.itemCount, { count: view.counts.fixed }),
      action: <EditLink href={budgetViews.fixed.route} label={copy.edit} /> },
    { label: copy.subscriptions, value: fmt.money(view.parts.monthly + view.parts.yearly), icon: { glyph: IconRepeat, tone: "purple" },
      note: fill(copy.monthlyAndYearly, { monthly: view.counts.monthly, yearly: view.counts.yearly }), action: <EditLink href={budgetViews.monthly.route} label={copy.edit} /> },
    { label: copy.categories, value: fmt.money(view.parts.reserves), icon: { glyph: IconTag, tone: "green" }, note: fill(copy.withReserve, { count: view.counts.reserves }),
      action: <EditLink href={budgetViews.categories.route} label={copy.edit} /> },
    { label: copy.savingsAndBuffer, value: fmt.money(view.parts.savings + view.parts.buffer), icon: { glyph: IconPigMoney, tone: "yellow" },
      note: `${copy.savings} ${fmt.money(view.parts.savings)} · ${copy.bufferSource} ${fmt.money(view.parts.buffer)}` },
    { label: copy.fun, value: fmt.money(view.parts.fun), negative: view.parts.fun < 0, icon: { glyph: IconMoodSmile, tone: "brand" },
      note: view.nextFun === null ? undefined : <>{copy.from} {fmt.date(state.nextStart)}: <strong>{fmt.money(view.nextFun)}</strong></> },
  ] : []

  return (
    <div className="space-y-4">
      <PlanToolbar title={copy.incomeReserves} draft={draft} copy={copy} fmt={fmt} busy={busy} />
      {view ? (
        <section className={listCardClass}>
          <CardHeader title={fill(copy.breakdownTitle, { amount: fmt.money(view.parts.income), month: view.month })} />
          <div className="border-t border-separator px-4 py-1.5">
            <BreakdownChart
              title={fill(copy.breakdownTitle, { amount: fmt.money(view.parts.income), month: view.month })}
              whole={{ label: copy.income, amount: view.parts.income }}
              deductions={[
                { label: copy.fixed, amount: view.parts.fixed }, { label: copy.monthly, amount: view.parts.monthly },
                { label: copy.yearly, amount: view.parts.yearly }, { label: copy.reserved, amount: view.parts.reserves },
                { label: copy.savings, amount: view.parts.savings }, { label: copy.bufferSource, amount: view.parts.buffer },
                { label: copy.deficit, amount: view.parts.deficit },
              ].filter(part => part.amount > 0)}
              remainder={{ label: copy.fun, amount: view.parts.fun }}
              formatMoney={fmt.money}
            />
          </div>
          <p className="border-t border-separator bg-fill px-4 py-2 text-footnote text-label-secondary">{copy.leftoverNote}</p>
        </section>
      ) : null}
      {cells.length > 0 ? <MetricStrip cells={cells} /> : null}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className={listCardClass}>
          <CardHeader title={copy.plan} hint={copy.moneyHint} />
          <fieldset disabled={busy} className="hairline-rows border-t border-separator">
            <FormRow label={copy.income} htmlFor="plan-income"><MoneyInput id="plan-income" value={draft.income} onChange={draft.setIncome} /></FormRow>
            <FormRow label={copy.bufferRate} htmlFor="plan-buffer"><MoneyInput id="plan-buffer" value={draft.buffer} onChange={draft.setBuffer} /></FormRow>
            <FormRow label={copy.savingsRate} htmlFor="plan-savings"><MoneyInput id="plan-savings" value={draft.savings} onChange={draft.setSavings} /></FormRow>
          </fieldset>
          <PlanFooter {...page} />
        </section>
        {draft.forecast.length > 0 ? <Forecast forecast={draft.forecast} locale={page.locale} currency={state.currency} /> : null}
      </div>
    </div>
  )
}

// ---------- Fixed costs, monthly and yearly subscriptions (List type) ----------

function CostsPage(page: PageProps & { kind: MonthlyCost["kind"] }) {
  const { state, draft, copy, fmt, busy, kind } = page
  const title = kind === "fixed" ? copy.fixed : kind === "monthly" ? copy.monthly : copy.yearly
  const cells = useMemo<MetricCell[]>(() => {
    const total = costTotal(draft.costs, kind, parseMoney)
    const items = fill(copy.itemCount, { count: total.count })
    if (kind !== "yearly") {
      const income = parseMoney(draft.income) ?? 0
      const share = income > 0 ? total.cents / income : 0
      const percent = new Intl.NumberFormat(page.locale === "de" ? "de-DE" : "en-GB", { style: "percent", maximumFractionDigits: 0 }).format(share)
      return [
        { label: copy.perMonth, value: fmt.money(total.cents), note: items },
        { label: copy.perYear, value: fmt.money(total.cents * 12) },
        { label: copy.shareOfIncome, value: percent, meter: { fraction: share, label: `${percent} · ${copy.income}` } },
      ]
    }
    const due = (state.summary?.costs ?? []).filter(cost => cost.kind === "yearly")
    const next = nextYearlyDue(draft.costs.filter(cost => cost.kind === "yearly").map(cost => ({ name: cost.name || copy.name, amountCents: parseMoney(cost.amount) ?? 0,
      month: Number(cost.month), day: Number(cost.day) })), state.today)
    return [
      { label: copy.perYear, value: fmt.money(total.cents), note: items },
      { label: copy.dueThisPeriod, value: fmt.money(due.reduce((sum, cost) => sum + cost.amountCents, 0)),
        note: due.length > 0 ? due.map(cost => cost.name).join(", ") : copy.nothingDue },
      ...(next ? [{ label: copy.nextDue, value: fmt.money(next.amountCents), note: `${next.name} · ${fmt.date(next.date)}` }] : []),
    ]
  }, [draft.costs, draft.income, kind, copy, fmt, page.locale, state.summary, state.today])
  return (
    <div className="space-y-4">
      <PlanToolbar title={title} draft={draft} copy={copy} fmt={fmt} busy={busy} />
      <MetricStrip cells={cells} />
      <section className={listCardClass}>
        <fieldset disabled={busy} className="hairline-rows">
          <CostRows kind={kind} draft={draft} copy={copy} />
        </fieldset>
        <PlanFooter {...page} />
      </section>
    </div>
  )
}

// Written out so Tailwind sees them: name · (due month · due day) · amount · remove.
const costColumns = {
  yearly: "lg:grid lg:grid-cols-[minmax(0,1fr)_5rem_4.5rem_7rem_1.75rem]",
  other: "lg:grid lg:grid-cols-[minmax(0,1fr)_7rem_1.75rem]",
}

/**
 * The editable rows of one cost kind under their column heads, an empty line when there
 * are none, and the add row last. Phones wrap a row and label the due fields inline.
 */
function CostRows({ kind, draft, copy }: { kind: MonthlyCost["kind"]; draft: Draft; copy: MonthlyCopy }) {
  const rows = draft.costs.filter(cost => cost.kind === kind)
  const months = Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))
  const columns = kind === "yearly" ? costColumns.yearly : costColumns.other
  return (
    <>
      {rows.length === 0 ? <p className="px-4 py-3 text-footnote text-label-secondary">{copy.emptyCosts}</p> : (
        <div aria-hidden className={cn("hidden h-8 items-center gap-x-2 px-4 text-caption text-label-secondary", columns)}>
          <span>{copy.name}</span>
          {kind === "yearly" ? <><span>{copy.dueMonth}</span><span>{copy.dueDay}</span></> : null}
          <span className="text-right">{copy.amount}</span>
          <span />
        </div>
      )}
      {rows.map(cost => (
        <div key={cost.id} className={cn("flex min-h-9 flex-wrap items-center gap-2 px-4 py-1 max-lg:min-h-12 max-lg:py-2", columns)}>
          <Label htmlFor={`name-${cost.id}`} className="sr-only">{copy.name}</Label>
          <Input id={`name-${cost.id}`} className="min-w-40 flex-1" placeholder={copy.name} value={cost.name} maxLength={100} autoFocus={draft.added === cost.id}
            aria-invalid={!cost.name.trim() || undefined} onChange={event => draft.updateCost(cost.id, { name: event.target.value })} />
          {cost.kind === "yearly" ? (
            <>
              <span className="flex items-center gap-2">
                <Label htmlFor={`month-${cost.id}`} className="text-caption text-label-secondary lg:sr-only">{copy.dueMonth}</Label>
                <FormSelect id={`month-${cost.id}`} className="w-20" value={cost.month} onValueChange={month => draft.updateCost(cost.id, { month })} options={months} />
              </span>
              <span className="flex items-center gap-2">
                <Label htmlFor={`day-${cost.id}`} className="text-caption text-label-secondary lg:sr-only">{copy.dueDay}</Label>
                <Input id={`day-${cost.id}`} className="w-16 lg:w-full" type="number" min={1} max={31} value={cost.day} onChange={event => draft.updateCost(cost.id, { day: event.target.value })} />
              </span>
            </>
          ) : null}
          <MoneyInput id={`amount-${cost.id}`} ariaLabel={`${copy.amount}: ${cost.name || copy.name}`} value={cost.amount} onChange={amount => draft.updateCost(cost.id, { amount })} />
          <Button size="icon" variant="ghost" onClick={() => draft.removeCost(cost.id)} aria-label={`${copy.remove}: ${cost.name || copy.name}`} title={copy.remove}>
            <IconX />
          </Button>
        </div>
      ))}
      <Row onClick={() => draft.addCost(kind)}>
        <IconPlus className="size-4 text-link [stroke-width:2]" />
        <span className="font-medium text-link">{copy.add}</span>
      </Row>
    </>
  )
}

// ---------- Categories (List type) ----------

function CategoriesPage(page: PageProps) {
  const { state, draft, copy, fmt, busy } = page
  const [target, setTarget] = useState<CategoryTarget | null>(null)
  const cells = useMemo<MetricCell[]>(() => {
    const active = state.categories.filter(category => !category.archived)
    const amounts = active.map(category => parseMoney(draft.reserves[category.id] ?? "0") ?? 0)
    return [
      { label: copy.reservedPerMonth, value: fmt.money(amounts.reduce((sum, cents) => sum + cents, 0)),
        note: fill(copy.withReserve, { count: amounts.filter(cents => cents > 0).length }) },
      { label: copy.categories, value: String(active.length), note: fill(copy.archivedCount, { count: state.categories.length - active.length }) },
    ]
  }, [state.categories, draft.reserves, copy, fmt])

  return (
    <div className="space-y-4">
      <PlanToolbar title={copy.categories} draft={draft} copy={copy} fmt={fmt} busy={busy}
        actions={<ToolbarButton label={copy.saveChanges} onClick={() => void draft.save()} disabled={busy || !draft.canSave} />}
        primaryAction={{ label: copy.addCategory, icon: <IconPlus />, onClick: () => setTarget({ kind: "new" }), disabled: busy }} />
      <MetricStrip cells={cells} />
      <section className={listCardClass}>
        <CardHeader title={copy.categories} hint={`${copy.reserve}: ${copy.noReserve}`} />
        <div className="hairline-rows border-t border-separator">
          <CategoryRows {...page} edit={category => setTarget({ kind: "edit", category })} />
        </div>
        <PlanFooter {...page} />
      </section>
      {target ? <CategorySheet key={target.kind === "edit" ? target.category.id : "new"} target={target} copy={copy} locale={page.locale} busy={busy}
        close={() => setTarget(null)}
        save={(name, existing, appearance) => page.run(() => saveMonthlyCategory(page.accessToken, name, existing, appearance))} /> : null}
    </div>
  )
}

/** Each category with its monthly reserve field (active ones) and a menu to edit or archive it. */
function CategoryRows({ state, draft, copy, busy, accessToken, locale, run, edit }: PageProps & { edit: (category: MonthlyCategory) => void }) {
  if (state.categories.length === 0) return <p className="px-4 py-3 text-footnote text-label-secondary">{copy.emptyCategories}</p>
  return state.categories.map(category => {
    const visual = categoryVisual(category.name, category)
    return (
      <div key={category.id} className={cn("flex min-h-9 items-center gap-3 px-4 py-1 max-lg:min-h-12 max-lg:py-2", category.archived && "text-label-secondary")}>
        <IconTile icon={visual.icon} tone={visual.tone} size={28} />
        <Label className="min-w-0 flex-1 truncate text-callout font-normal" htmlFor={category.archived ? undefined : `reserve-${category.id}`}>
          {category.name}
        </Label>
        {category.archived ? <Badge>{copy.archived}</Badge> : (
          <fieldset disabled={busy}>
            <MoneyInput id={`reserve-${category.id}`} ariaLabel={`${copy.reserve}: ${category.name}`} value={draft.reserves[category.id] ?? moneyInput(0, locale)}
              onChange={value => draft.setReserve(category.id, value)} />
          </fieldset>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" disabled={busy} aria-label={`${copy.actions}: ${category.name}`} title={copy.actions}><IconDots /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => edit(category)}>{copy.edit}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void run(() => saveMonthlyCategory(accessToken, category.name, { id: category.id, archived: !category.archived }))}>
              {category.archived ? copy.restore : copy.archive}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  })
}

/** Add or edit a category in a solid sheet: Cancel, title and Save on top, name and look below. */
function CategorySheet({ target, copy, locale, busy, close, save }: {
  target: CategoryTarget; copy: MonthlyCopy; locale: Locale; busy: boolean; close: () => void
  save: (name: string, existing: { id: string; archived: boolean } | undefined, appearance: { color: string | null; icon: string }) => Promise<boolean>
}) {
  const existing = target.kind === "edit" ? target.category : undefined
  const [name, setName] = useState(existing?.name ?? "")
  const [color, setColor] = useState<string | null>(existing?.color ?? null)
  const [icon, setIcon] = useState(existing?.icon ?? "tag")
  const formId = "category-form"
  const title = existing ? copy.editCategory : copy.addCategory
  const preview = categoryVisual(name, { color: color ?? "", icon })
  return (
    <Sheet open onOpenChange={open => { if (!open && !busy) close() }}>
      <SheetContent>
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-separator px-4 max-lg:h-16">
          <Button type="button" variant="secondary" disabled={busy} onClick={close}>{copy.cancel}</Button>
          <SheetTitle className="truncate">{title}</SheetTitle>
          <Button type="submit" form={formId} disabled={busy || !name.trim()}>{existing ? copy.saveCategory : copy.add}</Button>
        </div>
        <form id={formId} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4"
          onSubmit={async event => { event.preventDefault(); if (name.trim() && await save(name.trim(), existing, { color, icon })) close() }}>
          <SheetDescription className="sr-only">{title}</SheetDescription>
          <div className="flex items-end gap-3">
            <IconTile icon={preview.icon} tone={preview.tone} size={36} />
            <div className="min-w-0 flex-1">
              <Field label={copy.categoryName}>
                <Input autoFocus maxLength={100} value={name} onChange={event => setName(event.target.value)} />
              </Field>
            </div>
          </div>
          <CategoryAppearancePicker allowAutomatic={!existing} locale={locale} color={color} icon={icon} onColor={setColor} onIcon={setIcon} />
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ---------- Guided setup ----------

/** The first-run flow: a settings-width column, one card per step with a progress row on top and its actions in the footer. */
function PlanSetup(page: PageProps) {
  const { state, draft, copy, fmt, busy, serverError } = page
  const [step, setStep] = useState(0)
  const [target, setTarget] = useState<CategoryTarget | null>(null)
  const steps = [
    { title: copy.income, intro: `${copy.setupNote} ${copy.moneyHint}` },
    { title: copy.costs, intro: copy.moneyHint },
    { title: copy.categories, intro: copy.setupCategories },
    { title: copy.review, intro: copy.setupReview },
  ]
  const problem = serverError || draft.error || (!draft.payload ? copy.invalid_input : null)
  const noCategory = !state.categories.some(category => !category.archived)

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-4">
      <PageHeader title={copy.plan} caption={copy.setupTitle} />
      <section className={listCardClass}>
        <div className="space-y-3 px-4 pt-3 pb-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-headline">{steps[step].title}</h2>
            <span className="text-footnote text-label-secondary">{fill(copy.stepOf, { step: step + 1, total: steps.length })}</span>
          </div>
          <ol aria-label={copy.setupTitle} className="grid grid-cols-4 gap-1.5">
            {steps.map((item, index) => (
              <li key={item.title} aria-current={index === step ? "step" : undefined}>
                <span aria-hidden className={cn("block h-1 rounded-full", index <= step ? "bg-brand-500" : "bg-fill-strong")} />
                <span className={cn("mt-1.5 block truncate text-caption", index === step ? "text-label" : "text-label-secondary")}>{item.title}</span>
              </li>
            ))}
          </ol>
          <p className="text-footnote text-label-secondary">{steps[step].intro}</p>
        </div>
        <fieldset disabled={busy} className="hairline-rows border-t border-separator">
          {step === 0 ? (
            <>
              <FormRow label={copy.income} htmlFor="plan-income"><MoneyInput id="plan-income" value={draft.income} onChange={draft.setIncome} /></FormRow>
              <FormRow label={copy.bufferRate} htmlFor="plan-buffer"><MoneyInput id="plan-buffer" value={draft.buffer} onChange={draft.setBuffer} /></FormRow>
              <FormRow label={copy.savingsRate} htmlFor="plan-savings"><MoneyInput id="plan-savings" value={draft.savings} onChange={draft.setSavings} /></FormRow>
              <FormRow label={copy.opening} htmlFor="plan-opening"><MoneyInput id="plan-opening" value={draft.opening} onChange={draft.setOpening} /></FormRow>
            </>
          ) : null}
          {step === 1 ? costKinds.map(kind => (
            <div key={kind} className="hairline-rows">
              <h3 className="bg-fill px-4 py-1.5 text-caption text-label-secondary">{kind === "fixed" ? copy.fixed : kind === "monthly" ? copy.monthly : copy.yearly}</h3>
              <CostRows kind={kind} draft={draft} copy={copy} />
            </div>
          )) : null}
          {step === 2 ? (
            <>
              <CategoryRows {...page} edit={category => setTarget({ kind: "edit", category })} />
              <Row onClick={() => setTarget({ kind: "new" })}>
                <IconPlus className="size-4 text-link [stroke-width:2]" />
                <span className="font-medium text-link">{copy.addCategory}</span>
              </Row>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <ReviewRow label={copy.income} value={fmt.money(draft.payload?.plan.incomeCents ?? 0)} />
              <ReviewRow label={copy.bufferRate} value={fmt.money(draft.payload?.plan.bufferCents ?? 0)} />
              <ReviewRow label={copy.savingsRate} value={fmt.money(draft.payload?.plan.savingsCents ?? 0)} />
              <ReviewRow label={copy.opening} value={fmt.money(draft.payload?.openingSavingsCents ?? 0)} />
              {costKinds.map(kind => {
                const total = costTotal(draft.costs, kind, parseMoney)
                return <ReviewRow key={kind} label={`${kind === "fixed" ? copy.fixed : kind === "monthly" ? copy.monthly : copy.yearly} · ${fill(copy.itemCount, { count: total.count })}`} value={fmt.money(total.cents)} />
              })}
              <ReviewRow label={copy.categories} value={String(state.categories.filter(category => !category.archived).length)} />
            </>
          ) : null}
        </fieldset>
        <div className="flex flex-wrap items-center gap-3 border-t border-separator px-4 py-2.5">
          {step > 0 ? <Button variant="secondary" disabled={busy} onClick={() => setStep(current => current - 1)}>{copy.back}</Button> : null}
          <p aria-live="polite" className="min-w-0 flex-1 text-footnote text-danger-text">{problem}</p>
          {step < 3 ? (
            <Button disabled={busy || !draft.payload || (step === 2 && noCategory)} onClick={() => setStep(current => current + 1)}>{copy.continue}</Button>
          ) : (
            <Button disabled={busy || !draft.canSave} onClick={() => void draft.save()}>{copy.startPlan}</Button>
          )}
        </div>
      </section>
      {step === 3 && draft.previewCurrent && draft.forecast.length > 0 ? <Forecast forecast={draft.forecast} locale={page.locale} currency={state.currency} /> : null}
      {target ? <CategorySheet key={target.kind === "edit" ? target.category.id : "new"} target={target} copy={copy} locale={page.locale} busy={busy}
        close={() => setTarget(null)}
        save={(name, existing, appearance) => page.run(() => saveMonthlyCategory(page.accessToken, name, existing, appearance))} /> : null}
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <Row><span className="min-w-0 flex-1">{label}</span><span className="tabular-nums">{value}</span></Row>
}

// ---------- Forecast ----------

/** The next 12 periods' planned fun money, with the yearly bills that fall into each. The overview reuses it. */
export function Forecast({ forecast, locale, currency }: { forecast: MonthlyForecast[]; locale: Locale; currency: string }) {
  const copy = monthlyCopy(locale)
  const rows = useMemo(() => {
    const fmt = formatters(locale, currency)
    return forecast.map(period => ({ key: period.start, period: `${fmt.date(period.start)} – ${fmt.date(period.end)}`, amount: fmt.money(period.funCents),
      negative: period.funCents < 0, bills: period.costs.filter(cost => cost.kind === "yearly").map(cost => `${cost.name} ${fmt.money(cost.amountCents)}`).join(", ") }))
  }, [forecast, locale, currency])
  return (
    <Group title={copy.forecast}>
      {rows.map(row => (
        <Row key={row.key}>
          <div className="min-w-0 flex-1">
            <p>{row.period}</p>
            {row.bills ? <p className="text-footnote text-label-secondary">{row.bills}</p> : null}
          </div>
          <span className={cn("font-medium tabular-nums", row.negative && "text-danger-text")}>{row.amount}</span>
        </Row>
      ))}
      <p className="bg-fill px-4 py-2 text-footnote text-label-secondary">{copy.forecastNote}</p>
    </Group>
  )
}
