"use client"

// Navigation in the macOS Tahoe idiom: a floating translucent sidebar panel on
// desktop, a floating capsule tab bar on phones. Icons stay monochrome; the
// accent only marks the active tab on mobile.

import Link from "next/link"
import type { ReactNode } from "react"
import {
  IconCalendar,
  IconChefHat,
  IconClipboardList,
  IconHome,
  IconRecycle,
  IconSettings,
  IconShoppingCart,
  IconUserCircle,
  IconWallet,
} from "@tabler/icons-react"

import type { Locale, Translator } from "@/lib/i18n"
import { budgetViewFromPath, visibleBudgetViews, moduleHref, moduleName, type AppModule } from "@/lib/modules"
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

export function SidebarSectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1 px-3 text-[11px] font-semibold text-muted-foreground">{children}</p>
}

export function SidebarModuleItem(props: {
  locale: Locale
  module: AppModule
  pathname: string
  t: Translator
}) {
  const Icon = moduleIcons[props.module.key as keyof typeof moduleIcons] ?? IconSettings
  const href = moduleHref(props.module)
  const isActive = props.pathname === href || props.pathname.startsWith(`${href}/`)
  const children =
    props.module.key === "budget" && isActive
      ? visibleBudgetViews(props.pathname).map(([key, view]) => ({
          key,
          href: view.route,
          label: props.t(view.labelKey),
          active: budgetViewFromPath(props.pathname) === key,
        }))
      : []

  return (
    <div>
      <SidebarLink href={href} active={isActive && children.length === 0} icon={<Icon className="size-4" strokeWidth={1.8} />}>
        {moduleName(props.module, props.locale)}
      </SidebarLink>
      {children.length > 0 ? (
        <ul className="mt-px space-y-px">
          {children.map((child) => (
            <li key={child.key}>
              <SidebarLink href={child.href} active={child.active} nested>
                {child.label}
              </SidebarLink>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function SidebarLink({
  href,
  active,
  icon,
  nested,
  children,
}: {
  href: string
  active: boolean
  icon?: ReactNode
  nested?: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-7 items-center gap-2 rounded-md px-2.5 text-[13px] text-sidebar-foreground transition-colors",
        nested && "pl-8",
        active ? "bg-sidebar-accent font-medium" : "hover:bg-fill-3",
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  )
}

export function SidebarButton({ icon, onClick, children }: { icon: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-sidebar-foreground transition-colors hover:bg-fill-3"
    >
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
    ...(props.isAdmin
      ? [{ key: "settings", href: "/settings", label: props.t("nav.adminSettings"), icon: IconSettings, active: props.isSettings }]
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
