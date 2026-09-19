"use client"

// Accent theme picker: one circle per theme, the selected one with a ring and
// a check mark, like the accent colour picker in macOS System Settings.

import { useSyncExternalStore } from "react"
import { IconCheck } from "@tabler/icons-react"

import type { Locale } from "@/lib/i18n"
import { applyTheme, defaultThemeId, isThemeId, themes, type ThemeId } from "@/lib/theme"
import { cn } from "@/lib/utils"

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
  return () => observer.disconnect()
}

function readTheme(): ThemeId {
  const value = document.documentElement.dataset.theme
  return isThemeId(value) ? value : defaultThemeId
}

/** The theme currently applied to <html>; defaultThemeId during SSR. */
export function useThemeId() {
  return useSyncExternalStore(subscribe, readTheme, () => defaultThemeId)
}

export function ThemePicker({ locale, onChange }: { locale: Locale; onChange?: (id: ThemeId) => void }) {
  const current = useThemeId()
  return (
    <ul className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-7">
      {themes.map((theme) => {
        const selected = theme.id === current
        return (
          <li key={theme.id} data-theme={theme.id} className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              aria-label={theme.name[locale]}
              aria-pressed={selected}
              onClick={() => {
                applyTheme(theme.id)
                onChange?.(theme.id)
              }}
              className={cn(
                "flex size-8 items-center justify-center rounded-full bg-primary shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.12)] transition-transform hover:scale-105",
                selected && "ring-2 ring-primary ring-offset-2 ring-offset-card",
              )}
            >
              {selected ? <IconCheck className="size-4 text-primary-foreground" strokeWidth={2.5} /> : null}
            </button>
            <span className={cn("text-[11px]", selected ? "font-medium" : "text-muted-foreground")}>{theme.name[locale]}</span>
          </li>
        )
      })}
    </ul>
  )
}
