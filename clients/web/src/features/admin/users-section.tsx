"use client"

import type { Translator } from "@/lib/i18n"
import type { CurrentUser } from "@/lib/session"
import { StatusDot } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SettingsRow, SettingsSection } from "@/components/app/settings-surface"

import type { UserChange } from "@/features/admin/types"

const statusDot = { pending: "yellow", active: "green", blocked: "red" } as const

/**
 * Every account of the household. Admins approve registrations, block and restore accounts, and
 * grant or take the admin role. Their own account has no actions, so nobody locks themselves out.
 */
export function UsersSection(props: {
  currentUser: CurrentUser
  users: CurrentUser[]
  updateUser: (user: CurrentUser, change: UserChange) => Promise<void>
  t: Translator
}) {
  return (
    <SettingsSection title={props.t("users.title")} description={props.t("users.description")}>
      {props.users.map((user) => {
        const own = user.id === props.currentUser.id
        return (
          <SettingsRow
            key={user.id}
            title={own ? props.t("users.you", { name: user.name }) : user.name}
            description={`${user.email} · ${props.t(user.role === "admin" ? "users.roleAdmin" : "users.roleUser")}`}
          >
            <StatusDot status={statusDot[user.status]} className="text-footnote">
              {props.t(`users.status.${user.status}`)}
            </StatusDot>
            {own ? null : user.status === "pending" ? (
              <>
                <Button size="sm" onClick={() => props.updateUser(user, { status: "active" })}>
                  {props.t("users.activate")}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => props.updateUser(user, { status: "blocked" })}>
                  {props.t("users.reject")}
                </Button>
              </>
            ) : user.status === "blocked" ? (
              <Button size="sm" variant="secondary" onClick={() => props.updateUser(user, { status: "active" })}>
                {props.t("users.unblock")}
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => props.updateUser(user, { role: user.role === "admin" ? "user" : "admin" })}
                >
                  {props.t(user.role === "admin" ? "users.removeAdmin" : "users.makeAdmin")}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => props.updateUser(user, { status: "blocked" })}>
                  {props.t("users.block")}
                </Button>
              </>
            )}
          </SettingsRow>
        )
      })}
    </SettingsSection>
  )
}
