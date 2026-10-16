"use client"

// Navigation. On desktop a 224px sidebar runs edge to edge down the left of the
// window on sidebar-bg with a separator on its right: brand and collapse button
// in the top row, then Dashboard and single-page modules without a header,
// then each multi-page module and Admin as a section under a caption header that
// folds the section away. Inside Budget, related pages hang under a parent row
// (icon, label, chevron) that folds them too. Folded state is kept per device; the
// group holding the current page always opens. Icons are label-secondary and text
// label; the active row sits on fill-strong in semibold with its icon in brand-500.
// Collapsing narrows it to an icon rail: headers become gaps and a parent row
// opens its pages as a menu. Phones get a glass tab bar that is navigation only,
// with the search as a separate tab beside it.

import Link from "next/link"
import { useCallback, useEffect, useId, useState, type ReactNode } from "react"
import {
  IconCalendar,
  IconCalendarDollar,
  IconBuildingStore,
  IconTag,
  IconRepeat,
  IconChartBar,
  IconCheck,
  IconChefHat,
  IconChevronDown,
  IconClipboardList,
  IconFileInvoice,
  IconFolders,
  IconHome,
  IconLayoutSidebar,
  IconPigMoney,
  IconReceipt,
  IconRecycle,
  IconSettings,
  IconShield,
  IconShoppingCart,
  IconUserCircle,
  IconWallet,
} from "@tabler/icons-react"

import { HouseholdLogo } from "@/components/app/household-logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Locale, Translator } from "@/lib/i18n"
import {
  budgetNav,
  budgetViewFromPath,
  budgetViews,
  moduleHref,
  moduleName,
  type AppModule,
  type BudgetNavGroup,
  type BudgetViewKey,
} from "@/lib/modules"
import { cn } from "@/lib/utils"
import { adminViews } from "@/features/admin/views"

export const moduleIcons = {
  budget: IconWallet,
  shopping: IconShoppingCart,
  recipes: IconChefHat,
  meal_plan: IconClipboardList,
  calendar: IconCalendar,
  waste_schedule: IconRecycle,
} as const

const SIDEBAR_COLLAPSED_KEY = "household.sidebar.collapsed"

/**
 * Collapsed state for the sidebar, kept per device in localStorage.
 * Reading happens after mount so the server and client markup agree.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true")
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      return next
    })
  }, [])

  return { collapsed, toggle }
}

const SIDEBAR_FOLDED_KEY = "household.sidebar.folded"

/** Folded sections and groups, keyed by id ("budget", "budget.planning", "admin"). */
export type SidebarFolds = { isOpen: (id: string) => boolean; toggle: (id: string) => void }

/**
 * Which sidebar sections and groups are folded, kept per device in localStorage.
 * `currentIds` are the ones holding the current page: they open on load and on
 * every navigation, so the active row is never hidden. Folding one stays possible.
 */
