import { apiRequest } from "@/lib/api"
import type { ExpenseInput, MonthlyCategory, MonthlyExpense, MonthlyForecast, MonthlyState, SavePlan } from "./types"

const root = "/budget/monthly"
export function loadMonthlyBudget(accessToken: string, date?: string) {
  return apiRequest<MonthlyState>(`${root}/${date ? `?date=${date}` : ""}`, { accessToken })
}
export function saveMonthlyPlan(accessToken: string, body: SavePlan) {
  return apiRequest<MonthlyState>(`${root}/plan`, { accessToken, method: "PUT", body })
}
export function previewMonthlyPlan(accessToken: string, body: SavePlan) {
  return apiRequest<MonthlyForecast[]>(`${root}/plan/preview`, { accessToken, method: "POST", body })
}
export function cancelMonthlyPlan(accessToken: string, revision: number) {
  return apiRequest<MonthlyState>(`${root}/plan/pending?revision=${revision}`, { accessToken, method: "DELETE" })
}
export function saveMonthlyCategory(accessToken: string, name: string, existing?: { id: string; archived: boolean }) {
  return apiRequest<MonthlyCategory>(`${root}/categories${existing ? `/${existing.id}` : ""}`, {
    accessToken, method: existing ? "PATCH" : "POST", body: { name, archived: existing?.archived ?? false },
  })
}
export function addMonthlyExpense(accessToken: string, body: ExpenseInput) {
  return apiRequest<MonthlyExpense>(`${root}/expenses`, { accessToken, method: "POST", body })
}
export function refundMonthlyExpense(accessToken: string, id: string, body: { requestKey: string; occurredOn: string; amountCents: number }) {
  return apiRequest<MonthlyExpense>(`${root}/expenses/${id}/refunds`, { accessToken, method: "POST", body })
}
export function voidMonthlyExpense(accessToken: string, id: string, requestKey: string) {
  return apiRequest(`${root}/expenses/${id}/void`, { accessToken, method: "POST", body: { requestKey } })
}
