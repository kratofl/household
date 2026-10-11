"use client"

// Navigation. On desktop a 224px sidebar runs edge to edge down the left of the
// window on sidebar-bg with a separator on its right: brand and collapse button
// in the top row, then Dashboard and single-page modules without a header,
// then each multi-page module and Admin under a caption section header (Budget's
// pages in clusters split by a small gap), the profile at the bottom. Icons are label-secondary and text label; the active row sits on
// fill-strong in semibold with its icon in brand-500. Collapsing narrows it to an icon rail and
// changes nothing else. Phones get a glass tab bar that is navigation only, with
// the search as a separate tab beside it.

import Link from "next/link"
import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react"
import {
  IconCalendar,
  IconBuildingStore,
  IconTag,
  IconRepeat,
  IconChartBar,
  IconCheck,
  IconChefHat,
  IconChevronDown,
  IconClipboardList,
  IconFileInvoice,
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
import {
  budgetViewClusters,
  budgetViewEntries,
  budgetViewFromPath,
  budgetViews,
  moduleHref,
  moduleName,
  type AppModule,
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

/** A caption section header above a group of destinations. A gap while collapsed. */
export function SidebarGroupLabel({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  if (collapsed) return <div className="h-4" aria-hidden />
  return <div className="truncate px-2 pt-3 pb-1 text-caption text-label-secondary first:pt-1">{children}</div>
}

/** The row shape shared by links and the profile button. */
export const sidebarRowClass =
  "flex h-7 w-full items-center gap-2 rounded-sm px-2 text-left text-callout font-medium text-label transition-colors hover:bg-fill [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-label-secondary"

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

  if (!hasSidebarSection(props.module)) {
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
      {budgetViewClusters.map((cluster, index) => (
        <Fragment key={cluster[0]}>
          {index > 0 ? <div className="h-2" aria-hidden /> : null}
          {cluster.map((key) => {
            const view = budgetViews[key]
            const ViewIcon = budgetViewIcons[key]
            return (
              <SidebarLink key={key} collapsed={props.collapsed} href={view.route} active={inModule && current === key} icon={<ViewIcon />}>
                {props.t(view.labelKey)}
              </SidebarLink>
            )
          })}
        </Fragment>
      ))}
    </>
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
      className={cn(sidebarRowClass, collapsed && "justify-center px-0", active && "bg-fill-strong font-semibold hover:bg-fill-strong [&_svg]:text-brand-500")}
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
export type ViewMenuItem = { key: string; href: string; label: string; icon: typeof IconWallet; current: boolean }

/**
 * A section's pages on phones, where there is no sidebar: a chevron beside the toolbar
 * title that opens them as a menu.
 */
export function ViewMenu({ label, items }: { label: string; items: ViewMenuItem[] }) {
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
        {items.map((item) => (
          <DropdownMenuItem key={item.key} asChild>
            <Link href={item.href} aria-current={item.current ? "page" : undefined}>
              <item.icon />
              <span className="flex-1">{item.label}</span>
              {item.current ? <IconCheck /> : null}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Budget's pages for the phone view menu. */
export function budgetViewMenuItems(pathname: string, t: Translator): ViewMenuItem[] {
  const current = budgetViewFromPath(pathname)
  return budgetViewEntries.map(([key, view]) => ({
    key,
    href: view.route,
    label: t(view.labelKey),
    icon: budgetViewIcons[key],
    current: current === key,
  }))
}
