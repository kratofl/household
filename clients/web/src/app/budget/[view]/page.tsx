const budgetViews = [
  "transactions",
  "planning",
  "saving-investing",
  "wishlist",
  "categories",
  "reports",
  "settings",
]

export const dynamicParams = false

export function generateStaticParams() {
  return budgetViews.map((view) => ({ view }))
}

export default function BudgetViewPage() {
  return null
}
