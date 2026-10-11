"use client"

import { Button } from "@/components/ui/button"
import type { Locale } from "@/lib/i18n"
import { toneTint } from "@/lib/tone"
import { cn } from "@/lib/utils"
import { categoryColors, categoryIcons } from "./category-visuals"
import { monthlyCopy } from "./copy"

const names = {
  de: { brand: "Orange", green: "Grün", blue: "Blau", purple: "Violett", yellow: "Gelb", tag: "Etikett", cart: "Einkauf", home: "Wohnen", car: "Auto", fuel: "Tanken", food: "Essen", shirt: "Kleidung", movie: "Freizeit", bottle: "Pflege", laptop: "Technik", gift: "Geschenk", heart: "Gesundheit", baby: "Kinder", paw: "Tiere", plane: "Reisen" },
  en: { brand: "Orange", green: "Green", blue: "Blue", purple: "Purple", yellow: "Yellow", tag: "Tag", cart: "Shopping", home: "Home", car: "Car", fuel: "Fuel", food: "Food", shirt: "Clothing", movie: "Leisure", bottle: "Care", laptop: "Technology", gift: "Gift", heart: "Health", baby: "Children", paw: "Pets", plane: "Travel" },
}

export function CategoryAppearancePicker({ locale, color, icon, onColor, onIcon, allowAutomatic = true }: {
  allowAutomatic?: boolean; locale: Locale; color: string | null; icon: string; onColor: (value: string | null) => void; onIcon: (value: string) => void
}) {
  const copy = monthlyCopy(locale)
  return <div className="w-full space-y-3">
    <fieldset className="space-y-2">
      <legend className="text-caption">{copy.color}</legend>
      <div className="flex flex-wrap gap-2">
        {allowAutomatic ? <Button type="button" variant="secondary" aria-pressed={color === null} onClick={() => onColor(null)}>{copy.automaticColor}</Button> : null}
        {categoryColors.map(value => <Button type="button" key={value} variant="outline" aria-pressed={color === value} onClick={() => onColor(value)} className={cn(toneTint[value], color === value && "ring-2 ring-focus-ring")}>
          {names[locale][value]}
        </Button>)}
      </div>
    </fieldset>
    <fieldset className="space-y-2">
      <legend className="text-caption">{copy.icon}</legend>
      <div className="flex flex-wrap gap-2">
        {Object.entries(categoryIcons).map(([value, Glyph]) => <Button type="button" key={value} size="icon" variant="secondary" aria-label={Object.entries(names[locale]).find(([key]) => key === value)?.[1]} title={Object.entries(names[locale]).find(([key]) => key === value)?.[1]} aria-pressed={icon === value} onClick={() => onIcon(value)} className={cn(icon === value && "ring-2 ring-focus-ring")}><Glyph /></Button>)}
      </div>
    </fieldset>
  </div>
}
