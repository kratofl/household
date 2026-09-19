"use client"

// Account: who is signed in and their password. Appearance and language live
// on the Settings page.

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SettingsBlock, SettingsField, SettingsSection, SettingsSurface } from "@/components/app/settings-surface"
import type { Translator } from "@/lib/i18n"
import type { CurrentUser } from "@/lib/session"

export function AccountPanel(props: {
  currentUser: CurrentUser
  currentPassword: string
  newPassword: string
  setCurrentPassword: (value: string) => void
  setNewPassword: (value: string) => void
  changePassword: () => Promise<void>
  t: Translator
}) {
  return (
    <SettingsSurface title={props.t("account.title")} description={props.t("account.description")}>
      <SettingsSection title={props.t("account.profileTitle")} description={props.t("account.profileDescription")}>
        <SettingsField label={props.t("auth.name")} value={props.currentUser.name} />
        <SettingsField label={props.t("auth.email")} value={props.currentUser.email} />
        <SettingsField label={props.t("account.role")} value={props.currentUser.role} />
        <SettingsField label={props.t("account.status")} value={props.currentUser.status} />
      </SettingsSection>

      <SettingsSection title={props.t("account.passwordTitle")} description={props.t("account.passwordDescription")}>
        <SettingsBlock>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault()
              void props.changePassword()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="account-current-password">{props.t("account.currentPassword")}</Label>
              <Input
                id="account-current-password"
                type="password"
                autoComplete="current-password"
                value={props.currentPassword}
                onChange={(event) => props.setCurrentPassword(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-new-password">{props.t("account.newPassword")}</Label>
              <Input
                id="account-new-password"
                type="password"
                autoComplete="new-password"
                value={props.newPassword}
                onChange={(event) => props.setNewPassword(event.target.value)}
              />
            </div>
            <Button type="submit">{props.t("account.changePassword")}</Button>
          </form>
        </SettingsBlock>
      </SettingsSection>
    </SettingsSurface>
  )
}
