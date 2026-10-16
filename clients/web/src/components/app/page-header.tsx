import type { ReactNode } from "react"

import { ToolbarContent, type ToolbarPrimaryAction } from "@/components/app/toolbar"

// How every page starts. Everything except the subtitle goes into the toolbar:
// the title, an optional scope control right after it (e.g. a PeriodStepper) with
// its caption (a footnote, hidden on phones), the icon actions in a ToolbarGroup,
// and the page's one primary action last, after the search. The optional subtitle
// stays at the top of the content as a footnote line (settings pages describe
// themselves with it).
export function PageHeader({
  title,
  subtitle,
  scope,
  caption,
  actions,
  primaryAction,
}: {
  title: string
  subtitle?: ReactNode
  scope?: ReactNode
  caption?: string
  actions?: ReactNode
  primaryAction?: ToolbarPrimaryAction
}) {
  return (
    <>
      <ToolbarContent title={title} scope={scope} caption={caption} actions={actions} primaryAction={primaryAction} />
      {subtitle ? <div className="text-footnote text-label-secondary">{subtitle}</div> : null}
    </>
  )
}
