"use client"

// Device-level preferences: light/dark mode, accent theme and language. The
// accent theme is also saved to the profile so other devices pick it up.

import { SettingsBlock, SettingsRow, SettingsSection, SettingsSurface } from "@/components/app/settings-surface"
import { AppearanceControl, LanguageControl } from "@/components/app/switchers"
import { ThemePicker } from "@/components/app/theme-picker"
import type { Locale, Translator } from "@/lib/i18n"
import type { ThemeId } from "@/lib/theme"

export function SettingsPanel(props: {
  saveTheme: (theme: ThemeId) => Promise<void>
  locale: Locale
  setLocale: (value: Locale) => void
  t: Translator
}) {
  return (
    <SettingsSurface title={props.t("settings.title")} description={props.t("settings.description")}>
      <SettingsSection title={props.t("settings.appearanceTitle")} description={props.t("settings.themeHint")}>
        <SettingsRow title={props.t("settings.appearance")}>
          <AppearanceControl t={props.t} />
        </SettingsRow>
        <SettingsBlock>
          <p className="mb-3">{props.t("settings.theme")}</p>
          <ThemePicker locale={props.locale} onChange={(theme) => void props.saveTheme(theme)} />
        </SettingsBlock>
        <SettingsRow title={props.t("nav.language")}>
          <LanguageControl locale={props.locale} setLocale={props.setLocale} t={props.t} />
        </SettingsRow>
      </SettingsSection>
    </SettingsSurface>
  )
}
