import type { ReactNode } from "react"

import { ToolbarContent } from "@/components/app/toolbar"

// How every page starts: its title and actions go into the toolbar, and the
// optional subtitle stays at the top of the content as a footnote line.
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <>
      <ToolbarContent title={title} actions={actions} />
      {subtitle ? <div className="text-footnote text-label-secondary">{subtitle}</div> : null}
    </>
  )
}
