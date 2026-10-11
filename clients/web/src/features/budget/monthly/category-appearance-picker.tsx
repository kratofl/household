"use client"

// Colour and icon of a category. In the new-category sheet they are two groups of toggle
// buttons: a picked option is a selected chip (brand-100, DESIGN.md Colour) with
// aria-pressed; colours show as a -500 dot beside their name, never as a tinted button,
// so the selection stays readable on every colour. In the categories table the tile
// itself is the button and opens both as a compact popover (CategoryLookButton).

import { Popover } from "radix-ui"
import { IconChevronDown } from "@tabler/icons-react"

import { IconTile } from "@/components/app/grouped"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { categoryColors, categoryIcons, categoryVisual } from "./category-visuals"
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

export function CategoryAppearancePicker({ locale, color, icon, onColor, onIcon }: {
  locale: Locale; color: string | null; icon: string; onColor: (value: string | null) => void; onIcon: (value: string) => void
}) {
  const copy = monthlyCopy(locale)
  return <div className="w-full space-y-4">
    <fieldset className="space-y-2">
      <legend className="mb-2 text-caption">{copy.color}</legend>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" aria-pressed={color === null} onClick={() => onColor(null)} className={selected}>{copy.automaticColor}</Button>
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

/**
 * A category's tile as a button: it opens the colour (dots) and icon (grid) as a small
 * glass popover, each option a labelled toggle with aria-pressed. A small chevron on the
 * tile says it opens something.
 */
export function CategoryLookButton({ locale, name, color, icon, onColor, onIcon, disabled = false }: {
  locale: Locale; name: string; color: string; icon: string; onColor: (value: string) => void; onIcon: (value: string) => void; disabled?: boolean
}) {
  const copy = monthlyCopy(locale)
  const visual = categoryVisual(name, { color, icon })
  const label = `${copy.categoryLook}: ${name}`
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" disabled={disabled} aria-label={label} title={copy.categoryLook}
          className="relative shrink-0 rounded-sm disabled:opacity-50 data-[state=open]:ring-2 data-[state=open]:ring-brand-500">
          <IconTile icon={visual.icon} tone={visual.tone} size={28} />
          <span aria-hidden className="absolute -right-1 -bottom-1 grid size-3.5 place-items-center rounded-full bg-surface text-label-secondary">
            <IconChevronDown className="size-2.5" />
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content aria-label={label} align="start" sideOffset={6} className="glass z-[60] w-[17rem] max-w-[calc(100vw-2rem)] space-y-3 rounded-lg p-3">
          <fieldset>
            <legend className="mb-2 text-caption text-label-secondary">{copy.color}</legend>
            <div className="flex gap-2.5">
              {categoryColors.map(value => (
                <button key={value} type="button" aria-label={names[locale][value]} title={names[locale][value]} aria-pressed={color === value} onClick={() => onColor(value)}
                  className={cn("size-6 rounded-full aria-pressed:ring-2 aria-pressed:ring-label aria-pressed:ring-offset-2 aria-pressed:ring-offset-surface-floating", dots[value])} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-caption text-label-secondary">{copy.icon}</legend>
            <div className="grid grid-cols-5 gap-1">
              {Object.entries(categoryIcons).map(([value, Glyph]) => {
                const glyphLabel = Object.entries(names[locale]).find(([key]) => key === value)?.[1]
                return (
                  <button key={value} type="button" aria-label={glyphLabel} title={glyphLabel} aria-pressed={icon === value} onClick={() => onIcon(value)}
                    className="grid h-8 place-items-center rounded-sm text-label-secondary hover:bg-fill aria-pressed:bg-fill-strong aria-pressed:text-label">
                    <Glyph className="size-4" />
                  </button>
                )
              })}
            </div>
          </fieldset>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
