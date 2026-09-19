"use client"

// Device-level preferences: light/dark mode, accent theme, language, and the
// look-and-feel knobs from lib/appearance.ts. The accent theme is also saved to
// the profile so other devices pick it up; everything else stays on this device.

import { useEffect, useMemo, useState } from "react"

import { SettingsBlock, SettingsRow, SettingsSection, SettingsSlider, SettingsSurface } from "@/components/app/settings-surface"
import { AppearanceControl, LanguageControl } from "@/components/app/switchers"
import { ThemePicker } from "@/components/app/theme-picker"
import {
  appearanceLimits,
  applyAppearance,
  defaultAppearance,
  readAppearance,
  type Appearance,
} from "@/lib/appearance"
import type { Locale, Translator } from "@/lib/i18n"
import type { ThemeId } from "@/lib/theme"

export function SettingsPanel(props: {
  saveTheme: (theme: ThemeId) => Promise<void>
  locale: Locale
  setLocale: (value: Locale) => void
  t: Translator
}) {
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance)

  // Read after mount: the stored values are already on <html> from the init
  // script, this only catches the sliders up with them.
  useEffect(() => {
    const timer = window.setTimeout(() => setAppearance(readAppearance()), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const percent = useMemo(
    () => new Intl.NumberFormat(props.locale === "de" ? "de-DE" : "en-GB", { style: "percent" }),
    [props.locale],
  )

  const update = (patch: Partial<Appearance>) => {
    const next = { ...appearance, ...patch }
    setAppearance(next)
    applyAppearance(next)
  }

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

      <SettingsSection title={props.t("settings.interfaceTitle")}>
        <SettingsSlider
          title={props.t("settings.glassOpacity")}
          description={props.t("settings.glassOpacityHint")}
          value={appearance.glassOpacity}
          display={percent.format(appearance.glassOpacity)}
          resetLabel={props.t("settings.reset")}
          onChange={(glassOpacity) => update({ glassOpacity })}
          onReset={
            appearance.glassOpacity === defaultAppearance.glassOpacity
              ? undefined
              : () => update({ glassOpacity: defaultAppearance.glassOpacity })
          }
          {...appearanceLimits.glassOpacity}
        />
        <SettingsSlider
          title={props.t("settings.contrast")}
          description={props.t("settings.contrastHint")}
          value={appearance.contrast}
          display={percent.format(appearance.contrast)}
          resetLabel={props.t("settings.reset")}
          onChange={(contrast) => update({ contrast })}
          onReset={
            appearance.contrast === defaultAppearance.contrast
              ? undefined
              : () => update({ contrast: defaultAppearance.contrast })
          }
          {...appearanceLimits.contrast}
        />
      </SettingsSection>

      <SettingsSection title={props.t("settings.motionTitle")}>
        <SettingsSlider
          title={props.t("settings.panelMotion")}
          description={props.t("settings.panelMotionHint")}
          value={appearance.panelMotionMs}
          display={`${appearance.panelMotionMs} ms`}
          resetLabel={props.t("settings.reset")}
          onChange={(panelMotionMs) => update({ panelMotionMs })}
          onReset={
            appearance.panelMotionMs === defaultAppearance.panelMotionMs
              ? undefined
              : () => update({ panelMotionMs: defaultAppearance.panelMotionMs })
          }
          {...appearanceLimits.panelMotionMs}
        />
      </SettingsSection>
    </SettingsSurface>
  )
}
