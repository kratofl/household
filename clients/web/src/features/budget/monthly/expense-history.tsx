"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FormSelect } from "@/components/app/form-select"
import type { Locale } from "@/lib/i18n"
import { formatters } from "./controller"
import { monthlyCopy } from "./copy"
import type { MonthlyExpense, MonthlyState } from "./types"
import type { ExpenseIntent } from "./expense-editor"

export function MonthlyExpenseHistory({ state, through, locale, savingsOnly = false, busy, open, voidEntry }: {
  state: MonthlyState; through: string; locale: Locale; savingsOnly?: boolean; busy: boolean;
  open: (intent: ExpenseIntent) => void; voidEntry: (expense: MonthlyExpense) => void;
}) {
  const copy = monthlyCopy(locale)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [source, setSource] = useState("all")
  const rows = useMemo(() => {
    const fmt = formatters(locale, state.currency)
    return state.entries.filter(({ expense }) => expense.occurredOn <= through &&
      (savingsOnly ? expense.funding.some(part => part.source === "savings") : !state.summary || expense.occurredOn >= state.summary.start) &&
      (category === "all" || expense.categoryId === category) && (source === "all" || expense.funding.some(part => part.source === source)) &&
      `${expense.description} ${expense.categoryName}`.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)))
      .map(({ expense, voided }) => ({ expense, voided, date: fmt.date(expense.occurredOn), amount: fmt.money(expense.amountCents),
        source: expense.funding.map(part => `${part.source === "category" ? copy.categorySource : part.source === "savings" ? copy.savingsSource : part.source === "buffer" ? copy.bufferSource : copy.fun}: ${fmt.money(part.amountCents)}`).join(" · ") }))
  }, [state.entries, state.currency, state.summary, through, savingsOnly, category, source, search, locale, copy])
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3"><Input aria-label={copy.search} placeholder={copy.search} value={search} onChange={event => setSearch(event.target.value)} />
      <FormSelect aria-label={copy.category} value={category} onValueChange={setCategory} options={[{ value: "all", label: copy.allCategories }, ...state.categories.map(item => ({ value: item.id, label: item.name }))]} />
      {!savingsOnly && <FormSelect aria-label={copy.source} value={source} onValueChange={setSource} options={[{ value: "all", label: copy.allSources }, { value: "fun", label: copy.fun }, { value: "category", label: copy.categorySource }, { value: "savings", label: copy.savingsSource }, { value: "buffer", label: copy.bufferSource }]} />}
    </div>
    {rows.length === 0 && <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{copy.emptyExpenses}</p>}
    <ul className="divide-y">{rows.map(row => <li key={row.expense.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={row.voided ? "line-through" : "font-medium"}>{row.expense.description || row.expense.categoryName}</span>
        {row.voided && <Badge variant="secondary">{copy.voided}</Badge>}{row.expense.kind === "refund" && <Badge variant="secondary">{copy.refundLabel}</Badge>}</div>
        <p className="text-sm text-muted-foreground">{row.date} · {row.expense.categoryName}</p><p className="text-xs text-muted-foreground">{row.source}</p></div>
      <div className="space-y-2 text-right"><p className="font-semibold tabular-nums">{row.expense.kind === "refund" ? "+" : "−"}{row.amount}</p>
        {!row.voided && <div className="flex flex-wrap gap-1">{row.expense.kind === "expense" && <><Button size="sm" variant="ghost" disabled={busy} onClick={() => open({ kind: "edit", expense: row.expense })}>{copy.edit}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => open({ kind: "refund", expense: row.expense })}>{copy.refund}</Button></>}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => voidEntry(row.expense)}>{copy.void}</Button></div>}
      </div>
    </li>)}</ul>
  </div>
}
