export type BudgetPeriod = {
  id: string
  name: string
  spendingLimitCents: number
  overspendCarryoverCents: number
}

export type BudgetCategory = {
  id: string
  name: string
  color: string
  behavior: "include_in_limit" | "exclude_from_limit"
  spentCents: number
}

export type BudgetAccount = {
  id: string
  name: string
  balanceCents: number
}

export type PlannedExpense = {
  id: string
  accountId: string
  categoryId?: string
  name: string
  kind: "fixed_cost" | "subscription"
  cadence: "monthly" | "yearly"
  amountCents: number
  dueDay: number
  dueMonth?: number
  includeInLimit: boolean
  active: boolean
  appliedInCurrentPeriod: boolean
}

export type BudgetSummary = {
  period: BudgetPeriod
  categories: BudgetCategory[]
  spentInLimitCents: number
  excludedSpentCents: number
  remainingCents: number
  accountBalanceCents: number
  accounts: BudgetAccount[]
  plannedExpenses: PlannedExpense[]
}

export type BudgetTransactionInput = {
  accountId: string
  categoryId: string
  occurredOn: string
  description: string
  amountCents: number
  includeInLimit: boolean
}

export type BudgetPeriodInput = {
  spendingLimitCents: number
  overspendCarryoverCents: number
}

export type BudgetCategoryInput = Pick<BudgetCategory, "name" | "color" | "behavior">

export type PlannedExpenseInput = {
  accountId: string
  categoryId?: string
  name: string
  kind: PlannedExpense["kind"]
  cadence: PlannedExpense["cadence"]
  amountCents: number
  dueDay: number
  dueMonth?: number
  includeInLimit: boolean
  active: boolean
}
