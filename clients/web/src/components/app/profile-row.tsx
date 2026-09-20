"use client"

// The only thing at the bottom of the sidebar: who is signed in, and a menu with
// account, settings and sign out. Those three are personal, so they live here and
// nowhere else in the desktop navigation. Admin is a place in the app, not a
// personal setting, so it stays a normal sidebar destination.

import Link from "next/link"
import { IconChevronDown, IconLogout, IconSettings, IconUserCircle } from "@tabler/icons-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Translator } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function ProfileRow({
  collapsed,
  name,
  subtitle,
  logout,
  t,
}: {
  collapsed: boolean
  name: string
  subtitle: string
  logout: () => void
  t: Translator
}) {
  const initials = name.slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={collapsed ? name : undefined}
        aria-label={collapsed ? name : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl text-left transition-colors outline-none hover:bg-fill-3 focus-visible:ring-4 focus-visible:ring-ring/60 aria-expanded:bg-fill-3",
          collapsed ? "h-[46px] justify-center px-0" : "h-[46px] px-1.5",
        )}
      >
        <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-fill text-[12px] font-semibold">
          {initials}
        </span>
        <span className={cn("flex min-w-0 flex-col items-start gap-0.5", collapsed && "hidden")}>
          <span className="max-w-full truncate text-sm">{name}</span>
          <span className="max-w-full truncate text-[11px] text-muted-foreground">{subtitle}</span>
        </span>
        <IconChevronDown className={cn("ml-auto size-4 shrink-0 text-muted-foreground", collapsed && "hidden")} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-[210px]">
        <DropdownMenuItem asChild>
          <Link href="/account">
            <IconUserCircle />
            {t("nav.account")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <IconSettings />
            {t("nav.settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout}>
          <IconLogout />
          {t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
