"use client"

// Who is signed in, at the bottom of the sidebar: an avatar and name that open
// account, settings, the light/dark switch and sign out. Those are personal, so
// on desktop they live here and nowhere else; phones reach account and settings
// through the tab bar. Admin is a place in the app, so it stays a sidebar
// destination.

import Link from "next/link"
import { useTheme } from "next-themes"
import { IconLogout, IconMoon, IconSettings, IconSun, IconUserCircle } from "@tabler/icons-react"

import { sidebarRowClass } from "@/components/app/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Translator } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function ProfileMenu({
  name,
  collapsed,
  logout,
  t,
}: {
  name: string
  collapsed: boolean
  logout: () => void
  t: Translator
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const initials = name.slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={collapsed ? name : undefined}
        aria-label={collapsed ? name : undefined}
        className={cn(sidebarRowClass, "h-11 aria-expanded:bg-fill", collapsed && "justify-center px-0")}
      >
        <Avatar size="sm" className="size-7">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        {collapsed ? null : <span className="min-w-0 truncate">{name}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-[230px]">
        <DropdownMenuLabel>{name}</DropdownMenuLabel>
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
        <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
          {/* Both icons render; CSS picks one, so there is no hydration mismatch. */}
          <IconSun className="hidden dark:block" />
          <IconMoon className="dark:hidden" />
          {t("nav.toggleAppearance")}
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
