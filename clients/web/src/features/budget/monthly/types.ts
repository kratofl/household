export type MonthlyCost = {
  id: string
  name: string
  amountCents: number
  kind: "fixed" | "monthly" | "yearly"
  dueMonth: number | null
  dueDay: number | null
}
export type MonthlyPlan = {
  incomeCents: number
  bufferCents: number
  savingsCents: number
  costs: MonthlyCost[]
  reserves: { categoryId: string; amountCents: number }[]
}
export type Funding =
  | { source: "fun" | "savings" | "buffer"; categoryId: null; amountCents: number }
  | { source: "category"; categoryId: string; amountCents: number }
export type MonthlyCategory = { id: string; name: string; archived: boolean }
export type MonthlyExpense = {
  id: string
  occurredOn: string
  description: string
  categoryId: string
  categoryName: string
  amountCents: number
  funding: Funding[]
  kind: "expense" | "refund"
  relatedId: string | null
  /** Where the money went. Null for expenses booked before merchants existed, or without one. */
  merchantId: string | null
}
export type CostDue = Pick<MonthlyCost, "id" | "name" | "kind" | "amountCents">
export type MonthlyForecast = { start: string; end: string; funCents: number; costs: CostDue[] }
export type MonthlySummary = {
  start: string
  end: string
  incomeCents: number
  startingFunCents: number
  funRemainingCents: number
  savingsBalanceCents: number
  bufferBalanceCents: number
  savingsContributionCents: number
  deficitCarryoverCents: number
  fundingShortfallCents: number
  categories: { categoryId: string; reservedCents: number; remainingCents: number }[]
  costs: CostDue[]
}
export type MonthlyState = {
  today: string
  revision: number
  startDay: number
  currency: string
  timeZoneId: string
  openingSavingsCents: number
  firstDate: string | null
  nextStart: string
  currentPlan: MonthlyPlan | null
  nextPlan: MonthlyPlan | null
  summary: MonthlySummary | null
  forecast: MonthlyForecast[]
  categories: MonthlyCategory[]
  entries: { expense: MonthlyExpense; voided: boolean }[]
}
/** applyToCurrentPeriod rewrites the running period instead of starting the next one. */
export type SavePlan = {
  revision: number
  plan: MonthlyPlan
  openingSavingsCents: number
  timeZoneId: string
  applyToCurrentPeriod: boolean
}
export type ExpenseInput = {
  requestKey: string
  occurredOn: string
  description: string
  categoryId: string
  amountCents: number
  funding: Funding[] | null
  correctsId: string | null
  merchantId: string | null
}
