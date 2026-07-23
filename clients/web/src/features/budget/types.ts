export type BudgetPeriod = {
  id: string
  name: string
  startDate: string
  endDate: string
  preferredStartDay: number
  spendingLimitCents: number
  overspendCarryoverCents: number
}

export type BudgetSetupState = {
  completed: boolean
  baseCurrency: string
  baseCurrencyLocked: boolean
  preferredPeriodStartDay: number
  bufferRule: "fixed" | "percentage"
  bufferAmountCents: number
  bufferPercentageBasisPoints: number
  defaultBufferDisposition: "retain" | "ordinary" | "savings" | "investment"
  incomePlans: Array<{ id: string; name: string; amountCents: number }>
  openingAllocations: Array<{
    id: string
    kind: "buffer" | "savings" | "investment"
    name: string
    amountCents: number
    occurredOn: string
  }>
}

export type BudgetSetupInput = {
  baseCurrency: string
  preferredPeriodStartDay: number
  bufferRule: BudgetSetupState["bufferRule"]
  bufferAmountCents: number
  bufferPercentageBasisPoints: number
  defaultBufferDisposition?: BudgetSetupState["defaultBufferDisposition"]
  incomePlans?: Array<{ name: string; amountCents: number }>
  openingAllocations?: Array<{
    kind: "buffer" | "savings" | "investment"
    name: string
    amountCents: number
  }>
}

export type BudgetCategory = {
  id: string
  name: string
  color: string
  icon: string
  behavior: "include_in_limit" | "exclude_from_limit"
  archived: boolean
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
  actualIncomeCents: number
  forecastBufferTargetCents: number
  actualBufferTargetCents: number
  fundedBufferCents: number
  bufferShortfallCents: number
  accumulatedBufferCents: number
  protectedBufferCents: number
  deficitCarryoverCents: number
  savingsContributionCents: number
  totalSavingsCents: number
  unallocatedSavingsCents: number
  reservationCents: number
  maximumOrdinaryCents: number
  ordinaryAvailableCents: number
  ledgerEntries: BudgetLedgerEntry[]
}

export type BudgetLedgerEntry = {
  id: string
  periodId: string
  categoryId?: string
  kind: "income" | "expense"
  occurredOn: string
  description: string
  amountCents: number
  ordinaryImpactCents: number
  source: string
  merchantRaw: string
  merchantNormalized: string
  merchantBrandKey?: string
  splits: Array<{
    id: string
    categoryId?: string
    categoryNameSnapshot: string
    categoryColorSnapshot: string
    categoryIconSnapshot: string
    amountCents: number
    ordinaryImpactCents: number
  }>
  createdAt: string
}

export type BudgetLedgerEntryInput = {
  kind: BudgetLedgerEntry["kind"]
  occurredOn: string
  description: string
  amountCents: number
  categoryId?: string
  affectsOrdinary?: boolean
  merchant?: string
  splits?: Array<{
    categoryId: string
    amountCents?: number
    useRemaining: boolean
    affectsOrdinary: boolean
  }>
}

