"use client"

// Navigation. On desktop a 256px sidebar runs edge to edge down the left of the
// window on sidebar-bg with a separator on its right: brand and collapse button
// in the top row, destinations under caption section headers, the profile at
// the bottom. Icons are always brand-500 and text always label; the active row
// sits on fill-strong in semibold. Collapsing narrows it to an icon rail and
// changes nothing else. Phones get a glass tab bar that is navigation only, with
// the search as a separate tab beside it.

import Link from "next/link"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import {
  IconCalendar,
  IconChartBar,
  IconCheck,
  IconChefHat,
  IconChevronDown,
  IconClipboardList,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Locale, Translator } from "@/lib/i18n"
import { budgetViewEntries, budgetViewFromPath, moduleHref, moduleName, type AppModule, type BudgetViewKey } from "@/lib/modules"
import { cn } from "@/lib/utils"

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
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className={cn("flex h-16 shrink-0 items-center gap-2.5", collapsed ? "justify-center" : "pr-3 pl-[22px]")}>
        {collapsed ? null : (
          <>
            <HouseholdLogo className="size-7" />
            <span className="min-w-0 truncate text-[15px] font-semibold">{appName}</span>
          </>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          title={toggleLabel}
          className={cn("grid size-8 shrink-0 place-items-center rounded-sm text-label-secondary transition-colors hover:bg-fill hover:text-label", !collapsed && "ml-auto")}
        >
          <IconLayoutSidebar className="size-[18px]" />
        </button>
      </div>
      <nav aria-label={navLabel} className="min-h-0 flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-3 pb-3">
        {children}
      </nav>
      <div className="shrink-0 border-t border-separator px-3 py-2">{footer}</div>
    </aside>
  )
}

/** A caption section header above a group of destinations. A gap while collapsed. */
export function SidebarGroupLabel({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  if (collapsed) return <div className="h-4" aria-hidden />
  return <div className="truncate px-2.5 pt-3.5 pb-1.5 text-caption text-label-secondary first:pt-1">{children}</div>
}

/** The row shape shared by links and the profile button. */
export const sidebarRowClass =
  "flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-callout font-medium text-label transition-colors hover:bg-fill [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:text-brand-500"

/**
 * One active module in the sidebar. Modules with several pages become a section
 * with their pages beneath; modules with a single page are a plain link.
 */
export function SidebarModuleNav(props: {
  collapsed: boolean
  locale: Locale
  module: AppModule
  pathname: string
  t: Translator
}) {
  const Icon = moduleIcons[props.module.key as keyof typeof moduleIcons] ?? IconSettings
  const href = moduleHref(props.module)
  const inModule = props.pathname === href || props.pathname.startsWith(`${href}/`)
  const label = moduleName(props.module, props.locale)

  if (props.module.key !== "budget") {
    return (
      <SidebarLink collapsed={props.collapsed} href={href} active={inModule} icon={<Icon />}>
        {label}
      </SidebarLink>
    )
  }

  const current = budgetViewFromPath(props.pathname)
  return (
    <>
      <SidebarGroupLabel collapsed={props.collapsed}>{label}</SidebarGroupLabel>
      {budgetViewEntries.map(([key, view]) => {
        const ViewIcon = budgetViewIcons[key]
        return (
          <SidebarLink key={key} collapsed={props.collapsed} href={view.route} active={inModule && current === key} icon={<ViewIcon />}>
            {props.t(view.labelKey)}
          </SidebarLink>
        )
      })}
    </>
  )
}

/** Icons for the Budget sub-views, so the collapsed rail can still tell them apart. */
const budgetViewIcons: Record<BudgetViewKey, typeof IconWallet> = {
  overview: IconWallet,
  expenses: IconReceipt,
  plan: IconChartBar,
  savings: IconPigMoney,
}

export function SidebarLink({
  collapsed,
  href,
  active,
  icon,
  children,
}: {
  collapsed: boolean
  href: string
  active: boolean
  icon?: ReactNode
  children: ReactNode
}) {
  const label = typeof children === "string" ? children : undefined
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(sidebarRowClass, collapsed && "justify-center px-0", active && "bg-fill-strong font-semibold hover:bg-fill-strong")}
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
  isAdminSettings: boolean
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
      ? [{ key: "admin", href: "/admin/settings", label: props.t("nav.admin"), icon: IconShield, active: props.isAdminSettings }]
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

/**
 * Budget's pages on phones, where there is no sidebar: a chevron beside the toolbar
 * title that opens them as a menu.
 */
export function BudgetViewMenu({ pathname, t }: { pathname: string; t: Translator }) {
  const current = budgetViewFromPath(pathname)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("nav.budgetViews")}
        title={t("nav.budgetViews")}
        className="grid size-11 shrink-0 place-items-center rounded-full text-label hover:bg-toolbar-fill lg:hidden"
      >
        <IconChevronDown className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {budgetViewEntries.map(([key, view]) => {
          const ViewIcon = budgetViewIcons[key]
          return (
            <DropdownMenuItem key={key} asChild>
              <Link href={view.route} aria-current={current === key ? "page" : undefined}>
                <ViewIcon />
                <span className="flex-1">{t(view.labelKey)}</span>
                {current === key ? <IconCheck /> : null}
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
