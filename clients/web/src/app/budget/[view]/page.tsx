// The Budget module's pages. /budget itself is served by the [section] route.
const budgetViews = ["expenses", "plan", "fixed", "monthly", "yearly", "categories", "merchants", "savings"]

export const dynamicParams = false

export function generateStaticParams() {
  return budgetViews.map((view) => ({ view }))
}

export default function BudgetViewPage() {
  return null
}
