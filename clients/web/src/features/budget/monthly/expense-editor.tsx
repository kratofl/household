"use client"

import { useEffect, useMemo, useState } from "react"

import { FormSelect } from "@/components/app/form-select"
import { FormRow } from "@/components/app/grouped"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import type { Locale } from "@/lib/i18n"
import { uuid } from "@/lib/uuid"

import type { Merchant } from "../merchants"
import { addMonthlyExpense, loadMonthlyBudget, refundMonthlyExpense } from "./api"
import { formatters, moneyInput, parseMoney } from "./controller"
import { monthlyCopy, monthlyError } from "./copy"
import type { Funding, MonthlyExpense, MonthlyState } from "./types"

export type ExpenseIntent =
  | { kind: "add"; categoryId?: string; source?: "savings" | "category" | "buffer" }
  | { kind: "edit"; expense: MonthlyExpense }
  | { kind: "refund"; expense: MonthlyExpense }
type Source = "auto" | "fun" | "savings" | "category" | "buffer"
type Props = { intent: ExpenseIntent; state: MonthlyState; accessToken: string; locale: Locale; busy: boolean; merchants: Merchant[];
  serverError: string | null; run: (action: () => Promise<unknown>) => Promise<boolean>; close: () => void; restoreFocus: () => void }

function useExpenseEditor(props: Props) {
  const { intent, state, accessToken, locale, run, close } = props
  const copy = monthlyCopy(locale)
  const original = intent.kind === "add" ? null : intent.expense
  const [amount, setAmount] = useState(original ? moneyInput(original.amountCents) : "")
  const [category, setCategory] = useState(original?.categoryId ?? (intent.kind === "add" ? intent.categoryId : undefined) ?? state.categories.find(item => !item.archived)?.id ?? "")
  const [date, setDate] = useState(intent.kind === "edit" ? intent.expense.occurredOn : state.today)
  const [description, setDescription] = useState(original?.description ?? "")
  const [merchant, setMerchant] = useState(original?.merchantId ?? "")
  const [source, setSource] = useState<Source>(intent.kind === "edit" ? intent.expense.funding[0]?.source ?? "auto" : intent.kind === "add" ? intent.source ?? "auto" : "auto")
  const [cover, setCover] = useState(intent.kind === "edit" && intent.expense.funding.length > 1)
  const [requestKey, setRequestKey] = useState(() => uuid())
  const [error, setError] = useState<string | null>(null)
  const [context, setContext] = useState<{ date: string; data: MonthlyState } | null>(null)
  useEffect(() => {
    let active = true
    if (!date || !state.firstDate || date < state.firstDate || date > state.today || intent.kind === "refund") return
    loadMonthlyBudget(accessToken, date).then(data => { if (active) setContext({ date, data }) })
      .catch((reason: unknown) => { if (active) setError(monthlyError(reason, copy)) })
    return () => { active = false }
  }, [date, accessToken, state.firstDate, state.today, copy, intent.kind])

  const calculated = useMemo(() => {
    const fmt = formatters(locale, state.currency)
    const summary = context?.date === date ? context.data.summary : null
    const reserve = summary?.categories.find(item => item.categoryId === category)
    const selected = source === "auto" ? reserve ? "category" : "fun" : source
    let available = selected === "savings" ? summary?.savingsBalanceCents ?? 0 : selected === "buffer" ? summary?.bufferBalanceCents ?? 0 : selected === "category" ? reserve?.remainingCents ?? 0 : summary?.funRemainingCents ?? 0
    if (intent.kind === "edit" && summary && intent.expense.occurredOn >= summary.start && intent.expense.occurredOn <= date) {
      available += intent.expense.funding.filter(part => part.source === selected && (part.source !== "category" || part.categoryId === category)).reduce((sum, part) => sum + part.amountCents, 0)
    }
    const cents = parseMoney(amount)
    const shortage = selected !== "fun" && cents !== null ? Math.max(0, cents - available) : 0
    const defaultSourceLabel = selected === "category" ? copy.categorySource : selected === "savings" ? copy.savingsSource : selected === "buffer" ? copy.bufferSource : copy.fun
    const funding: Funding[] = []
    if (cents !== null && cents > 0 && (shortage === 0 || cover)) {
      const protectedAmount = cents - (cover ? shortage : 0)
      if (protectedAmount > 0) funding.push(selected === "category" ? { source: "category", categoryId: category, amountCents: protectedAmount } : { source: selected, categoryId: null, amountCents: protectedAmount })
      if (shortage > 0 && cover) funding.push({ source: "fun", categoryId: null, amountCents: shortage })
    }
    const categories = state.categories.filter(item => !item.archived || item.id === original?.categoryId).map(item => ({ value: item.id, label: item.name }))
    const merchants = [{ value: "", label: copy.noMerchant },
      ...props.merchants.filter(item => !item.archived || item.id === original?.merchantId).map(item => ({ value: item.id, label: item.name }))]
    return { cents, shortage, funding, available: fmt.money(available), shortfall: fmt.money(shortage), categories, merchants,
      sourceLabel: defaultSourceLabel, ready: intent.kind === "refund" || summary !== null }
  }, [amount, category, context, copy, cover, date, intent, locale, original, props.merchants, source, state.categories, state.currency])

  const submit = async (another: boolean) => {
    setError(null)
    if (calculated.cents === null || calculated.cents <= 0 || !category || !date || !calculated.ready) { setError(copy.invalid_input); return }
    if (intent.kind !== "refund" && calculated.funding.length === 0) { setError(copy.insufficient_funds); return }
    const cents = calculated.cents
    const saved = await run(() => intent.kind === "refund" ? refundMonthlyExpense(accessToken, intent.expense.id, { requestKey, occurredOn: date, amountCents: cents }) :
      addMonthlyExpense(accessToken, { requestKey, occurredOn: date, description, categoryId: category, amountCents: cents,
        funding: calculated.funding, correctsId: intent.kind === "edit" ? intent.expense.id : null, merchantId: merchant || null }))
    if (saved) {
      if (another) {
        setAmount(""); setDescription(""); setCover(false); setRequestKey(uuid())
        try { setContext({ date, data: await loadMonthlyBudget(accessToken, date) }) }
        catch (reason: unknown) { setError(monthlyError(reason, copy)) }
      } else close()
    }
  }
  return { copy, amount, setAmount, category, setCategory, date, setDate, description, setDescription, merchant, setMerchant,
    source, setSource: (value: string) => { if (value === "auto" || value === "fun" || value === "category" || value === "savings" || value === "buffer") { setSource(value); setCover(false) } },
    cover, setCover, error, calculated, submit }
}

