"use client"

import { useTheme } from "next-themes"

import type { Locale, Translator } from "@/lib/i18n"
import { isLocale } from "@/lib/i18n"
import { Segmented } from "@/components/app/segmented"

/** Hell / Dunkel / Automatisch as a segmented control. */
export function AppearanceControl({ t }: { t: Translator }) {
  const { setTheme, theme } = useTheme()
  const active = theme ?? "system"
  const options: { value: "light" | "dark" | "system"; label: string }[] = [
    { value: "light", label: t("theme.light") },
    { value: "dark", label: t("theme.dark") },
    { value: "system", label: t("theme.system") },
  ]
  return (
    <Segmented ariaLabel={t("nav.theme")} value={active} options={options} onChange={setTheme} />
  )
}

export function LanguageControl({
  locale,
  setLocale,
  t,
}: {
  locale: Locale
  setLocale: (value: Locale) => void
  t: Translator
}) {
  return (
    <Segmented
      ariaLabel={t("nav.language")}
      value={locale}
      options={[
        { value: "de", label: t("language.de") },
        { value: "en", label: t("language.en") },
      ]}
      onChange={(value) => {
        if (isLocale(value)) setLocale(value)
      }}
    />
  )
}
