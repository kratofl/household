"use client"

// Colour and icon of a category, as two groups of toggle buttons inside the category
// sheet. A picked option is a selected chip (brand-100, DESIGN.md Colour) with
// aria-pressed; colours show as a -500 dot beside their name, never as a tinted button,
// so the selection stays readable on every colour.

import { Button } from "@/components/ui/button"
import type { Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { categoryColors, categoryIcons } from "./category-visuals"
import { monthlyCopy } from "./copy"

const names = {
  de: { brand: "Orange", green: "Grün", blue: "Blau", purple: "Violett", yellow: "Gelb", tag: "Etikett", cart: "Einkauf", home: "Wohnen", car: "Auto", fuel: "Tanken", food: "Essen", shirt: "Kleidung", movie: "Freizeit", bottle: "Pflege", laptop: "Technik", gift: "Geschenk", heart: "Gesundheit", baby: "Kinder", paw: "Tiere", plane: "Reisen" },
  en: { brand: "Orange", green: "Green", blue: "Blue", purple: "Purple", yellow: "Yellow", tag: "Tag", cart: "Shopping", home: "Home", car: "Car", fuel: "Fuel", food: "Food", shirt: "Clothing", movie: "Leisure", bottle: "Care", laptop: "Technology", gift: "Gift", heart: "Health", baby: "Children", paw: "Pets", plane: "Travel" },
}

// Written out so Tailwind sees every class.
const dots: Record<(typeof categoryColors)[number], string> = {
  brand: "bg-brand-500", green: "bg-green-500", blue: "bg-blue-500", purple: "bg-purple-500", yellow: "bg-yellow-500",
}
const selected = "aria-pressed:bg-brand-100 aria-pressed:text-brand-700 dark:aria-pressed:bg-brand-500/20 dark:aria-pressed:text-brand-300"

export function CategoryAppearancePicker({ locale, color, icon, onColor, onIcon, allowAutomatic = true }: {
  allowAutomatic?: boolean; locale: Locale; color: string | null; icon: string; onColor: (value: string | null) => void; onIcon: (value: string) => void
}) {
  const copy = monthlyCopy(locale)
  return <div className="w-full space-y-4">
    <fieldset className="space-y-2">
      <legend className="mb-2 text-caption">{copy.color}</legend>
      <div className="flex flex-wrap gap-2">
        {allowAutomatic ? <Button type="button" variant="secondary" aria-pressed={color === null} onClick={() => onColor(null)} className={selected}>{copy.automaticColor}</Button> : null}
        {categoryColors.map(value => <Button type="button" key={value} variant="secondary" aria-pressed={color === value} onClick={() => onColor(value)} className={selected}>
          <span aria-hidden className={cn("size-2.5 rounded-full", dots[value])} />
          {names[locale][value]}
        </Button>)}
      </div>
    </fieldset>
    <fieldset className="space-y-2">
      <legend className="mb-2 text-caption">{copy.icon}</legend>
      <div className="flex flex-wrap gap-2">
        {Object.entries(categoryIcons).map(([value, Glyph]) => {
          const label = Object.entries(names[locale]).find(([key]) => key === value)?.[1]
          return <Button type="button" key={value} size="icon" variant="secondary" aria-label={label} title={label} aria-pressed={icon === value} onClick={() => onIcon(value)} className={selected}><Glyph /></Button>
        })}
      </div>
    </fieldset>
  </div>
}
