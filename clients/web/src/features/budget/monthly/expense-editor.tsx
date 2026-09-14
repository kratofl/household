"use client"

import { useEffect, useMemo, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FormSelect } from "@/components/app/form-select"
import type { Locale } from "@/lib/i18n"
import { addMonthlyExpense, loadMonthlyBudget, refundMonthlyExpense } from "./api"
import { formatters, moneyInput, parseMoney } from "./controller"
import { monthlyCopy, monthlyError } from "./copy"
import type { Funding, MonthlyExpense, MonthlyState } from "./types"

export type ExpenseIntent =
  | { kind: "add"; categoryId?: string; source?: "savings" | "category" | "buffer" }
  | { kind: "edit"; expense: MonthlyExpense }
  | { kind: "refund"; expense: MonthlyExpense }
type Source = "auto" | "fun" | "savings" | "category" | "buffer"
type Props = { intent: ExpenseIntent; state: MonthlyState; accessToken: string; locale: Locale; busy: boolean;
  serverError: string | null; run: (action: () => Promise<unknown>) => Promise<boolean>; close: () => void; restoreFocus: () => void }

function useExpenseEditor(props: Props) {
  const { intent, state, accessToken, locale, run, close } = props
  const copy = monthlyCopy(locale)
  const original = intent.kind === "add" ? null : intent.expense
  const [amount, setAmount] = useState(original ? moneyInput(original.amountCents) : "")
  const [category, setCategory] = useState(original?.categoryId ?? (intent.kind === "add" ? intent.categoryId : undefined) ?? state.categories.find(item => !item.archived)?.id ?? "")
  const [date, setDate] = useState(intent.kind === "edit" ? intent.expense.occurredOn : state.today)
  const [description, setDescription] = useState(original?.description ?? "")
  const [source, setSource] = useState<Source>(intent.kind === "edit" ? intent.expense.funding[0]?.source ?? "auto" : intent.kind === "add" ? intent.source ?? "auto" : "auto")
  const [cover, setCover] = useState(intent.kind === "edit" && intent.expense.funding.length > 1)
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID())
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
    return { cents, shortage, funding, available: fmt.money(available), shortfall: fmt.money(shortage), categories,
      sourceLabel: defaultSourceLabel, ready: intent.kind === "refund" || summary !== null }
  }, [amount, category, context, copy, cover, date, intent, locale, original, source, state.categories, state.currency])

  const submit = async (another: boolean) => {
    setError(null)
    if (calculated.cents === null || calculated.cents <= 0 || !category || !date || !calculated.ready) { setError(copy.invalid_input); return }
    if (intent.kind !== "refund" && calculated.funding.length === 0) { setError(copy.insufficient_funds); return }
    const cents = calculated.cents
    const saved = await run(() => intent.kind === "refund" ? refundMonthlyExpense(accessToken, intent.expense.id, { requestKey, occurredOn: date, amountCents: cents }) :
      addMonthlyExpense(accessToken, { requestKey, occurredOn: date, description, categoryId: category, amountCents: cents,
        funding: calculated.funding, correctsId: intent.kind === "edit" ? intent.expense.id : null }))
    if (saved) {
      if (another) {
        setAmount(""); setDescription(""); setCover(false); setRequestKey(crypto.randomUUID())
        try { setContext({ date, data: await loadMonthlyBudget(accessToken, date) }) }
        catch (reason: unknown) { setError(monthlyError(reason, copy)) }
      } else close()
    }
  }
  return { copy, amount, setAmount, category, setCategory, date, setDate, description, setDescription,
    source, setSource: (value: string) => { if (value === "auto" || value === "fun" || value === "category" || value === "savings" || value === "buffer") { setSource(value); setCover(false) } },
    cover, setCover, error, calculated, submit }
}

export function MonthlyExpenseEditor(props: Props) {
  const editor = useExpenseEditor(props)
  const { copy } = editor
  return <Sheet open onOpenChange={open => { if (!open && !props.busy) props.close() }}><SheetContent showCloseButton={false} onCloseAutoFocus={event => { event.preventDefault(); props.restoreFocus() }} className="overflow-y-auto data-[side=right]:w-full sm:data-[side=right]:max-w-lg">
    <SheetHeader><SheetTitle>{props.intent.kind === "refund" ? copy.refund : props.intent.kind === "edit" ? copy.edit : copy.addExpense}</SheetTitle>
      <SheetDescription>{props.intent.kind === "refund" ? copy.refundAmount : copy.source}</SheetDescription>
      <Button variant="ghost" disabled={props.busy} onClick={props.close}>{copy.close}</Button>
    </SheetHeader>
    <form className="space-y-5 px-6 pb-6" onSubmit={event => { event.preventDefault(); void editor.submit(false) }}>
      <fieldset disabled={props.busy} className="space-y-5">
        {editor.error && <Alert variant="destructive"><AlertDescription>{editor.error}</AlertDescription></Alert>}
        {props.serverError && <Alert variant="destructive"><AlertDescription>{props.serverError}</AlertDescription></Alert>}
        <div className="space-y-2"><Label htmlFor="expense-amount">{copy.amount}</Label><Input autoFocus id="expense-amount" required inputMode="decimal" value={editor.amount} onChange={event => editor.setAmount(event.target.value)} /></div>
        {props.intent.kind !== "refund" && <div className="space-y-2"><Label htmlFor="expense-category">{copy.category}</Label><FormSelect id="expense-category" value={editor.category} onValueChange={editor.setCategory} options={editor.calculated.categories} /></div>}
        <div className="space-y-2"><Label htmlFor="expense-date">{copy.date}</Label><Input id="expense-date" type="date" required min={props.state.firstDate ?? undefined} max={props.state.today} value={editor.date} onChange={event => editor.setDate(event.target.value)} /></div>
        {props.intent.kind !== "refund" && <>
          <div className="space-y-2"><Label htmlFor="expense-description">{copy.description}</Label><Input id="expense-description" maxLength={300} value={editor.description} onChange={event => editor.setDescription(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="expense-source">{copy.source}</Label><FormSelect id="expense-source" value={editor.source} onValueChange={editor.setSource} options={[
            { value: "auto", label: copy.auto }, { value: "fun", label: copy.fun }, { value: "category", label: copy.categorySource }, { value: "savings", label: copy.savingsSource }, { value: "buffer", label: copy.bufferSource },
          ]} /><p className="text-sm text-muted-foreground" aria-live="polite">{editor.calculated.ready ? `${editor.calculated.sourceLabel} · ${copy.sourceBalance}: ${editor.calculated.available}` : copy.loading}</p></div>
          {editor.calculated.shortage > 0 && <Alert><AlertDescription className="space-y-3"><p>{copy.excess}: {editor.calculated.shortfall}</p><div className="flex items-center gap-3"><Switch id="cover-shortfall" checked={editor.cover} onCheckedChange={editor.setCover} /><Label htmlFor="cover-shortfall">{copy.cover}</Label></div><p>{copy.coverNote}</p></AlertDescription></Alert>}
        </>}
        <div className="flex flex-wrap gap-3"><Button type="submit" disabled={!editor.calculated.ready}>{props.intent.kind === "refund" ? copy.saveRefund : copy.save}</Button>
          {props.intent.kind === "add" && <Button type="button" variant="outline" disabled={!editor.calculated.ready} onClick={() => void editor.submit(true)}>{copy.saveAnother}</Button>}
        </div>
      </fieldset>
    </form>
  </SheetContent></Sheet>
}
