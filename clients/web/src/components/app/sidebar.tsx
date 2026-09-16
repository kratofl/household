"use client"

// Navigation in the macOS Tahoe idiom: a floating translucent sidebar panel on
// desktop, a floating capsule tab bar on phones. Icons stay monochrome; the
// accent only marks the active tab on mobile. Modules with several views are
// collapsible groups that stay open until the user folds them, so the tree
// never changes shape just because the route changed.

import Link from "next/link"
import { useState, type ReactNode } from "react"
import {
  IconCalendar,
  IconChefHat,
  IconChevronRight,
  IconClipboardList,
  IconHome,
  IconRecycle,
  IconSettings,
  IconShield,
  IconShoppingCart,
  IconUserCircle,
  IconWallet,
} from "@tabler/icons-react"

import type { Locale, Translator } from "@/lib/i18n"
import {
  budgetViewFromPath,
  budgetViews,
  budgetViewsFor,
  moduleHref,
  moduleName,
  visibleBudgetViews,
  type AppModule,
} from "@/lib/modules"
import { cn } from "@/lib/utils"

export const moduleIcons = {
  budget: IconWallet,
  shopping: IconShoppingCart,
  recipes: IconChefHat,
  meal_plan: IconClipboardList,
  calendar: IconCalendar,
  waste_schedule: IconRecycle,
} as const

/** The floating sidebar panel. Children are the nav groups; footer sits at the bottom. */
export function Sidebar({ brand, children, footer }: { brand: ReactNode; children: ReactNode; footer: ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 p-2 lg:block">
      <div className="glass flex h-full flex-col rounded-xl px-2 py-3 shadow-[0_0_0_0.5px_var(--hairline)]">
        <div className="mb-3 px-2">{brand}</div>
        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto">{children}</nav>
        <div className="mt-3 space-y-px">{footer}</div>
      </div>
    </aside>
  )
}

const rowClass =
  "flex h-7 w-full items-center gap-2 rounded-md px-2.5 text-[13px] text-sidebar-foreground transition-colors"

/** Nesting depth of a row; each level indents so children read as part of their group. */
export type SidebarLevel = 0 | 1 | 2
const levelClass: Record<SidebarLevel, string> = { 0: "", 1: "pl-8", 2: "pl-12" }

/**
 * A collapsible group. Open by default; the header only folds and unfolds, it
 * does not navigate. While folded, a group that contains the current page is
 * highlighted so the user still sees where they are.
 */
export function SidebarGroup({
  icon,
  label,
  level = 0,
  defaultOpen = true,
  containsActive = false,
  children,
}: {
  icon?: ReactNode
  label: string
  level?: SidebarLevel
  defaultOpen?: boolean
  containsActive?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          rowClass,
          levelClass[level],
          "text-left",
          !open && containsActive ? "bg-sidebar-accent font-medium" : "hover:bg-fill-3",
        )}
      >
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <IconChevronRight
          className={cn("size-3.5 shrink-0 text-muted-foreground/60 transition-transform", open && "rotate-90")}
          strokeWidth={2}
        />
      </button>
      {open ? <ul className="mt-px space-y-px">{children}</ul> : null}
    </div>
  )
}

/**
 * One active module in the sidebar. Budget is a group with the monthly views
 * and the old Budget folded into one nested row; other modules are single pages.
 */
export function SidebarModuleNav(props: { locale: Locale; module: AppModule; pathname: string; t: Translator }) {
  const Icon = moduleIcons[props.module.key as keyof typeof moduleIcons] ?? IconSettings
  const icon = <Icon className="size-4" strokeWidth={1.8} />
  const href = moduleHref(props.module)
  const inModule = props.pathname === href || props.pathname.startsWith(`${href}/`)
  const label = moduleName(props.module, props.locale)

  if (props.module.key !== "budget") {
    return (
      <SidebarLink href={href} active={inModule} icon={icon}>
        {label}
      </SidebarLink>
    )
  }

  const current = budgetViewFromPath(props.pathname)
  const inLegacy = inModule && budgetViews[current].family === "legacy"
  return (
    <SidebarGroup icon={icon} label={label} containsActive={inModule}>
      {budgetViewsFor("monthly").map(([key, view]) => (
        <li key={key}>
          <SidebarLink href={view.route} level={1} active={inModule && current === key}>
            {props.t(view.labelKey)}
          </SidebarLink>
        </li>
      ))}
      <li>
        <SidebarGroup label={props.t("budget.nav.legacy")} level={1} defaultOpen={inLegacy} containsActive={inLegacy}>
          {budgetViewsFor("legacy").map(([key, view]) => (
            <li key={key}>
              <SidebarLink href={view.route} level={2} active={inModule && current === key}>
                {props.t(view.labelKey)}
              </SidebarLink>
            </li>
          ))}
        </SidebarGroup>
      </li>
    </SidebarGroup>
  )
}

export function SidebarLink({
  href,
  active,
  icon,
  level = 0,
  children,
}: {
  href: string
  active: boolean
  icon?: ReactNode
  level?: SidebarLevel
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(rowClass, levelClass[level], active ? "bg-sidebar-accent font-medium" : "hover:bg-fill-3")}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  )
}

export function SidebarButton({ icon, onClick, children }: { icon: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn(rowClass, "text-left hover:bg-fill-3")}>
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </button>
  )
}

/** Phone navigation: floating glass capsule with the top-level destinations. */
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
      className="glass fixed inset-x-4 bottom-4 z-20 mx-auto flex w-fit max-w-full items-center gap-0.5 rounded-full p-1 shadow-[0_0_0_0.5px_var(--hairline),0_8px_24px_-8px_rgb(0_0_0/0.25)] lg:hidden"
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
      {visibleBudgetViews(pathname).map(([key, view]) => (
        <Link
          key={key}
          href={view.route}
          aria-current={current === key ? "page" : undefined}
          className={cn("h-6 shrink-0 rounded-[6px] px-2.5 text-xs leading-6 whitespace-nowrap", current === key ? "seg-on" : "text-muted-foreground")}
        >
          {t(view.labelKey)}
        </Link>
      ))}
    </div>
  )
}
