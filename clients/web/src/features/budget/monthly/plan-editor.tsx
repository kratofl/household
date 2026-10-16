"use client"

// The plan pages and the guided setup. They edit one unsaved draft of the monthly plan
// (usePlanDraft): income, costs and category reserves changed on any plan page wait for
// Save and are saved together. The draft lives while this editor is mounted, which the
// app shell keeps across the plan pages but not beyond; after a save it starts over
// from the saved plan.
// Category names, colours and icons edited in the table are part of the same draft;
// adding, archiving and restoring a category, and merchants, are saved right away.
// Each page puts its title, the "takes effect" segmented control, its date and the
// page's action into the toolbar, and keeps hints, errors and the save summary inside
// the card they belong to (DESIGN.md, Layout).
//
//   Income & reserves  Plan type: breakdown of the period, its parts as a strip, the form.
//   Fixed / monthly / yearly costs, Categories  List type: totals strip, one card of rows.
//   Merchants  merchant-directory.tsx.
//   No plan yet  the setup: one card per step in a settings-width column.

import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  IconArchive, IconCheck, IconChevronRight, IconListDetails, IconMoodSmile, IconPigMoney, IconPlus, IconReceipt, IconRepeat, IconRestore, IconTag, IconX,
} from "@tabler/icons-react"

import { BreakdownChart } from "@/components/app/charts"
import { FormSelect } from "@/components/app/form-select"
import { DetailSheet, FormSheet, type FormSheetResult } from "@/components/app/form-sheet"
import { SearchableSelect } from "@/components/app/searchable-select"
import { Field } from "@/components/app/field"
import { CardHeader, FormRow, Group, IconTile, ListCard, ListEmpty, ListFooter, ListSubhead, Row, TextAction } from "@/components/app/grouped"
import { MetricStrip, type MetricCell } from "@/components/app/metric-strip"
import { PageHeader } from "@/components/app/page-header"
import { Segmented } from "@/components/app/segmented"
import { ToolbarButton, type ToolbarPrimaryAction } from "@/components/app/toolbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input, quietTextField, quietValueField } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Locale } from "@/lib/i18n"
import { budgetViews } from "@/lib/modules"
import { uuid } from "@/lib/uuid"
import { cn } from "@/lib/utils"

import type { Merchant } from "../merchants"
import { MerchantDirectory } from "../merchant-directory"
import { cancelMonthlyPlan, previewMonthlyPlan, saveMonthlyCategory, saveMonthlyPlan } from "./api"
import { CategoryLookButton, CategoryLookFields } from "./category-appearance-picker"
import { categoryVisual } from "./category-visuals"
import { expenseRowModel, fill, formatters, moneyInput, parseMoney, periodMonth, type Formatters, type Run } from "./controller"
import { type MonthlyCopy, monthlyCopy, monthlyError } from "./copy"
import { ExpenseRow } from "./expense-history"
import type { MonthlyCategory, MonthlyCost, MonthlyForecast, MonthlyPlan, MonthlyState, SavePlan } from "./types"
import { costTotal, nextYearlyDue, periodBreakdown, scopedCents, type CostDraft } from "./view-models"

type Props = { section: string; serverError: string | null; state: MonthlyState; accessToken: string; locale: Locale; busy: boolean; isAdmin: boolean
  merchants: Merchant[]
  saveMerchant: (name: string, options?: { id?: string; archived?: boolean; global?: boolean }) => Promise<void>
  run: Run }
