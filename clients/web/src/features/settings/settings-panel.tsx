"use client"

// Device-level preferences: light/dark mode and language. Both stay on this device.

import { FormRow, Group } from "@/components/app/grouped"
import { SettingsSurface } from "@/components/app/settings-surface"
import { AppearanceControl, LanguageControl } from "@/components/app/switchers"
import type { Locale, Translator } from "@/lib/i18n"

export function SettingsPanel(props: {
  locale: Locale
  setLocale: (value: Locale) => void
  t: Translator
}) {
  return (
    <SettingsSurface title={props.t("settings.title")} description={props.t("settings.description")}>
      <Group title={props.t("settings.appearanceTitle")} description={props.t("settings.themeHint")}>
        <FormRow label={props.t("settings.appearance")}>
          <AppearanceControl t={props.t} />
        </FormRow>
        <FormRow label={props.t("nav.language")}>
          <LanguageControl locale={props.locale} setLocale={props.setLocale} t={props.t} />
        </FormRow>
      </Group>
    </SettingsSurface>
  )
}