export function useSidebarFolds(currentIds: string[]): SidebarFolds {
  const current = currentIds.join(" ")
  const [folded, setFolded] = useState<string[]>([])
  const [shownFor, setShownFor] = useState(current)
  if (shownFor !== current) {
    setShownFor(current)
    setFolded((ids) => ids.filter((id) => !currentIds.includes(id)))
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored: unknown = JSON.parse(window.localStorage.getItem(SIDEBAR_FOLDED_KEY) ?? "[]")
      const ids = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : []
      setFolded(ids)
      // Forces the check above on the next render, which reopens the current page's groups.
      setShownFor("")
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const toggle = useCallback((id: string) => {
    setFolded((ids) => {
      const next = ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]
      window.localStorage.setItem(SIDEBAR_FOLDED_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { isOpen: (id) => !folded.includes(id), toggle }
}

/**
 * The body of a section or group that folds: rows animate their height once
 * (grid-template-rows) and become inert while folded, so Tab skips them.
 */
function Fold({ id, open, children }: { id: string; open: boolean; children: ReactNode }) {
  return (
    <div
      id={id}
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="min-h-0 space-y-px overflow-hidden">{children}</div>
    </div>
  )
}

/** The sidebar column: top row, the nav groups as children, then the footer (the profile). */
export function Sidebar({
  appName,
  collapsed,
  toggle,
  collapseLabel,
  expandLabel,
  navLabel,
  footer,
  children,
}: {
  appName: string
  collapsed: boolean
  toggle: () => void
  collapseLabel: string
  expandLabel: string
  navLabel: string
  footer: ReactNode
  children: ReactNode
}) {
  const toggleLabel = collapsed ? expandLabel : collapseLabel
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "hidden h-full shrink-0 flex-col border-r border-separator bg-sidebar transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div className={cn("flex h-12 shrink-0 items-center gap-2", collapsed ? "justify-center" : "pr-2 pl-4")}>
        {collapsed ? null : (
          <>
            <HouseholdLogo className="size-6" />
            <span className="min-w-0 truncate text-[14px] font-semibold">{appName}</span>
          </>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          title={toggleLabel}
          className={cn("grid size-7 shrink-0 place-items-center rounded-sm text-label-secondary transition-colors hover:bg-fill hover:text-label", !collapsed && "ml-auto")}
        >
          <IconLayoutSidebar className="size-4" />
        </button>
      </div>
      <nav aria-label={navLabel} className="min-h-0 flex-1 space-y-px overflow-x-hidden overflow-y-auto px-2 pb-2">
        {children}
      </nav>
      <div className="shrink-0 border-t border-separator p-2">{footer}</div>
    </aside>
  )
}

/**
 * A headed section (a multi-page module, Admin). The caption header is a button that
 * folds the section; its chevron shows on hover and focus, and stays while folded.
 * On the collapsed rail the header is a gap and the section always shows.
 */
export function SidebarSection({ collapsed, open, onToggle, label, children }: {
  collapsed: boolean; open: boolean; onToggle: () => void; label: string; children: ReactNode
}) {
  const bodyId = useId()
  if (collapsed) return <><div className="h-4" aria-hidden />{children}</>
  return (
    <div className="group/section">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-1 rounded-sm px-2 pt-3 pb-1 text-left text-caption text-label-secondary hover:text-label"
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <IconChevronDown
          aria-hidden
          className={cn(
            "size-3 shrink-0 opacity-0 transition-[transform,opacity] duration-150 group-hover/section:opacity-100 group-focus-within/section:opacity-100 motion-reduce:transition-none",
            !open && "-rotate-90 opacity-100",
          )}
        />
      </button>
      <Fold id={bodyId} open={open}>{children}</Fold>
    </div>
  )
}

/** The row shape shared by links and the profile button. */
export const sidebarRowClass =
  "flex h-7 w-full items-center gap-2 rounded-sm px-2 text-left text-callout font-medium text-label transition-colors hover:bg-fill [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-label-secondary"

const activeRowClass = "bg-fill-strong font-semibold hover:bg-fill-strong [&_svg]:text-brand-500"

/** One page inside a group: its route, label and icon, and whether it is the current page. */
type GroupPage = { key: string; href: string; label: string; icon: typeof IconWallet; current: boolean }

/**
 * Related pages under a parent row (icon, label, chevron) that folds them. The pages
 * hang indented beneath it along a separator line. On the collapsed rail the parent
 * row is an icon that opens the pages as a menu to its right, and it carries the
 * active look while one of them is the current page.
 */
export function SidebarGroup({ collapsed, open, onToggle, label, icon: Icon, pages }: {
  collapsed: boolean; open: boolean; onToggle: () => void; label: string; icon: typeof IconWallet; pages: GroupPage[]
}) {
  const bodyId = useId()
  const holdsCurrent = pages.some((page) => page.current)
  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={label} title={label} className={cn(sidebarRowClass, "justify-center px-0", holdsCurrent && activeRowClass)}>
          <Icon />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {pages.map((page) => (
            <DropdownMenuItem key={page.key} asChild>
              <Link href={page.href} aria-current={page.current ? "page" : undefined}>
                <page.icon />
                <span className="flex-1">{page.label}</span>
                {page.current ? <IconCheck /> : null}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={bodyId} className={sidebarRowClass}>
        <Icon />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <IconChevronDown
          aria-hidden
          className={cn("size-3! transition-transform duration-150 motion-reduce:transition-none", !open && "-rotate-90")}
        />
      </button>
      <Fold id={bodyId} open={open}>
        <div className="relative space-y-px pt-px before:absolute before:inset-y-0.5 before:left-4 before:w-px before:bg-separator">
          {pages.map((page) => (
            <SidebarLink key={page.key} collapsed={false} href={page.href} active={page.current} icon={<page.icon />} indent>
              {page.label}
            </SidebarLink>
          ))}
        </div>
      </Fold>
    </div>
  )
}

/** Sidebar ids of the section and group that hold the current page, for `useSidebarFolds`. */
export function currentSidebarIds(pathname: string, inBudget: boolean, inAdmin: boolean): string[] {
  if (inAdmin) return ["admin"]
  if (!inBudget) return []
  const current = budgetViewFromPath(pathname)
  const group = budgetNav.groups.find((item) => item.views.some((view) => view === current))
  return group ? ["budget", `budget.${group.key}`] : ["budget"]
}

/**
 * One active module in the sidebar. Modules with several pages become a section
 * with their pages beneath; modules with a single page are a plain link.
 */
export function SidebarModuleNav(props: {
  collapsed: boolean
  folds: SidebarFolds
  locale: Locale
  module: AppModule
  pathname: string
  t: Translator
}) {
  const Icon = moduleIcons[props.module.key as keyof typeof moduleIcons] ?? IconSettings
  const href = moduleHref(props.module)
  const inModule = props.pathname === href || props.pathname.startsWith(`${href}/`)
  const label = moduleName(props.module, props.locale)

  if (!hasSidebarSection(props.module)) {
    return (
      <SidebarLink collapsed={props.collapsed} href={href} active={inModule} icon={<Icon />}>
        {label}
      </SidebarLink>
    )
  }

  const current = budgetViewFromPath(props.pathname)
  const page = (key: BudgetViewKey): GroupPage => ({
    key, href: budgetViews[key].route, label: props.t(budgetViews[key].labelKey), icon: budgetViewIcons[key], current: inModule && current === key,
  })
  return (
    <SidebarSection collapsed={props.collapsed} open={props.folds.isOpen("budget")} onToggle={() => props.folds.toggle("budget")} label={label}>
      {budgetNav.main.map((key) => {
        const view = page(key)
        return (
          <SidebarLink key={key} collapsed={props.collapsed} href={view.href} active={view.current} icon={<view.icon />}>
            {view.label}
          </SidebarLink>
        )
      })}
      {budgetNav.groups.map((group) => (
        <SidebarGroup
          key={group.key}
          collapsed={props.collapsed}
          open={props.folds.isOpen(`budget.${group.key}`)}
          onToggle={() => props.folds.toggle(`budget.${group.key}`)}
          label={props.t(group.labelKey)}
          icon={budgetGroupIcons[group.key]}
          pages={group.views.map(page)}
        />
      ))}
    </SidebarSection>
  )
}

/** Modules with several pages get their own headed section; the rest are plain links under Dashboard. */
export function hasSidebarSection(module: AppModule) {
  return module.key === "budget"
}

/** Icons for the Budget sub-views, so the collapsed rail can still tell them apart. */
const budgetViewIcons: Record<BudgetViewKey, typeof IconWallet> = {
  overview: IconWallet,
  expenses: IconReceipt,
  plan: IconChartBar,
  fixed: IconFileInvoice,
  monthly: IconRepeat,
  yearly: IconCalendar,
  categories: IconTag,
  merchants: IconBuildingStore,
  savings: IconPigMoney,
}

const budgetGroupIcons: Record<BudgetNavGroup["key"], typeof IconWallet> = {
  planning: IconCalendarDollar,
  manage: IconFolders,
}

export function SidebarLink({
  collapsed,
  href,
  active,
  icon,
  indent = false,
  children,
}: {
  collapsed: boolean
  href: string
  active: boolean
  icon?: ReactNode
  /** A page inside a group: indented past the group's line. */
  indent?: boolean
  children: ReactNode
}) {
  const label = typeof children === "string" ? children : undefined
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed || indent ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(sidebarRowClass, collapsed && "justify-center px-0", indent && "pl-8", active && activeRowClass)}
    >
      {icon}
      <span className={cn("min-w-0 truncate", collapsed && "hidden")}>{children}</span>
    </Link>
  )
}

/** Phone navigation: a floating glass tab bar with the top-level destinations, and the search tab beside it. */
export function MobileTabBar(props: {
  locale: Locale
  pathname: string
  activeModules: AppModule[]
  isHome: boolean
  isAccount: boolean
  isSettings: boolean
  inAdmin: boolean
  isAdmin: boolean
  search: ReactNode
  t: Translator
}) {
  const items = [
    { key: "home", href: "/", label: props.t("dashboard.title"), icon: IconHome, active: props.isHome },
    ...props.activeModules.map((module) => ({
      key: module.key,
      href: moduleHref(module),
      label: moduleName(module, props.locale),
      icon: moduleIcons[module.key as keyof typeof moduleIcons] ?? IconSettings,
      active: props.pathname === moduleHref(module) || props.pathname.startsWith(`${moduleHref(module)}/`),
    })),
    { key: "account", href: "/account", label: props.t("nav.account"), icon: IconUserCircle, active: props.isAccount },
    { key: "settings", href: "/settings", label: props.t("nav.settings"), icon: IconSettings, active: props.isSettings },
    ...(props.isAdmin
      ? [{ key: "admin", href: adminViews[0].route, label: props.t("nav.admin"), icon: IconShield, active: props.inAdmin }]
      : []),
  ]

  return (
    <div className="fixed inset-x-4 bottom-4 z-20 flex items-center justify-center gap-2 lg:hidden">
      <nav aria-label={props.t("nav.main")} className="glass flex max-w-[400px] min-w-0 flex-1 items-center gap-0.5 rounded-full p-1">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "flex h-[50px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] leading-3",
              item.active ? "font-semibold text-label" : "font-medium text-label-secondary",
            )}
          >
            <item.icon className={cn("size-6", item.active && "text-brand-500")} />
            <span className="max-w-full truncate px-1">{item.label}</span>
          </Link>
        ))}
      </nav>
      {props.search}
    </div>
  )
}

/** One page of a section (Budget, Admin) for the phone view menu. */
export type ViewMenuItem = GroupPage
/** A run of pages in the phone view menu, under a label when it is a group. */
export type ViewMenuSection = { key: string; label: string | null; items: ViewMenuItem[] }

/**
 * A section's pages on phones, where there is no sidebar: a chevron beside the toolbar
 * title that opens them as a menu, grouped like the sidebar.
 */
export function ViewMenu({ label, sections }: { label: string; sections: ViewMenuSection[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        title={label}
        className="grid size-11 shrink-0 place-items-center rounded-full text-label hover:bg-toolbar-fill lg:hidden"
      >
        <IconChevronDown className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {sections.map((section, index) => (
          <DropdownMenuGroup key={section.key}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            {section.label ? <DropdownMenuLabel>{section.label}</DropdownMenuLabel> : null}
            {section.items.map((item) => (
              <DropdownMenuItem key={item.key} asChild>
                <Link href={item.href} aria-current={item.current ? "page" : undefined}>
                  <item.icon />
                  <span className="flex-1">{item.label}</span>
                  {item.current ? <IconCheck /> : null}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Budget's pages for the phone view menu, grouped like the sidebar. */
export function budgetViewMenuSections(pathname: string, t: Translator): ViewMenuSection[] {
  const current = budgetViewFromPath(pathname)
  const item = (key: BudgetViewKey): ViewMenuItem => ({
    key, href: budgetViews[key].route, label: t(budgetViews[key].labelKey), icon: budgetViewIcons[key], current: current === key,
  })
  return [
    { key: "main", label: null, items: budgetNav.main.map(item) },
    ...budgetNav.groups.map((group) => ({ key: group.key, label: t(group.labelKey), items: group.views.map(item) })),
  ]
}