export type BudgetTimelineItem = {
  id: string
  entryType: "actual" | "expected"
  kind: "income" | "expense" | "refund" | "savings"
  status: "actual" | "expected" | "confirmed" | "automatically_posted" | "corrected" | "voided"
  occurredOn: string
  description: string
  amountCents: number
  ordinaryImpactCents: number
  categoryId?: string
  merchant: string
  merchantBrandKey?: string
  origin: string
  splits: BudgetLedgerEntry["splits"]
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

export type BudgetCategoryInput = Pick<BudgetCategory, "name" | "color" | "icon" | "behavior"> & {
  archived?: boolean
}

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

export type IncomePlan = {
  seriesId: string
  name: string
  amountCents: number
  cadence: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom"
  intervalUnit: "day" | "week" | "month" | "quarter" | "year"
  intervalCount: number
  weekdays: number[]
  startDate: string
  automaticPosting: boolean
  stoppedOn?: string
  pauses: Array<{ id: string; from: string; through: string; reason: string }>
  versions: Array<{ id: string; effectiveFrom: string; effectiveTo?: string; automaticPosting: boolean; changeReason: string }>
}

export type ExpectedIncomeOccurrence = {
  id: string
  seriesId: string
  versionId: string
  scheduledOn: string
  occurredOn: string
  name: string
  amountCents: number
  overridden: boolean
  status: "expected" | "confirmed" | "automatically_posted"
  posting?: {
    id: string
    ledgerEntryId: string
    actualOn: string
    actualAmountCents: number
    varianceCents: number
    postingMode: "manual" | "automatic"
    allocations: Array<{ destination: string; targetId?: string; amountCents: number }>
  }
}

export type IncomePlanProjection = {
  plans: IncomePlan[]
  occurrences: ExpectedIncomeOccurrence[]
}

export type IncomePlanInput = {
  name: string
  amountCents: number
  cadence: IncomePlan["cadence"]
  intervalUnit: IncomePlan["intervalUnit"]
  intervalCount: number
  weekdays: number[]
  automaticPosting: boolean
  startDate: string
  stopDate?: string
}

export type CommitmentPlan = {
  seriesId: string
  categoryId?: string
  kind: "fixed_cost" | "subscription"
  name: string
  amountCents: number
  cadence: "weekly" | "monthly" | "quarterly" | "yearly" | "custom"
  intervalUnit: "week" | "month" | "quarter" | "year"
  intervalCount: number
  weekdays: number[]
  startDate: string
  budgetingMode: "due_period" | "gradual_reservation"
  chargeFirstShortfall: boolean
  automaticPosting: boolean
  stoppedOn?: string
  pauses: Array<{ id: string; from: string; through: string; reason: string }>
  versions: Array<{
    id: string
    effectiveFrom: string
    effectiveTo?: string
    categoryId?: string
    kind: CommitmentPlan["kind"]
    name: string
    amountCents: number
    cadence: CommitmentPlan["cadence"]
    intervalUnit: CommitmentPlan["intervalUnit"]
    intervalCount: number
    weekdays: number[]
    budgetingMode: CommitmentPlan["budgetingMode"]
    chargeFirstShortfall: boolean
    automaticPosting: boolean
    changeReason: string
    active: boolean
  }>
}

export type ExpectedCommitmentOccurrence = {
  id: string
  seriesId: string
  versionId: string
  categoryId?: string
  kind: CommitmentPlan["kind"]
  scheduledOn: string
  occurredOn: string
  name: string
  amountCents: number
  budgetingMode: CommitmentPlan["budgetingMode"]
  chargeFirstShortfall: boolean
  reservationRateCents: number
  reservationCoverageCents: number
  reservationShortfallCents: number
  reservations: Array<{
    periodStart: string
    periodEnd: string
    amountCents: number
    eligible: boolean
  }>
  overridden: boolean
  status: "expected" | "confirmed" | "automatically_posted"
  posting?: {
    id: string
    ledgerEntryId: string
    actualOn: string
    actualAmountCents: number
    reservationCoverageCents: number
    directOrdinaryImpactCents: number
    postingMode: "manual" | "automatic" | "matched" | "legacy"
  }
}

export type CommitmentProjection = {
  plans: CommitmentPlan[]
  occurrences: ExpectedCommitmentOccurrence[]
}

export type CommitmentInput = {
  categoryId?: string
  kind: CommitmentPlan["kind"]
  name: string
  amountCents: number
  cadence: CommitmentPlan["cadence"]
  intervalUnit: CommitmentPlan["intervalUnit"]
  intervalCount: number
  weekdays: number[]
  startDate: string
  stopDate?: string
  budgetingMode: CommitmentPlan["budgetingMode"]
  chargeFirstShortfall: boolean
  automaticPosting: boolean
}

export type SavingsProjection = {
  totalSavedCents: number
  unallocatedCents: number
  purposes: Array<{
    id: string
    name: string
    archived: boolean
    allocatedCents: number
  }>
  contributions: Array<{
    id: string
    kind: "contribution" | "opening"
    occurredOn: string
    description: string
    amountCents: number
    unallocatedCents: number
    allocations: Array<{
      id: string
      purposeId: string
      mode: "fixed" | "percentage"
      requestedValue: number
      amountCents: number
    }>
  }>
}