/** What the categories table edits of a category; the reserve is part of the plan instead. */
type CategoryLook = { name: string; color: string; icon: string }
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
      save={(name, options) => props.run(() => props.saveMerchant(name, options), "sheet")} />
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
    kind: cost.kind, amount: moneyInput(cost.amountCents, locale), month: String(cost.dueMonth ?? 1), day: String(cost.dueDay ?? 1),
    merchantId: cost.merchantId ?? "", description: cost.description ?? "" })))
  const [reserves, setReserves] = useState<Record<string, string>>(() => Object.fromEntries(base.reserves.map(reserve => [reserve.categoryId, moneyInput(reserve.amountCents, locale)])))
  const [scope, setScope] = useState<"next" | "current">("next")
  const [error, setError] = useState<string | null>(null)
  const [forecast, setForecast] = useState<MonthlyForecast[]>([])
  const [previewing, setPreviewing] = useState(false)
  // The cost row just added, so its name field takes focus.
  const [added, setAdded] = useState<string | null>(null)
  // Categories edited in the table, by id. An entry goes away once it matches the saved category again.
  const [categoryEdits, setCategoryEdits] = useState<Record<string, CategoryLook>>({})
  const savedLook = (category: MonthlyCategory): CategoryLook => ({ name: category.name, color: category.color, icon: category.icon })
  const invalidCategory = Object.values(categoryEdits).some(look => !look.name.trim())

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
      parsedCosts.push({ id: cost.id, name: cost.name.trim(), amountCents, kind: cost.kind, dueMonth, dueDay,
        merchantId: cost.merchantId || null, description: cost.description.trim() || null })
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
  // The plan as loaded, so a save that only touches categories writes no new plan version.
  const planKey = payload && JSON.stringify([payload.plan, payload.openingSavingsCents])
  const [loadedPlanKey] = useState(planKey)
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
    canSave: payload !== null && previewCurrent && !previewing && !invalidCategory,
    invalidCategory,
    /** The category as the table shows it: with its unsaved edits. */
    category: (category: MonthlyCategory) => categoryEdits[category.id] ?? savedLook(category),
    editCategory: (category: MonthlyCategory, update: Partial<CategoryLook>) => setCategoryEdits(current => {
      const { [category.id]: edited = savedLook(category), ...others } = current
      const next = { ...edited, ...update }
      const saved = savedLook(category)
      return next.name === saved.name && next.color === saved.color && next.icon === saved.icon ? others : { ...others, [category.id]: next }
    }),
    updateCost: (id: string, update: Partial<CostDraft>) => setCosts(current => current.map(cost => cost.id === id ? { ...cost, ...update } : cost)),
    addCost: (kind: MonthlyCost["kind"]) => {
      const id = uuid()
      setCosts(current => [...current, { id, name: "", amount: moneyInput(0, locale), kind, month: "1", day: "1", merchantId: "", description: "" }])
      setAdded(id)
    },
    removeCost: (id: string) => setCosts(current => current.filter(cost => cost.id !== id)),
    setReserve: (categoryId: string, value: string) => setReserves(current => ({ ...current, [categoryId]: value })),
    save: async () => {
      if (!payload) { setError(copy.invalid_input); return }
      if (invalidCategory) { setError(copy.categoryNameRequired); return }
      const edited = state.categories.flatMap(category => categoryEdits[category.id] ? [{ category, look: categoryEdits[category.id] }] : [])
      const result = await run(async () => {
        for (const { category, look } of edited) {
          await saveMonthlyCategory(accessToken, look.name.trim(), { id: category.id, archived: category.archived }, { color: look.color, icon: look.icon })
        }
        if (planKey !== loadedPlanKey || edited.length === 0) await saveMonthlyPlan(accessToken, payload)
      })
      if (result.ok) { setError(null); setCategoryEdits({}) }
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
  const problem = serverError || draft.error || (!draft.payload ? copy.invalid_input : draft.invalidCategory ? copy.categoryNameRequired : null)
  const changed = draft.fun.draft !== null && draft.fun.saved !== null && draft.fun.draft !== draft.fun.saved
  return (
    <ListFooter className="space-y-1">
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
    </ListFooter>
  )
}

function MoneyInput({ id, value, onChange, ariaLabel, autoFocus, quiet = false }: {
  id: string; value: string; onChange: (value: string) => void; ariaLabel?: string; autoFocus?: boolean
  /** In an editable table row: a filled field without a border until focused (DESIGN.md, Lists). */
  quiet?: boolean
}) {
  return <Input id={id} className={cn("w-28 text-right tabular-nums", quiet && cn(quietValueField, "max-sm:w-24"))} inputMode="decimal" aria-label={ariaLabel} aria-invalid={parseMoney(value) === null || undefined}
    autoFocus={autoFocus} value={value} onChange={event => onChange(event.target.value)} />
}

// ---------- Income & reserves (Plan type) ----------

