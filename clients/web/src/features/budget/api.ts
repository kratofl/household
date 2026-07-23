import { apiRequest } from "@/lib/api"

import type {
  BudgetCategoryInput,
  BudgetLedgerEntry,
  BudgetLedgerEntryInput,
  BudgetPeriodInput,
  BudgetSummary,
  BudgetTimelineItem,
  BudgetSetupInput,
  BudgetSetupState,
  BudgetTransactionInput,
  CommitmentInput,
  CommitmentProjection,
  IncomePlanInput,
  IncomePlanProjection,
  PlannedExpenseInput,
} from "./types"

export function loadBudgetSetup(accessToken: string) {
  return apiRequest<BudgetSetupState>("/budget/setup", { accessToken })
}

export function saveBudgetSetup(accessToken: string, body: BudgetSetupInput) {
  return apiRequest<BudgetSetupState>("/budget/setup", { method: "PUT", accessToken, body })
}

export function updateBudgetSettings(accessToken: string, body: BudgetSetupInput) {
  return apiRequest<BudgetSetupState>("/budget/settings", { method: "PATCH", accessToken, body })
}

export function loadBudgetSummary(accessToken: string) {
  return apiRequest<BudgetSummary>("/budget/summary", { accessToken })
}

export function createBudgetTransaction(accessToken: string, body: BudgetTransactionInput) {
  return apiRequest("/budget/transactions", { method: "POST", accessToken, body })
}

export function createBudgetLedgerEntry(accessToken: string, body: BudgetLedgerEntryInput) {
  return apiRequest("/budget/ledger/entries", { method: "POST", accessToken, body })
}

export function loadBudgetTimeline(accessToken: string, query = "") {
  return apiRequest<BudgetTimelineItem[]>(`/budget/timeline${query ? `?${query}` : ""}`, { accessToken })
}

export function loadBudgetLedgerDetails(accessToken: string, id: string) {
  return apiRequest<{ entry: BudgetLedgerEntry; auditHistory: unknown }>(`/budget/ledger/entries/${id}`, { accessToken })
}

export function correctBudgetLedgerEntry(accessToken: string, id: string, body: unknown) {
  return apiRequest(`/budget/ledger/entries/${id}/corrections`, { method: "POST", accessToken, body })
}

export function voidBudgetLedgerEntry(accessToken: string, id: string, reason: string) {
  return apiRequest(`/budget/ledger/entries/${id}/voids`, { method: "POST", accessToken, body: { reason } })
}

export function refundBudgetLedgerEntry(accessToken: string, id: string, body: unknown) {
  return apiRequest(`/budget/ledger/entries/${id}/refunds`, { method: "POST", accessToken, body })
}

export function updateCurrentBudgetPeriod(accessToken: string, body: BudgetPeriodInput) {
  return apiRequest("/budget/periods/current", { method: "PATCH", accessToken, body })
}

export function createBudgetCategory(accessToken: string, body: BudgetCategoryInput) {
  return apiRequest("/budget/categories", { method: "POST", accessToken, body })
}

export function updateBudgetCategory(accessToken: string, id: string, body: BudgetCategoryInput) {
  return apiRequest(`/budget/categories/${id}`, { method: "PATCH", accessToken, body })
}

export function createPlannedExpense(accessToken: string, body: PlannedExpenseInput) {
  return apiRequest("/budget/planned-expenses", { method: "POST", accessToken, body })
}

export function updatePlannedExpense(accessToken: string, id: string, body: PlannedExpenseInput) {
  return apiRequest(`/budget/planned-expenses/${id}`, { method: "PATCH", accessToken, body })
}

export function applyCurrentPlannedExpenses(accessToken: string) {
  return apiRequest("/budget/planned-expenses/apply-current", { method: "POST", accessToken })
}

export function loadIncomePlans(accessToken: string, from: string, through: string) {
  return apiRequest<IncomePlanProjection>(`/budget/income-plans?from=${from}&through=${through}`, { accessToken })
}

export function createIncomePlan(accessToken: string, body: IncomePlanInput) {
  return apiRequest("/budget/income-plans", { method: "POST", accessToken, body })
}

export function editIncomePlan(accessToken: string, seriesId: string, body: unknown) {
  return apiRequest(`/budget/income-plans/${seriesId}`, { method: "PATCH", accessToken, body })
}

export function pauseIncomePlan(accessToken: string, seriesId: string, body: unknown) {
  return apiRequest(`/budget/income-plans/${seriesId}/pauses`, { method: "POST", accessToken, body })
}

export function stopIncomePlan(accessToken: string, seriesId: string, body: unknown) {
  return apiRequest(`/budget/income-plans/${seriesId}/stop`, { method: "POST", accessToken, body })
}

export function confirmIncomeOccurrence(accessToken: string, seriesId: string, scheduledOn: string, body: unknown) {
  return apiRequest(`/budget/income-plans/${seriesId}/occurrences/${scheduledOn}/confirm`, { method: "POST", accessToken, body })
}

export function autoPostIncome(accessToken: string, from: string, through: string) {
  return apiRequest(`/budget/income-plans/auto-post?from=${from}&through=${through}`, { method: "POST", accessToken })
}

export function saveDefaultIncomeVarianceRule(accessToken: string, body: unknown) {
  return apiRequest("/budget/income-variance-rules/default", { method: "PUT", accessToken, body })
}

export function saveIncomePlanVarianceRule(accessToken: string, seriesId: string, body: unknown) {
  return apiRequest(`/budget/income-plans/${seriesId}/variance-rule`, { method: "PUT", accessToken, body })
}

export function loadCommitments(accessToken: string, from: string, through: string) {
  return apiRequest<CommitmentProjection>(`/budget/commitments?from=${from}&through=${through}`, { accessToken })
}

export function createCommitment(accessToken: string, body: CommitmentInput) {
  return apiRequest("/budget/commitments", { method: "POST", accessToken, body })
}

export function editCommitment(accessToken: string, seriesId: string, body: unknown) {
  return apiRequest(`/budget/commitments/${seriesId}`, { method: "PATCH", accessToken, body })
}

export function pauseCommitment(accessToken: string, seriesId: string, body: unknown) {
  return apiRequest(`/budget/commitments/${seriesId}/pauses`, { method: "POST", accessToken, body })
}

export function stopCommitment(accessToken: string, seriesId: string, body: unknown) {
  return apiRequest(`/budget/commitments/${seriesId}/stop`, { method: "POST", accessToken, body })
}

export function confirmCommitmentOccurrence(accessToken: string, seriesId: string, scheduledOn: string, body: unknown) {
  return apiRequest(`/budget/commitments/${seriesId}/occurrences/${scheduledOn}/confirm`, { method: "POST", accessToken, body })
}

export function matchCommitmentOccurrence(accessToken: string, seriesId: string, scheduledOn: string, ledgerEntryId: string) {
  return apiRequest(`/budget/commitments/${seriesId}/occurrences/${scheduledOn}/match`, {
    method: "POST",
    accessToken,
    body: { ledgerEntryId },
  })
}

export function autoPostCommitments(accessToken: string, from: string, through: string) {
  return apiRequest(`/budget/commitments/auto-post?from=${from}&through=${through}`, { method: "POST", accessToken })
}