/**
 * Expense form as a sheet in the Apple form idiom: a header bar with Cancel /
 * title / Save, a large amount field, then grouped rows.
 */
export function MonthlyExpenseEditor(props: Props) {
  const editor = useExpenseEditor(props)
  const { copy } = editor
  const title = props.intent.kind === "refund" ? copy.refund : props.intent.kind === "edit" ? copy.edit : copy.addExpense
  const formId = "monthly-expense-form"
  return (
    <Sheet open onOpenChange={open => { if (!open && !props.busy) props.close() }}>
      <SheetContent
        showCloseButton={false}
        onCloseAutoFocus={event => { event.preventDefault(); props.restoreFocus() }}
        className="overflow-y-auto border-l-0 bg-background p-0 shadow-[0_0_0_0.5px_var(--hairline),0_24px_60px_-20px_rgb(0_0_0/0.4)] data-[side=right]:w-full sm:data-[side=right]:max-w-md"
      >
        <div className="glass-bar sticky top-0 z-10 flex h-[52px] items-center justify-between px-4">
          <Button type="button" variant="outline" disabled={props.busy} onClick={props.close}>{copy.cancel}</Button>
          <SheetTitle className="text-[13px] font-semibold">{title}</SheetTitle>
          <SheetDescription className="sr-only">{props.intent.kind === "refund" ? copy.refundAmount : copy.source}</SheetDescription>
          <Button type="submit" form={formId} disabled={props.busy || !editor.calculated.ready}>
            {props.intent.kind === "refund" ? copy.saveRefund : copy.save}
          </Button>
        </div>
        <form id={formId} className="space-y-5 px-4 py-5" onSubmit={event => { event.preventDefault(); void editor.submit(false) }}>
          <fieldset disabled={props.busy} className="space-y-5">
            {editor.error ? <Alert variant="destructive"><AlertDescription>{editor.error}</AlertDescription></Alert> : null}
            {props.serverError ? <Alert variant="destructive"><AlertDescription>{props.serverError}</AlertDescription></Alert> : null}

            <div className="surface-group px-4 py-5 text-center">
              <Label htmlFor="expense-amount" className="sr-only">{props.intent.kind === "refund" ? copy.refundAmount : copy.amount}</Label>
              <input
                autoFocus
                id="expense-amount"
                required
                inputMode="decimal"
                placeholder="0,00"
                value={editor.amount}
                onChange={event => editor.setAmount(event.target.value)}
                className="w-full bg-transparent text-center text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums outline-none placeholder:text-muted-foreground/40"
              />
              <p className="mt-1 text-muted-foreground">{props.state.currency}</p>
            </div>

            <div className="surface-group hairline-rows">
              {props.intent.kind !== "refund" ? (
                <FormRow label={copy.category} htmlFor="expense-category">
                  <FormSelect id="expense-category" className="w-auto min-w-40" value={editor.category} onValueChange={editor.setCategory} options={editor.calculated.categories} />
                </FormRow>
              ) : null}
              <FormRow label={copy.date} htmlFor="expense-date">
                <Input id="expense-date" type="date" className="w-40" required min={props.state.firstDate ?? undefined} max={props.state.today} value={editor.date} onChange={event => editor.setDate(event.target.value)} />
              </FormRow>
              {props.intent.kind !== "refund" ? (
                <>
                  <FormRow label={copy.merchant} htmlFor="expense-merchant">
                    <FormSelect id="expense-merchant" className="w-auto min-w-40" value={editor.merchant} onValueChange={editor.setMerchant} options={editor.calculated.merchants} />
                  </FormRow>
                  <FormRow label={copy.description} htmlFor="expense-description">
                    <Input id="expense-description" className="w-48 text-right" maxLength={300} value={editor.description} onChange={event => editor.setDescription(event.target.value)} />
                  </FormRow>
                  <FormRow
                    label={copy.source}
                    htmlFor="expense-source"
                    hint={editor.calculated.ready ? `${editor.calculated.sourceLabel} · ${copy.sourceBalance}: ${editor.calculated.available}` : copy.loading}
                  >
                    <FormSelect
                      id="expense-source"
                      className="w-auto min-w-40"
                      value={editor.source}
                      onValueChange={editor.setSource}
                      options={[
                        { value: "auto", label: copy.auto }, { value: "fun", label: copy.fun }, { value: "category", label: copy.categorySource },
                        { value: "savings", label: copy.savingsSource }, { value: "buffer", label: copy.bufferSource },
                      ]}
                    />
                  </FormRow>
                </>
              ) : null}
            </div>

            {editor.calculated.shortage > 0 ? (
              <div className="surface-group hairline-rows">
                <div className="px-4 py-3">
                  <p className="font-medium">{copy.excess}: {editor.calculated.shortfall}</p>
                  <p className="text-[11px] text-muted-foreground">{copy.coverNote}</p>
                </div>
                <FormRow label={copy.cover} htmlFor="cover-shortfall">
                  <Switch id="cover-shortfall" checked={editor.cover} onCheckedChange={editor.setCover} />
                </FormRow>
              </div>
            ) : null}

            {props.intent.kind === "add" ? (
              <Button type="button" variant="outline" className="w-full" disabled={!editor.calculated.ready} onClick={() => void editor.submit(true)}>
                {copy.saveAnother}
              </Button>
            ) : null}
          </fieldset>
        </form>
      </SheetContent>
    </Sheet>
  )
}
