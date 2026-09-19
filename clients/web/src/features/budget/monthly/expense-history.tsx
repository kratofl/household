"use client"

import { useMemo, useState } from "react"

import { FormSelect } from "@/components/app/form-select"
import { Block, Group, IconTile, Row } from "@/components/app/grouped"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { categoryVisual } from "./category-visuals"
import type { Merchant } from "../merchants"
import { MerchantTile } from "../merchant-tile"
import { type ExpenseRowModel, formatters, groupRowsByDay } from "./controller"
import { type MonthlyCopy, monthlyCopy } from "./copy"
import type { ExpenseIntent } from "./expense-editor"
import type { MonthlyExpense, MonthlyState } from "./types"

export function MonthlyExpenseHistory({
  state,
  through,
  locale,
  merchantById,
  savingsOnly = false,
  busy,
  open,
  voidEntry,
}: {
  state: MonthlyState
  through: string
  locale: Locale
  merchantById: Map<string, Merchant>
  savingsOnly?: boolean
  busy: boolean
  open: (intent: ExpenseIntent) => void
  voidEntry: (expense: MonthlyExpense) => void
}) {
  const copy = monthlyCopy(locale)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [source, setSource] = useState("all")
  const groups = useMemo(() => {
    const fmt = formatters(locale, state.currency)
    const rows = state.entries
      .filter(
        ({ expense }) =>
          expense.occurredOn <= through &&
          (savingsOnly ? expense.funding.some((part) => part.source === "savings") : !state.summary || expense.occurredOn >= state.summary.start) &&
          (category === "all" || expense.categoryId === category) &&
          (source === "all" || expense.funding.some((part) => part.source === source)) &&
          `${expense.description} ${expense.categoryName} ${merchantName(expense.merchantId, merchantById)}`
            .toLocaleLowerCase(locale)
            .includes(search.toLocaleLowerCase(locale)),
      )
      .map(({ expense, voided }) => ({
        expense,
        voided,
        date: fmt.date(expense.occurredOn),
        amount: fmt.money(expense.amountCents),
        sources: expense.funding.map((part) => sourceName(part.source, copy)).join(" · "),
        merchant: expense.merchantId ? merchantById.get(expense.merchantId) ?? null : null,
      }))
    return groupRowsByDay(rows, fmt)
  }, [state.entries, state.currency, state.summary, through, savingsOnly, category, source, search, locale, copy, merchantById])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="sm:max-w-xs" aria-label={copy.search} placeholder={copy.search} value={search} onChange={(event) => setSearch(event.target.value)} />
        <FormSelect
          className="w-auto"
          aria-label={copy.category}
          value={category}
          onValueChange={setCategory}
          options={[{ value: "all", label: copy.allCategories }, ...state.categories.map((item) => ({ value: item.id, label: item.name }))]}
        />
        {!savingsOnly ? (
          <FormSelect
            className="w-auto"
            aria-label={copy.source}
            value={source}
            onValueChange={setSource}
            options={[
              { value: "all", label: copy.allSources },
              { value: "fun", label: copy.fun },
              { value: "category", label: copy.categorySource },
              { value: "savings", label: copy.savingsSource },
              { value: "buffer", label: copy.bufferSource },
            ]}
          />
        ) : null}
      </div>
      {groups.length === 0 ? <div className="surface-group"><Block className="text-muted-foreground">{copy.emptyExpenses}</Block></div> : null}
      {groups.map((group) => (
        <Group key={group.date} title={group.label} trailing={group.total}>
          {group.rows.map((row) => (
            <ExpenseRow key={row.expense.id} row={row} copy={copy}>
              {!row.voided ? (
                <div className="flex basis-full items-center justify-end gap-1 sm:order-1 sm:basis-auto sm:opacity-0 sm:transition-opacity sm:focus-within:opacity-100 sm:group-hover/row:opacity-100">
                  {row.expense.kind === "expense" ? (
                    <>
                      <Button size="xs" variant="outline" disabled={busy} onClick={() => open({ kind: "edit", expense: row.expense })}>{copy.edit}</Button>
                      <Button size="xs" variant="outline" disabled={busy} onClick={() => open({ kind: "refund", expense: row.expense })}>{copy.refund}</Button>
                    </>
                  ) : null}
                  <Button size="xs" variant="outline" disabled={busy} onClick={() => voidEntry(row.expense)}>{copy.void}</Button>
                </div>
              ) : null}
            </ExpenseRow>
          ))}
        </Group>
      ))}
    </div>
  )
}

/** One expense as a grouped-list row: icon tile, description, meta, amount. */
export function ExpenseRow({ row, copy, showDate = false, children }: { row: ExpenseRowModel; copy: MonthlyCopy; showDate?: boolean; children?: React.ReactNode }) {
  const visual = categoryVisual(row.expense.categoryName)
  const refund = row.expense.kind === "refund"
  return (
    <Row className={cn("group/row flex-wrap", row.voided && "opacity-60")}>
      {row.merchant ? <MerchantTile merchant={row.merchant} /> : <IconTile icon={visual.icon} color={visual.color} />}
      <div className="min-w-0 flex-1">
        <p className={cn("flex items-center gap-2 truncate font-medium", row.voided && "line-through")}>
          {row.expense.description || row.expense.categoryName}
          {row.voided ? <Badge variant="secondary">{copy.voided}</Badge> : null}
          {refund ? <Badge variant="secondary">{copy.refundLabel}</Badge> : null}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {showDate ? `${row.date} · ` : ""}
          {row.merchant ? `${row.merchant.name} · ` : ""}
          {row.expense.categoryName}
          {row.sources ? ` · ${row.sources}` : ""}
        </p>
      </div>
      <span className={cn("tabular-nums sm:order-2", refund && "font-medium text-positive")}>
        {refund ? "+" : "−"}
        {row.amount}
      </span>
      {children}
    </Row>
  )
}

function sourceName(source: MonthlyExpense["funding"][number]["source"], copy: MonthlyCopy) {
  return source === "category" ? copy.categorySource : source === "savings" ? copy.savingsSource : source === "buffer" ? copy.bufferSource : copy.fun
}

function merchantName(id: string | null, merchants: Map<string, Merchant>) {
  return id ? merchants.get(id)?.name ?? "" : ""
}
