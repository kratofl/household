"use client"

// Navigation for the desktop shell: a fixed opaque sidebar under the topbar on
// desktop, a floating capsule tab bar on phones. Groups are plain labels with
// their destinations beneath, so the tree never changes shape just because the
// route changed. Collapsing the sidebar changes its width and nothing else:
// the same destinations stay in the same order, labelled by tooltip.

import Link from "next/link"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import {
  IconCalendar,
  IconChartBar,
  IconChefHat,
  IconClipboardList,
  IconHome,
  IconPigMoney,
  IconReceipt,
  IconRecycle,
  IconSettings,
  IconShield,
  IconShoppingCart,
  IconUserCircle,
  IconWallet,
} from "@tabler/icons-react"

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
 * Collapsed state for the sidebar, kept per device in localStorage. The shell
 * owns it because the toggle lives in the topbar, next to the brand.
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

/** The sidebar column. Children are the nav groups; the profile lives in the topbar. */
export function Sidebar({
  collapsed,
  children,
}: {
  collapsed: boolean
  children: ReactNode
}) {
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "hidden shrink-0 flex-col overflow-y-auto overflow-x-hidden bg-sidebar pt-3 pb-2.5 transition-[width,padding] duration-[var(--motion-panel)] ease-out motion-reduce:transition-none lg:flex",
        collapsed ? "w-16 px-2" : "w-60 px-2.5",
      )}
    >
      <nav className="min-h-0 flex-1">{children}</nav>
    </aside>
  )
}

/** The 11px label above a group of destinations. Hidden while collapsed. */
export function SidebarGroupLabel({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  if (collapsed) return <div className="h-3.5" aria-hidden />
  return <div className="px-3 pt-3.5 pb-1.5 text-[11px] leading-4 font-medium text-muted-foreground first:pt-0">{children}</div>
}

const rowClass =
  "flex w-full items-center gap-3 rounded-xl text-left text-sidebar-foreground transition-colors hover:bg-fill-3"

/** Nesting depth of a row. Sub rows are shorter and indented under their label. */
export type SidebarLevel = 0 | 1
const levelClass: Record<SidebarLevel, string> = {
  0: "min-h-[42px] px-3 text-sm",
  1: "min-h-9 pr-3 pl-6 text-[13px]",
}
const collapsedRowClass: Record<SidebarLevel, string> = {
  0: "h-[42px] justify-center px-0",
  1: "h-8 justify-center px-0",
}
const activeClass = "bg-sidebar-accent font-semibold text-sidebar-accent-foreground [&_svg]:text-primary"

/**
 * One active module in the sidebar. Modules with several pages become a labelled
 * group with their pages beneath; modules with a single page are a plain link.
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
          <SidebarLink
            key={key}
            collapsed={props.collapsed}
            href={view.route}
            level={1}
            active={inModule && current === key}
            icon={<ViewIcon />}
          >
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
  level = 0,
  children,
}: {
  collapsed: boolean
  href: string
  active: boolean
  icon?: ReactNode
  level?: SidebarLevel
  children: ReactNode
}) {
  const label = typeof children === "string" ? children : undefined
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        rowClass,
        collapsed ? collapsedRowClass[level] : levelClass[level],
        active && activeClass,
        "[&_svg]:size-[18px] [&_svg]:shrink-0",
      )}
    >
      {icon}
      <span className={cn("min-w-0 truncate", collapsed && "hidden")}>{children}</span>
    </Link>
  )
}

export function SidebarButton({
  collapsed = false,
  icon,
  onClick,
  children,
}: {
  collapsed?: boolean
  icon: ReactNode
  onClick: () => void
  children: ReactNode
}) {
  const label = typeof children === "string" ? children : undefined
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        rowClass,
        collapsed ? collapsedRowClass[0] : levelClass[0],
        "[&_svg]:size-[18px] [&_svg]:shrink-0",
      )}
    >
      {icon}
      <span className={cn("min-w-0 truncate", collapsed && "hidden")}>{children}</span>
    </button>
  )
}

/** Phone navigation: floating capsule with the top-level destinations. */
export function MobileTabBar(props: {
  locale: Locale
  pathname: string
  activeModules: AppModule[]
  isHome: boolean
  isAccount: boolean
  isSettings: boolean
  isAdminSettings: boolean
  isAdmin: boolean
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
    <nav
      aria-label={props.t("nav.main")}
      className="glass-strong fixed inset-x-4 bottom-4 z-20 mx-auto flex w-fit max-w-full items-center gap-0.5 rounded-full p-1 lg:hidden"
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex w-[68px] flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px]",
            item.active ? "bg-fill-2 text-primary" : "text-muted-foreground",
          )}
        >
          <item.icon className="size-5" strokeWidth={item.active ? 2.1 : 1.7} />
          <span className="max-w-full truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}

/** Budget sub-views on phones: a scrollable segmented control under the title. */
export function BudgetSubnav({ pathname, t }: { pathname: string; t: Translator }) {
  const current = budgetViewFromPath(pathname)
  return (
    <div className="seg flex w-fit max-w-full gap-0.5 overflow-x-auto lg:hidden">
      {budgetViewEntries.map(([key, view]) => (
        <Link
          key={key}
          href={view.route}
          aria-current={current === key ? "page" : undefined}
          className={cn("h-7 shrink-0 rounded-lg px-3 text-xs leading-7 whitespace-nowrap", current === key ? "seg-on" : "text-muted-foreground")}
        >
          {t(view.labelKey)}
        </Link>
      ))}
    </div>
  )
}
