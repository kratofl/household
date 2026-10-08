import { adminViews } from "@/features/admin/views"

// Admin pages live under /admin so the sidebar can show them as one group.
export const dynamicParams = false

export function generateStaticParams() {
  return adminViews.map((view) => ({ view: view.key }))
}

export default function AdminViewPage() {
  return null
}
