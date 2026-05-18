const budgetViews = ["transactions", "planning", "categories", "settings"]

export const dynamicParams = false

export function generateStaticParams() {
  return budgetViews.map((view) => ({ view }))
}

export default function BudgetViewPage() {
  return null
}
