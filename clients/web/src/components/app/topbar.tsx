"use client"

// The topbar runs edge to edge across the window: brand and sidebar toggle on
// the left, the current route next to them. It shares its background with the
// sidebar and draws no rule between them, so the chrome reads as one surface;
// the working area separates itself by colour and by its rounded corner.

import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from "@tabler/icons-react"
import type { ReactNode } from "react"

import { HouseholdLogo } from "@/components/app/household-logo"

export function Topbar({
  appName,
  collapsed,
  toggleSidebar,
  collapseLabel,
  expandLabel,
  routeIcon,
  routeLabel,
  routeParent,
}: {
  appName: string
  collapsed: boolean
  toggleSidebar: () => void
  collapseLabel: string
  expandLabel: string
  routeIcon?: ReactNode
  routeLabel: string
  routeParent?: string
}) {
  return (
    <header className="glass relative z-20 flex h-14 shrink-0 items-center gap-2.5 pr-4 pl-4 lg:pl-[18px]">
      <div className="flex shrink-0 items-center gap-2.5 lg:w-[196px]">
        <HouseholdLogo className="size-8" />
        <span className="truncate text-[19px] leading-none font-bold tracking-[-0.03em]">{appName}</span>
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
      <div className="flex min-w-0 items-center gap-2.5 text-[15px] [&_svg]:size-5 [&_svg]:shrink-0">
        {routeIcon}
        {routeParent ? <span className="hidden truncate text-muted-foreground sm:inline">{routeParent}</span> : null}
        <span className="truncate font-medium">{routeLabel}</span>
      </div>
    </header>
  )
}
