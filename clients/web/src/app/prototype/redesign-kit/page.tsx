// PROTOTYPE ONLY. Renders every shared redesign building block (toolbar, period
// stepper, hero metric, metric strip, charts) with sample props for visual checks
// in light, dark and at phone width. Not reachable in production builds; delete
// before merging the redesign.

import { notFound } from "next/navigation"

import { RedesignKit } from "./redesign-kit"

export default function RedesignKitPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <RedesignKit />
}
