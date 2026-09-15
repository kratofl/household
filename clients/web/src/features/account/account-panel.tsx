"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  SettingsBlock,
  SettingsField,
  SettingsRow,
  SettingsSection,
  SettingsSurface,
} from "@/components/app/settings-surface"
import { AppearanceControl, LanguageControl } from "@/components/app/switchers"
import { ThemePicker } from "@/components/app/theme-picker"
import type { Locale, Translator } from "@/lib/i18n"
import type { CurrentUser } from "@/lib/session"
import type { ThemeId } from "@/lib/theme"

export function AccountPanel(props: {
  currentUser: CurrentUser
  currentPassword: string
  newPassword: string
  setCurrentPassword: (value: string) => void
  setNewPassword: (value: string) => void
  changePassword: () => Promise<void>
  saveTheme: (theme: ThemeId) => Promise<void>
  locale: Locale
  setLocale: (value: Locale) => void
  t: Translator
}) {
  return (
    <SettingsSurface title={props.t("account.title")} description={props.t("account.description")}>
      <SettingsSection title={props.t("account.preferencesTitle")} description={props.t("account.themeHint")}>
        <SettingsRow title={props.t("account.appearance")}>
          <AppearanceControl t={props.t} />
        </SettingsRow>
        <SettingsBlock>
          <p className="mb-3">{props.t("account.theme")}</p>
          <ThemePicker locale={props.locale} onChange={(theme) => void props.saveTheme(theme)} />
        </SettingsBlock>
        <SettingsRow title={props.t("nav.language")}>
          <LanguageControl locale={props.locale} setLocale={props.setLocale} t={props.t} />
        </SettingsRow>
      </SettingsSection>

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
