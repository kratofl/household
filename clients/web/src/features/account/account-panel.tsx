"use client"

// Account: who is signed in, their password, and the linked OIDC provider account.
// Appearance and language live on the Settings page.

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/app/field"
import { Block, FormRow, Group } from "@/components/app/grouped"
import { SettingsSurface } from "@/components/app/settings-surface"
import type { Translator } from "@/lib/i18n"
import type { CurrentUser } from "@/lib/session"

export function AccountPanel(props: {
  currentUser: CurrentUser
  currentPassword: string
  newPassword: string
  setCurrentPassword: (value: string) => void
  setNewPassword: (value: string) => void
  changePassword: () => Promise<void>
  /** Configured provider, or null when OIDC login is off. */
  oidcName: string | null
  linkOidc: () => Promise<void>
  unlinkOidc: () => Promise<void>
  t: Translator
}) {
  // A linked account stays visible after OIDC is switched off, so it can still be unlinked.
  const providerName = props.oidcName ?? (props.currentUser.oidcLinked ? "SSO" : null)
  return (
    <SettingsSurface title={props.t("account.title")} description={props.t("account.description")}>
      <Group title={props.t("account.profileTitle")} description={props.t("account.profileDescription")}>
        <FormRow label={props.t("auth.name")}><span className="truncate text-label-secondary">{props.currentUser.name}</span></FormRow>
        <FormRow label={props.t("auth.email")}><span className="truncate text-label-secondary">{props.currentUser.email}</span></FormRow>
        <FormRow label={props.t("account.role")}>
          <span className="truncate text-label-secondary">{props.t(props.currentUser.role === "admin" ? "users.roleAdmin" : "users.roleUser")}</span>
        </FormRow>
        <FormRow label={props.t("account.status")}><span className="truncate text-label-secondary">{props.t(`users.status.${props.currentUser.status}`)}</span></FormRow>
      </Group>

      <Group title={props.t("account.passwordTitle")} description={props.t("account.passwordDescription")}>
        <Block>
          <form
            className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault()
              void props.changePassword()
            }}
          >
            <Field label={props.t("account.currentPassword")}>
              <Input
                type="password"
                autoComplete="current-password"
                value={props.currentPassword}
                onChange={(event) => props.setCurrentPassword(event.target.value)}
              />
            </Field>
            <Field label={props.t("account.newPassword")}>
              <Input
                type="password"
                autoComplete="new-password"
                value={props.newPassword}
                onChange={(event) => props.setNewPassword(event.target.value)}
              />
            </Field>
            <Button type="submit">{props.t("account.changePassword")}</Button>
          </form>
        </Block>
      </Group>

      {providerName ? (
        <Group
          title={props.t("account.oidcTitle", { name: providerName })}
          description={props.t("account.oidcDescription", { name: providerName })}
        >
          <FormRow
            label={props.currentUser.oidcLinked ? props.t("account.oidcLinked") : props.t("account.oidcNotLinked")}
          >
            {props.currentUser.oidcLinked ? (
              <Button variant="outline" onClick={() => void props.unlinkOidc()}>
                {props.t("account.oidcUnlink")}
              </Button>
            ) : props.oidcName ? (
              <Button onClick={() => void props.linkOidc()}>{props.t("account.oidcLink")}</Button>
            ) : null}
          </FormRow>
        </Group>
      ) : null}
    </SettingsSurface>
  )
}
