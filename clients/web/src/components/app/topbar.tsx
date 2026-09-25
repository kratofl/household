"use client"

// The topbar runs edge to edge across the window in three parts: brand and
// sidebar toggle on the left, the search centred on the window, and personal
// controls on the right. Pages carry their own title, so the bar does not repeat
// it. It shares its background with the sidebar and draws no rule between them,
// so the chrome reads as one surface; the working area separates itself by
// colour and by its rounded corner.

import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from "@tabler/icons-react"
import type { ReactNode } from "react"

import { HouseholdLogo } from "@/components/app/household-logo"

export function Topbar({
  appName,
  collapsed,
  toggleSidebar,
  collapseLabel,
  expandLabel,
  search,
  actions,
}: {
  appName: string
  collapsed: boolean
  toggleSidebar: () => void
  collapseLabel: string
  expandLabel: string
  search: ReactNode
  actions: ReactNode
}) {
  return (
    <header className="glass relative z-20 grid h-14 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 pr-4 pl-4 md:grid-cols-[1fr_minmax(0,28rem)_1fr] lg:pl-[18px]">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5 lg:w-[196px]">
          <HouseholdLogo className="size-8 shrink-0" />
          <span className="hidden truncate text-[19px] leading-none font-bold tracking-[-0.03em] sm:inline">{appName}</span>
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? expandLabel : collapseLabel}
          aria-expanded={!collapsed}
          title={collapsed ? expandLabel : collapseLabel}
          className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-fill-3 hover:text-foreground lg:inline-flex"
        >
          {collapsed ? <IconLayoutSidebarLeftExpand className="size-5" /> : <IconLayoutSidebarLeftCollapse className="size-5" />}
        </button>
      </div>
      {search}
      <div className="flex items-center justify-end gap-1.5">{actions}</div>
    </header>
  )
}
