"use client"

// Who is signed in, at the right end of the topbar: an avatar that opens account,
// settings and sign out. Those three are personal, so on desktop they live here
// and nowhere else; phones reach them through the tab bar, so the avatar is
// desktop only. Admin is a place in the app, not a personal setting, so it stays
// a normal sidebar destination.

import Link from "next/link"
import { IconLogout, IconSettings, IconUserCircle } from "@tabler/icons-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Translator } from "@/lib/i18n"

export function ProfileMenu({ name, logout, t }: { name: string; logout: () => void; t: Translator }) {
  const initials = name.slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={name}
        aria-label={name}
        className="hidden size-8 shrink-0 place-items-center rounded-full bg-fill text-[11px] font-semibold outline-none transition-colors hover:bg-fill-2 focus-visible:ring-4 focus-visible:ring-ring/60 aria-expanded:bg-fill-2 lg:grid"
      >
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[210px]">
        <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
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
