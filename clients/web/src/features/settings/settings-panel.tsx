"use client"

// Device-level preferences: light/dark mode and language. Both stay on this device.

import { SettingsRow, SettingsSection, SettingsSurface } from "@/components/app/settings-surface"
import { AppearanceControl, LanguageControl } from "@/components/app/switchers"
import type { Locale, Translator } from "@/lib/i18n"

export function SettingsPanel(props: {
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
        <SettingsRow title={props.t("nav.language")}>
          <LanguageControl locale={props.locale} setLocale={props.setLocale} t={props.t} />
        </SettingsRow>
      </SettingsSection>
    </SettingsSurface>
  )
}
