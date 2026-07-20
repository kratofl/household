import { apiRequest } from "@/lib/api"

import type {
  BudgetCategoryInput,
  BudgetPeriodInput,
  BudgetSummary,
  BudgetSetupInput,
  BudgetSetupState,
  BudgetTransactionInput,
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