function IncomePage(page: PageProps) {
  const { state, draft, copy, fmt, busy } = page
  const summary = state.summary
  const view = useMemo(() => {
    if (!summary) return null
    const parts = periodBreakdown(summary)
    const count = (kind: MonthlyCost["kind"]) => summary.costs.filter(cost => cost.kind === kind).length
    return { parts, month: fmt.monthName(periodMonth(summary.start, summary.end)),
      counts: { fixed: count("fixed"), monthly: count("monthly"), yearly: count("yearly"), reserves: summary.categories.filter(item => item.reservedCents > 0).length },
      nextFun: state.forecast.find(period => period.start === state.nextStart)?.funCents ?? null }
  }, [summary, state.forecast, state.nextStart, fmt])

  const cells: MetricCell[] = view ? [
    { label: copy.fixed, value: fmt.money(view.parts.fixed), icon: { glyph: IconReceipt, tone: "blue" }, note: fill(copy.itemCount, { count: view.counts.fixed }),
      action: <TextAction action={{ label: copy.edit, href: budgetViews.fixed.route }} className="text-footnote" /> },
    { label: copy.subscriptions, value: fmt.money(view.parts.monthly + view.parts.yearly), icon: { glyph: IconRepeat, tone: "purple" },
      note: fill(copy.monthlyAndYearly, { monthly: view.counts.monthly, yearly: view.counts.yearly }), action: <TextAction action={{ label: copy.edit, href: budgetViews.monthly.route }} className="text-footnote" /> },
    { label: copy.categories, value: fmt.money(view.parts.reserves), icon: { glyph: IconTag, tone: "green" }, note: fill(copy.withReserve, { count: view.counts.reserves }),
      action: <TextAction action={{ label: copy.edit, href: budgetViews.categories.route }} className="text-footnote" /> },
    { label: copy.savingsAndBuffer, value: fmt.money(view.parts.savings + view.parts.buffer), icon: { glyph: IconPigMoney, tone: "yellow" },
      note: `${copy.savings} ${fmt.money(view.parts.savings)} · ${copy.bufferSource} ${fmt.money(view.parts.buffer)}` },
    { label: copy.fun, value: fmt.money(view.parts.fun), negative: view.parts.fun < 0, icon: { glyph: IconMoodSmile, tone: "brand" },
      note: view.nextFun === null ? undefined : <>{copy.from} {fmt.date(state.nextStart)}: <strong>{fmt.money(view.nextFun)}</strong></> },
  ] : []

  return (
    <div className="space-y-4">
      <PlanToolbar title={copy.incomeReserves} draft={draft} copy={copy} fmt={fmt} busy={busy} />
      {view ? (
        <ListCard>
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
          <ListFooter>{copy.leftoverNote}</ListFooter>
        </ListCard>
      ) : null}
      {cells.length > 0 ? <MetricStrip cells={cells} /> : null}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ListCard>
          <CardHeader title={copy.plan} description={copy.moneyHint} />
          <fieldset disabled={busy} className="hairline-rows border-t border-separator">
            <FormRow label={copy.income} htmlFor="plan-income"><MoneyInput id="plan-income" value={draft.income} onChange={draft.setIncome} /></FormRow>
            <FormRow label={copy.bufferRate} htmlFor="plan-buffer"><MoneyInput id="plan-buffer" value={draft.buffer} onChange={draft.setBuffer} /></FormRow>
            <FormRow label={copy.savingsRate} htmlFor="plan-savings"><MoneyInput id="plan-savings" value={draft.savings} onChange={draft.setSavings} /></FormRow>
          </fieldset>
          <PlanFooter {...page} />
        </ListCard>
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
      <ListCard>
        <fieldset disabled={busy} className="hairline-rows">
          <CostRows kind={kind} draft={draft} copy={copy} merchants={page.merchants} />
        </fieldset>
        <PlanFooter {...page} />
      </ListCard>
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
 * Subscriptions get a second line for the merchant and a description; picking a merchant
 * for an unnamed row names it after the merchant.
 */
function CostRows({ kind, draft, copy, merchants }: { kind: MonthlyCost["kind"]; draft: Draft; copy: MonthlyCopy; merchants: Merchant[] }) {
  const rows = draft.costs.filter(cost => cost.kind === kind)
  const subscription = kind !== "fixed"
  const merchantOptions = (selected: string) => [{ value: "", label: copy.noMerchant },
    ...merchants.filter(merchant => !merchant.archived || merchant.id === selected).map(merchant => ({ value: merchant.id, label: merchant.name }))]
  const pickMerchant = (cost: CostDraft, merchantId: string) => {
    const name = merchants.find(merchant => merchant.id === merchantId)?.name
    draft.updateCost(cost.id, cost.name.trim() || !name ? { merchantId } : { merchantId, name })
  }
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
          <Input id={`name-${cost.id}`} className={cn("min-w-0 flex-1", quietTextField)} placeholder={copy.name} value={cost.name} maxLength={100} autoFocus={draft.added === cost.id}
            aria-invalid={!cost.name.trim() || undefined} onChange={event => draft.updateCost(cost.id, { name: event.target.value })} />
          {cost.kind === "yearly" ? (
            <>
              <span className="flex items-center gap-2">
                <Label htmlFor={`month-${cost.id}`} className="text-caption text-label-secondary lg:sr-only">{copy.dueMonth}</Label>
                <FormSelect id={`month-${cost.id}`} className={cn("w-20", quietValueField)} value={cost.month} onValueChange={month => draft.updateCost(cost.id, { month })} options={months} />
              </span>
              <span className="flex items-center gap-2">
                <Label htmlFor={`day-${cost.id}`} className="text-caption text-label-secondary lg:sr-only">{copy.dueDay}</Label>
                <Input id={`day-${cost.id}`} className={cn("w-16 lg:w-full", quietValueField)} type="number" min={1} max={31} value={cost.day} onChange={event => draft.updateCost(cost.id, { day: event.target.value })} />
              </span>
            </>
          ) : null}
          <MoneyInput id={`amount-${cost.id}`} quiet ariaLabel={`${copy.amount}: ${cost.name || copy.name}`} value={cost.amount} onChange={amount => draft.updateCost(cost.id, { amount })} />
          <Button size="icon" variant="ghost" onClick={() => draft.removeCost(cost.id)} aria-label={`${copy.remove}: ${cost.name || copy.name}`} title={copy.remove}>
            <IconX />
          </Button>
          {subscription ? (
            <div className="flex w-full flex-wrap items-center gap-2 lg:col-span-full lg:pr-9">
              <Label htmlFor={`merchant-${cost.id}`} className="sr-only">{copy.merchant}</Label>
              <SearchableSelect id={`merchant-${cost.id}`} className={cn("w-48 max-lg:flex-1", quietValueField)} value={cost.merchantId} onValueChange={merchantId => pickMerchant(cost, merchantId)}
                options={merchantOptions(cost.merchantId)} searchLabel={copy.merchantSearch} emptyLabel={copy.noResults} />
              <Label htmlFor={`description-${cost.id}`} className="sr-only">{copy.description}</Label>
              <Input id={`description-${cost.id}`} className={cn("min-w-40 flex-1", quietTextField)} placeholder={copy.description} value={cost.description} maxLength={200}
                onChange={event => draft.updateCost(cost.id, { description: event.target.value })} />
            </div>
          ) : null}
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
  const [adding, setAdding] = useState(false)
  const [inspected, setInspected] = useState<string | null>(null)
  const cells = useMemo<MetricCell[]>(() => {
    const active = state.categories.filter(category => !category.archived)
    const amounts = active.map(category => parseMoney(draft.reserves[category.id] ?? "0") ?? 0)
    return [
      { label: copy.reservedPerMonth, value: fmt.money(amounts.reduce((sum, cents) => sum + cents, 0)),
        note: fill(copy.withReserve, { count: amounts.filter(cents => cents > 0).length }) },
      { label: copy.categories, value: String(active.length), note: fill(copy.archivedCount, { count: state.categories.length - active.length }) },
    ]
  }, [state.categories, draft.reserves, copy, fmt])
  const inspectedCategory = state.categories.find(category => category.id === inspected)

  return (
    <div className="space-y-4">
      <PlanToolbar title={copy.categories} draft={draft} copy={copy} fmt={fmt} busy={busy}
        actions={<ToolbarButton label={copy.saveChanges} onClick={() => void draft.save()} disabled={busy || !draft.canSave} />}
        primaryAction={{ label: copy.addCategory, icon: <IconPlus />, onClick: () => setAdding(true), disabled: busy }} />
      <MetricStrip cells={cells} />
      <ListCard>
        <CardHeader title={copy.categories} description={`${copy.reserve}: ${copy.noReserve}`} />
        <div className="hairline-rows border-t border-separator">
          <CategoryRows {...page} inspect={category => setInspected(category.id)} />
        </div>
        <PlanFooter {...page} />
      </ListCard>
      {adding ? <CategorySheet copy={copy} locale={page.locale} close={() => setAdding(false)}
        save={(name, appearance) => page.run(() => saveMonthlyCategory(page.accessToken, name, undefined, appearance), "sheet")} /> : null}
      {inspectedCategory ? <CategoryDetails page={page} category={inspectedCategory} close={() => setInspected(null)} /> : null}
    </div>
  )
}

/** Archives or restores a category right away; the table and the details sheet share it. */
function toggleArchived({ accessToken, run }: PageProps, category: MonthlyCategory) {
  return run(() => saveMonthlyCategory(accessToken, category.name, { id: category.id, archived: !category.archived }))
}

// Written out so Tailwind sees them: look · name · reserve · details · archive.
const categoryColumns = "grid grid-cols-[1.75rem_minmax(0,1fr)_auto_auto] items-center gap-x-2 sm:grid-cols-[1.75rem_minmax(0,1fr)_auto_auto_auto]"

/**
 * Every category as an editable row: the tile opens its colour and icon, the name and
 * the monthly reserve are fields, all saved with the plan. Details opens the period
 * sheet (`inspect`; the setup has no period and leaves it out), archive and restore
 * act at once. On phones archiving moves into the details sheet when there is one.
 */
function CategoryRows(page: PageProps & { inspect?: (category: MonthlyCategory) => void }) {
  const { state, draft, copy, busy, locale, inspect } = page
  if (state.categories.length === 0) return <p className="px-4 py-3 text-footnote text-label-secondary">{copy.emptyCategories}</p>
  return state.categories.map(category => {
    const look = draft.category(category)
    const archive = (
      <Button variant="ghost" size="icon-sm" disabled={busy} className={cn(inspect && !category.archived && "max-sm:hidden")}
        aria-label={`${category.archived ? copy.restore : copy.archive}: ${look.name}`} title={category.archived ? copy.restore : copy.archive}
        onClick={() => void toggleArchived(page, category)}>
        {category.archived ? <IconRestore /> : <IconArchive />}
      </Button>
    )
    const details = inspect ? (
      <Button variant="ghost" size="icon-sm" aria-label={`${copy.details}: ${look.name}`} title={copy.details} onClick={() => inspect(category)}>
        <IconListDetails />
      </Button>
    ) : null
    if (category.archived) {
      const visual = categoryVisual(category.name, category)
      return (
        <div key={category.id} className={cn(categoryColumns, "min-h-11 px-4 py-1 text-label-secondary max-lg:min-h-12")}>
          <IconTile icon={visual.icon} tone={visual.tone} size={28} />
          <span className="flex min-w-0 items-center gap-2 px-2.5"><span className="truncate">{category.name}</span><Badge>{copy.archived}</Badge></span>
          <span className={cn("max-sm:hidden", !inspect && "sm:col-span-2")} />
          {details}
          {archive}
        </div>
      )
    }
    return (
      <div key={category.id} className={cn(categoryColumns, "min-h-11 px-4 py-1 max-lg:min-h-12")}>
        <CategoryLookButton locale={locale} name={look.name} color={look.color} icon={look.icon} disabled={busy}
          onColor={color => draft.editCategory(category, { color })} onIcon={icon => draft.editCategory(category, { icon })} />
        <Input aria-label={`${copy.categoryName}: ${category.name}`} className={quietTextField} maxLength={100} value={look.name} disabled={busy}
          aria-invalid={!look.name.trim() || undefined} onChange={event => draft.editCategory(category, { name: event.target.value })} />
        <fieldset disabled={busy} className={cn(!inspect && "sm:col-span-2")}>
          <MoneyInput id={`reserve-${category.id}`} quiet ariaLabel={`${copy.reserve}: ${look.name}`} value={draft.reserves[category.id] ?? moneyInput(0, locale)}
            onChange={value => draft.setReserve(category.id, value)} />
        </fieldset>
        {details}
        {archive}
      </div>
    )
  })
}

/** Add a category in a sheet: its name with a preview tile, then its look. */
function CategorySheet({ copy, locale, close, save }: {
  copy: MonthlyCopy; locale: Locale; close: () => void
  save: (name: string, appearance: { color: string | null; icon: string }) => Promise<FormSheetResult>
}) {
  const [name, setName] = useState("")
  const [color, setColor] = useState<string | null>(null)
  const [icon, setIcon] = useState("tag")
  const preview = categoryVisual(name, { color: color ?? "", icon })
  return (
    <FormSheet open title={copy.addCategory} description={copy.categoryNote}
      submitLabel={copy.add} cancelLabel={copy.cancel} submitDisabled={!name.trim()}
      submit={() => save(name.trim(), { color, icon })} close={close}>
      <div className="flex items-end gap-3">
        <IconTile icon={preview.icon} tone={preview.tone} size={36} />
        <div className="min-w-0 flex-1">
          <Field label={copy.categoryName}>
            <Input maxLength={100} value={name} onChange={event => setName(event.target.value)} />
          </Field>
        </div>
      </div>
      <CategoryLookFields automatic locale={locale} color={color} icon={icon} onColor={setColor} onIcon={setIcon} />
    </FormSheet>
  )
}

/**
 * What one category did in the shown period, read-only: spent, what is left of its
 * reserve, its latest expenses, and the way to all of them or to archive it.
 */
function CategoryDetails({ page, category, close }: { page: PageProps; category: MonthlyCategory; close: () => void }) {
  const { state, copy, fmt, busy } = page
  const summary = state.summary
  const view = useMemo(() => {
    const merchantById = new Map(page.merchants.map(merchant => [merchant.id, merchant]))
    const entries = state.entries
      .filter(({ expense }) => expense.categoryId === category.id && (!summary || (expense.occurredOn >= summary.start && expense.occurredOn <= summary.end)))
      .sort((a, b) => b.expense.occurredOn.localeCompare(a.expense.occurredOn))
    const spent = entries.reduce((sum, { expense, voided }) => (voided ? sum : sum + scopedCents(expense, { kind: "all" })), 0)
    const pot = summary?.categories.find(item => item.categoryId === category.id && item.reservedCents > 0)
    const used = pot ? Math.min(1, Math.max(0, 1 - pot.remainingCents / pot.reservedCents)) : 0
    const cells: MetricCell[] = [{ label: copy.spent, value: fmt.money(spent) }]
    cells.push(pot
      ? { label: copy.reserveLeft, value: fmt.money(pot.remainingCents), negative: pot.remainingCents < 0,
          note: fill(pot.remainingCents < 0 ? copy.overOf : copy.leftOf, { amount: fmt.money(pot.reservedCents) }),
          meter: { fraction: used } }
      : { label: copy.reserve, value: fmt.money(0), note: copy.noReserveNote })
    return { cells, rows: entries.slice(0, 5).map(entry => expenseRowModel(entry, state, merchantById, fmt, copy)) }
  }, [state, summary, category.id, page.merchants, copy, fmt])
  const visual = categoryVisual(category.name, category)

  return (
    <DetailSheet open title={category.name} closeLabel={copy.close} close={close}
      description={summary ? `${copy.period} ${fmt.date(summary.start)} – ${fmt.date(summary.end)}` : copy.categories}
      leading={<IconTile icon={visual.icon} tone={visual.tone} size={36} />}
      actions={(
        <Button variant="secondary" disabled={busy} onClick={() => void toggleArchived(page, category)}>
          {category.archived ? <IconRestore /> : <IconArchive />}{category.archived ? copy.restore : copy.archive}
        </Button>
      )}>
      <MetricStrip cells={view.cells} />
      <Group>
        {view.rows.length === 0
          ? <ListEmpty>{copy.noCategoryExpenses}</ListEmpty>
          : view.rows.map(row => <ExpenseRow key={row.expense.id} row={row} copy={copy} showDate />)}
        <Row href={`/budget/expenses?category=${category.id}`} className="justify-between font-medium text-link">
          {copy.categoryExpenses}<IconChevronRight className="size-4" />
        </Row>
      </Group>
    </DetailSheet>
  )
}

// ---------- Guided setup ----------

/** The first-run flow: a settings-width column, one card per step with a progress row on top and its actions in the footer. */
function PlanSetup(page: PageProps) {
  const { state, draft, copy, fmt, busy, serverError } = page
  const [step, setStep] = useState(0)
  const [adding, setAdding] = useState(false)
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
      <ListCard>
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
              <ListSubhead>{kind === "fixed" ? copy.fixed : kind === "monthly" ? copy.monthly : copy.yearly}</ListSubhead>
              <CostRows kind={kind} draft={draft} copy={copy} merchants={page.merchants} />
            </div>
          )) : null}
          {step === 2 ? (
            <>
              <CategoryRows {...page} />
              <Row onClick={() => setAdding(true)}>
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
      </ListCard>
      {step === 3 && draft.previewCurrent && draft.forecast.length > 0 ? <Forecast forecast={draft.forecast} locale={page.locale} currency={state.currency} /> : null}
      {adding ? <CategorySheet copy={copy} locale={page.locale} close={() => setAdding(false)}
        save={(name, appearance) => page.run(() => saveMonthlyCategory(page.accessToken, name, undefined, appearance), "sheet")} /> : null}
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
      <ListFooter>{copy.forecastNote}</ListFooter>
    </Group>
  )
}
