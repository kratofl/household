"use client"

// The Expenses page (DESIGN.md, page type "List"): the hub's metric strip, one filter
// row that scopes both the chart and the table, spending per day, then one table card
// grouped by day beside a narrow column of related summaries. The savings page reuses
// the filter row (category and search; its scope is always savings) and the table.
// Filtering and totals live in view-models.ts; this file renders.

import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react"
import { IconDots, IconReceipt, IconRepeat } from "@tabler/icons-react"

import { DailyBarChart } from "@/components/app/charts"
import { FormSelect } from "@/components/app/form-select"
import { Group, IconTile, listCardClass, Meter, Row } from "@/components/app/grouped"
import { SearchInput } from "@/components/app/search-input"
import { Segmented } from "@/components/app/segmented"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Locale } from "@/lib/i18n"
import { budgetViews } from "@/lib/modules"
import { cn } from "@/lib/utils"

import { categoryVisual } from "./category-visuals"
import type { Merchant } from "../merchants"
import { MerchantTile } from "../merchant-tile"
import { type ExpenseRowModel, fill, formatters } from "./controller"
import { type MonthlyCopy, monthlyCopy } from "./copy"
import type { ExpenseIntent } from "./expense-editor"
import type { MonthlyExpense, MonthlyState } from "./types"
import {
  addDays, budgetTags, dailyTotals, daysBetween, expenseEntries, type ExpenseScope, groupByDay, scopedCents, scopeFromKey, scopeOptions,
} from "./view-models"

// Written out so Tailwind sees them: merchant · category · budget · amount · actions.
const tableColumns = "lg:grid lg:grid-cols-[minmax(0,1fr)_7.5rem_8.5rem_6.5rem_1.5rem] lg:gap-x-4"

const savingsScope: ExpenseScope = { kind: "source", source: "savings" }

