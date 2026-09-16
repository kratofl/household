// Admin pages live under /admin so the sidebar can show them as one group.
const adminViews = ["settings"]

export const dynamicParams = false

export function generateStaticParams() {
  return adminViews.map((view) => ({ view }))
}

export default function AdminViewPage() {
  return null
}
