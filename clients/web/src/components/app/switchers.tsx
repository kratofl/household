"use client"

import { useTheme } from "next-themes"
import { IconMoon, IconSun } from "@tabler/icons-react"

import type { Locale, Translator } from "@/lib/i18n"
import { isLocale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

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

/** One-tap light/dark toggle for the toolbar. Both icons render; CSS picks one (no hydration mismatch). */
export function AppearanceToggle({ t }: { t: Translator }) {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <button
      type="button"
      aria-label={t("nav.theme")}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-3 hover:text-foreground"
    >
      <IconSun className="hidden size-4 dark:block" />
      <IconMoon className="size-4 dark:hidden" />
    </button>
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

function Segmented<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string
  value: string
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="seg flex text-xs">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn("h-6 px-2.5 leading-6", selected ? "seg-on" : "text-muted-foreground")}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