export function MonthlyExpenseHistory({
  state,
  through,
  locale,
  merchantById,
  savingsOnly = false,
  busy,
  open,
  voidEntry,
  metrics,
}: {
  state: MonthlyState
  through: string
  locale: Locale
  merchantById: Map<string, Merchant>
  savingsOnly?: boolean
  busy: boolean
  open: (intent: ExpenseIntent) => void
  voidEntry: (expense: MonthlyExpense) => void
  /** The page's metric strip, rendered first. */
  metrics?: ReactNode
}) {
  const copy = monthlyCopy(locale)
  const fmt = useMemo(() => formatters(locale, state.currency), [locale, state.currency])
  const [search, setSearch] = useState("")
  const [scopeKey, setScopeKey] = useState("all")
  const [categoryKey, setCategoryKey] = useState("all")
  const summary = state.summary
  const options = useMemo(
    () => scopeOptions(summary, state.categories, { all: copy.scopeAll, fun: copy.fun, savings: copy.tagSavings, buffer: copy.tagBuffer }),
    [summary, state.categories, copy],
  )
  const categoryOptions = useMemo(
    () => [{ value: "all", label: copy.allCategories }, ...state.categories.map((category) => ({ value: category.id, label: category.name }))],
    [state.categories, copy],
  )
  // A category whose reserve is not part of the shown period, or that no longer exists,
  // falls back to All; the controls show the key that actually applies.
  const selectedScope = options.some((option) => option.value === scopeKey) ? scopeKey : "all"
  const selectedCategory = categoryOptions.some((option) => option.value === categoryKey) ? categoryKey : "all"
  const scope = useMemo(() => (savingsOnly ? savingsScope : scopeFromKey(selectedScope)), [savingsOnly, selectedScope])
  const categoryId = selectedCategory === "all" ? null : selectedCategory

  const view = useMemo(() => {
    const merchantName = (id: string | null) => (id ? merchantById.get(id)?.name ?? "" : "")
    const entries = expenseEntries(state, { through, allPeriods: savingsOnly, scope, categoryId, search, locale, merchantName })
    const tagLabels = { fun: copy.fun, savings: copy.tagSavings, buffer: copy.tagBuffer }
    const rows: ExpenseRowModel[] = entries.map(({ expense, voided }) => ({
      expense,
      voided,
      category: state.categories.find((category) => category.id === expense.categoryId),
      date: fmt.date(expense.occurredOn),
      amount: fmt.money(expense.amountCents),
      sources: expense.funding.map((part) => sourceName(part.source, copy)).join(" · "),
      merchant: expense.merchantId ? merchantById.get(expense.merchantId) ?? null : null,
    }))
    const tags = new Map(entries.map(({ expense }) => [expense.id, budgetTags(expense, state.categories, tagLabels)]))
    const chart = summary && !savingsOnly
      ? {
          days: daysBetween(summary.start, summary.end) + 1,
          today: daysBetween(summary.start, through) + 1,
          amounts: dailyTotals(entries, summary.start, through, scope),
          // Tooltip rows: what was bought that day, in the scope.
          details: (day: number) => {
            const date = addDays(summary.start, day - 1)
            return entries
              .filter(({ expense, voided }) => !voided && expense.occurredOn === date)
              .slice(0, 5)
              .map(({ expense }) => ({ label: merchantName(expense.merchantId) || expense.description || expense.categoryName, value: fmt.money(scopedCents(expense, scope)) }))
          },
          dayLabel: (day: number) => fmt.dayShort(addDays(summary.start, day - 1)),
          tickLabel: (day: number) => (day === 1 ? fmt.dayMonth(summary.start) : fmt.dayOnly(addDays(summary.start, day - 1))),
          title: `${copy.spentPerDay}, ${fmt.date(summary.start)} – ${fmt.date(summary.end)}`,
          todayLabel: through === state.today ? copy.today : fmt.dayMonth(through),
        }
      : null
    const pots = summary
      ? summary.categories.filter((item) => item.reservedCents > 0).flatMap((item) => {
          const category = state.categories.find((candidate) => candidate.id === item.categoryId)
          return category ? [{ category, reserved: item.reservedCents, remaining: item.remainingCents }] : []
        })
      : []
    const groups = groupByDay(rows, scope).map((group) => ({ ...group, label: fmt.day(group.date), total: fmt.money(group.totalCents) }))
    const costs = (summary?.costs ?? []).map((cost) => ({ ...cost, merchant: cost.merchantId ? merchantById.get(cost.merchantId) ?? null : null }))
    return { groups, tags, chart, pots, costs }
  }, [state, through, savingsOnly, scope, categoryId, search, locale, copy, fmt, merchantById, summary])

  const filtered = search.trim() !== "" || categoryId !== null || (!savingsOnly && selectedScope !== "all")
  const table = (
    <ExpenseTable
      groups={view.groups}
      tags={view.tags}
      copy={copy}
      busy={busy}
      empty={filtered ? copy.noMatches : copy.emptyExpenses}
      open={open}
      voidEntry={voidEntry}
    />
  )

  return (
    <div className="space-y-4">
      {/* The topbar search lands here with ?q=, a category's details with ?category=.
          Reading the URL opts a subtree out of static rendering, hence the boundary. */}
      <Suspense fallback={null}>
        <FiltersFromUrl onSearch={setSearch} onCategory={setCategoryKey} />
      </Suspense>
      {metrics}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {savingsOnly ? null : (
          <>
            {/* Segments while they fit (desktop, at most five), a select otherwise. */}
            {options.length <= 5 ? (
              <Segmented ariaLabel={`${copy.colBudget}: ${copy.scopeLabel}`} value={selectedScope} options={options} onChange={setScopeKey} className="max-lg:hidden" />
            ) : null}
            <FormSelect className={cn("w-auto min-w-44 max-lg:flex-1", options.length <= 5 && "lg:hidden")} aria-label={`${copy.colBudget}: ${copy.scopeLabel}`}
              value={selectedScope} onValueChange={setScopeKey} options={options} />
          </>
        )}
        <FormSelect className="w-auto min-w-44 max-lg:flex-1" aria-label={copy.category} value={selectedCategory} onValueChange={setCategoryKey} options={categoryOptions} />
        {savingsOnly ? null : <span className="text-footnote text-label-secondary">{copy.scopeLabel}</span>}
        <SearchInput className="w-full sm:ml-auto sm:w-64" aria-label={copy.search} placeholder={copy.search} value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {savingsOnly ? table : (
        <>

          {view.chart ? (
            <Group title={copy.spentPerDay}>
              <div className="px-2 pt-2 pb-1.5">
                <DailyBarChart
                  days={view.chart.days}
                  today={view.chart.today}
                  amounts={view.chart.amounts}
                  formatMoney={fmt.money}
                  formatTick={fmt.whole}
                  dayLabel={view.chart.dayLabel}
                  tickLabel={view.chart.tickLabel}
                  details={view.chart.details}
                  labels={{ title: view.chart.title, today: view.chart.todayLabel, spent: copy.spent, open: copy.stillOpen }}
                />
              </div>
            </Group>
          ) : null}

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {table}
            <div className="space-y-4">
              {view.pots.length > 0 ? (
                <Group title={copy.reserved} action={{ label: copy.manage, href: budgetViews.categories.route }}>
                  {view.pots.map(({ category, reserved, remaining }) => {
                    const visual = categoryVisual(category.name, category)
                    const spent = reserved - remaining
                    return (
                      <div key={category.id} className="space-y-2 px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <IconTile icon={visual.icon} tone={visual.tone} size={26} />
                          <span className="min-w-0 flex-1 truncate font-medium">{category.name}</span>
                          <span className={cn("text-right tabular-nums", remaining < 0 && "text-danger-text")}>
                            {fmt.money(remaining)} <span className="text-footnote text-label-secondary">{fill(copy.leftOf, { amount: fmt.money(reserved) })}</span>
                          </span>
                        </div>
                        <Meter fraction={reserved > 0 ? spent / reserved : 0} label={`${fmt.money(spent)} ${copy.spent} · ${fill(copy.ofAmount, { amount: fmt.money(reserved) })}`} />
                      </div>
                    )
                  })}
                </Group>
              ) : null}
              {view.costs.length > 0 ? (
                <Group title={copy.automaticCosts}>
                  {view.costs.map((cost) => (
                    <Row key={cost.id}>
                      {cost.merchant ? <MerchantTile merchant={cost.merchant} size={28} /> : <IconTile icon={cost.kind === "fixed" ? IconReceipt : IconRepeat} tone="neutral" size={28} />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{cost.name}</p>
                        <p className="truncate text-footnote text-label-secondary">
                          {cost.kind === "fixed" ? copy.costFixed : cost.kind === "monthly" ? copy.costMonthly : copy.costYearly}
                          {cost.description ? ` · ${cost.description}` : null}
                        </p>
                      </div>
                      <span className="tabular-nums">{fmt.money(cost.amountCents)}</span>
                    </Row>
                  ))}
                  <div className="flex items-center gap-3 bg-fill px-4 py-2 text-footnote text-label-secondary">
                    <span className="min-w-0 flex-1">{copy.upcomingFooter}</span>
                    <span className="font-semibold text-label tabular-nums">{fmt.money(view.costs.reduce((sum, cost) => sum + cost.amountCents, 0))}</span>
                  </div>
                </Group>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** The one table card: column heads, then a fill header per day with its total and flat rows under it. */
function ExpenseTable({ groups, tags, copy, busy, empty, open, voidEntry }: {
  groups: { date: string; label: string; total: string; rows: ExpenseRowModel[] }[]
  /** Budget tags per expense id. */
  tags: Map<string, string[]>
  copy: MonthlyCopy
  busy: boolean
  empty: string
  open: (intent: ExpenseIntent) => void
  voidEntry: (expense: MonthlyExpense) => void
}) {
  return (
    <section className={listCardClass} aria-label={copy.expenses}>
      <div aria-hidden className={cn("hidden h-8 items-center px-4 text-caption text-label-secondary", groups.length > 0 && tableColumns)}>
        <span>{copy.colMerchant}</span>
        <span>{copy.category}</span>
        <span>{copy.colBudget}</span>
        <span className="text-right">{copy.amount}</span>
        <span />
      </div>
      {groups.length === 0 ? (
        <p className="px-4 py-6 text-center text-footnote text-label-secondary">{empty}</p>
      ) : (
        groups.map((group, index) => (
          <section key={group.date} aria-label={group.label}>
            <h3 className={cn("flex min-h-[30px] items-center justify-between gap-3 bg-fill px-4 text-footnote font-semibold text-label-secondary", index > 0 && "border-t border-separator", "lg:border-t lg:border-separator")}>
              <span>{group.label}</span>
              <span className="tabular-nums">{group.total}</span>
            </h3>
            <ul className="hairline-rows border-t border-separator">
              {group.rows.map((row) => (
                <LedgerRow key={row.expense.id} row={row} tags={tags.get(row.expense.id) ?? []} copy={copy} busy={busy} open={open} voidEntry={voidEntry} />
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  )
}

/**
 * One ledger entry as a table row. Desktop: merchant (tile, name, description) ·
 * category · where it was paid from · amount · actions. Phones fold category and
 * budget into a second line under the name.
 */
function LedgerRow({ row, tags, copy, busy, open, voidEntry }: {
  row: ExpenseRowModel
  tags: string[]
  copy: MonthlyCopy
  busy: boolean
  open: (intent: ExpenseIntent) => void
  voidEntry: (expense: MonthlyExpense) => void
}) {
  const { expense } = row
  const visual = categoryVisual(expense.categoryName, row.category)
  const refund = expense.kind === "refund"
  const title = row.merchant?.name || expense.description || expense.categoryName
  const detail = row.merchant && expense.description && expense.description !== row.merchant.name ? expense.description : ""
  return (
    <li className={cn("flex min-h-9 items-center gap-3 px-4 py-1 max-lg:min-h-12 max-lg:py-2", tableColumns, row.voided && "text-label-secondary")}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {row.merchant ? <MerchantTile merchant={row.merchant} size={28} /> : <IconTile icon={visual.icon} tone={visual.tone} size={28} />}
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2">
            <span className={cn("truncate font-medium", row.voided && "line-through")}>{title}</span>
            {detail ? <span className="truncate text-label-secondary max-lg:hidden">{detail}</span> : null}
            {row.voided ? <Badge>{copy.voided}</Badge> : null}
            {refund ? <Badge tone="green">{copy.refundLabel}</Badge> : null}
          </p>
          <p className="truncate text-footnote text-label-secondary lg:hidden">
            {[...new Set([detail, expense.categoryName, ...tags])].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <span className="truncate max-lg:hidden">{expense.categoryName}</span>
      <span className="flex min-w-0 flex-wrap gap-1 max-lg:hidden">
        {tags.map((tag, index) => <Badge key={`${tag}-${index}`} className="max-w-full truncate">{tag}</Badge>)}
      </span>
      <span className={cn("text-right font-semibold whitespace-nowrap tabular-nums", refund && !row.voided && "text-success-text", row.voided && "font-normal line-through")}>
        {refund ? "+" : "−"}
        {row.amount}
      </span>
      {row.voided ? <span className="w-6 max-lg:w-11" /> : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" disabled={busy} aria-label={`${copy.actions}: ${title}`} title={copy.actions}>
              <IconDots />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {expense.kind === "expense" ? (
              <>
                <DropdownMenuItem onSelect={() => open({ kind: "edit", expense })}>{copy.edit}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => open({ kind: "refund", expense })}>{copy.refund}</DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem variant="destructive" onSelect={() => voidEntry(expense)}>{copy.void}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  )
}

/** One expense as a compact grouped-list row: icon tile, title, meta, amount. The overview's recent list uses it. */
export function ExpenseRow({ row, copy, showDate = false, children }: { row: ExpenseRowModel; copy: MonthlyCopy; showDate?: boolean; children?: ReactNode }) {
  const visual = categoryVisual(row.expense.categoryName, row.category)
  const refund = row.expense.kind === "refund"
  const title = row.expense.description || row.merchant?.name || row.expense.categoryName
  return (
    <Row className="group/row flex-wrap">
      {row.merchant ? <MerchantTile merchant={row.merchant} /> : <IconTile icon={visual.icon} tone={visual.tone} />}
      <div className="min-w-0 flex-1">
        <p className={cn("flex items-center gap-2 truncate font-medium", row.voided && "line-through")}>
          {title}
          {row.voided ? <Badge>{copy.voided}</Badge> : null}
          {refund ? <Badge tone="green">{copy.refundLabel}</Badge> : null}
        </p>
        <p className="truncate text-footnote text-label-secondary">
          {showDate ? `${row.date} · ` : ""}
          {row.merchant && row.merchant.name !== title ? `${row.merchant.name} · ` : ""}
          {row.expense.categoryName}
          {row.sources ? ` · ${row.sources}` : ""}
        </p>
      </div>
      <span className={cn("font-medium tabular-nums sm:order-2", refund && "text-success-text")}>
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

/** Copies ?q= into the search field and ?category= into the category filter whenever they change, including on the page itself. */
function FiltersFromUrl({ onSearch, onCategory }: { onSearch: (value: string) => void; onCategory: (id: string) => void }) {
  const params = useSearchParams()
  const query = params.get("q")
  const category = params.get("category")
  useEffect(() => {
    if (query !== null) onSearch(query)
  }, [query, onSearch])
  useEffect(() => {
    if (category !== null) onCategory(category)
  }, [category, onCategory])
  return null
}
