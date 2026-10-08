import { IconHistory, IconPuzzle, IconUsers } from "@tabler/icons-react"

import type { TranslationKey } from "@/lib/i18n"

type AdminView = { key: string; route: string; labelKey: TranslationKey; icon: typeof IconUsers }

/** The admin pages in sidebar order. /admin/[view] serves each route; /admin/settings redirects to the first. */
export const adminViews = [
  { key: "users", route: "/admin/users", labelKey: "nav.adminUsers", icon: IconUsers },
  { key: "services", route: "/admin/services", labelKey: "nav.adminServices", icon: IconPuzzle },
  { key: "audit", route: "/admin/audit", labelKey: "nav.adminAudit", icon: IconHistory },
] as const satisfies readonly AdminView[]

export type AdminViewKey = (typeof adminViews)[number]["key"]

export function adminViewFromPath(pathname: string): AdminViewKey | undefined {
  return adminViews.find((view) => view.route === pathname)?.key
}
