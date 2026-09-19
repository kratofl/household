export const dynamicParams = false

export function generateStaticParams() {
  return [{ view: [] }, { view: ["expenses"] }, { view: ["plan"] }, { view: ["savings"] }]
}

export default function MonthlyBudgetPreviewPage() {
  return null
}
