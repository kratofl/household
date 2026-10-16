"use client"

// Colour and icon of a category, picked the same way everywhere: colours as a row of
// swatches and icons as a grid, each a radio group (one Tab stop, arrow keys move and
// select). The new-category sheet shows them inline with an extra "automatic" swatch;
// in the categories table the tile itself is the button and opens them in a popover
// (CategoryLookButton).

import { IconChevronDown, IconSparkles } from "@tabler/icons-react"

import { IconTile } from "@/components/app/grouped"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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
// Sheets and popovers are both on surface-floating, so the ring offset matches either.
const swatchClass = "grid size-6 place-items-center rounded-full data-[state=checked]:ring-2 data-[state=checked]:ring-label data-[state=checked]:ring-offset-2 data-[state=checked]:ring-offset-surface-floating max-lg:size-11"
// The value of the automatic swatch; a category without a colour gets one from its name.
const AUTOMATIC = "automatic"

/**
 * The swatches and the icon grid. With `automatic` the colours start with an
 * "automatic" swatch, which stands for no colour (null).
 */
export function CategoryLookFields({ locale, color, icon, onColor, onIcon, automatic = false, className }: {
  locale: Locale; color: string | null; icon: string; onColor: (value: string | null) => void; onIcon: (value: string) => void
  /** Offer "assign automatically" as the first colour. */
  automatic?: boolean; className?: string
}) {
  const copy = monthlyCopy(locale)
  const iconName = (value: string) => Object.entries(names[locale]).find(([key]) => key === value)?.[1]
  return (
    <div className={cn("space-y-3", className)}>
      <fieldset>
        <legend className="mb-2 text-caption text-label-secondary">{copy.color}</legend>
        <RadioGroup aria-label={copy.color} value={color ?? AUTOMATIC} onValueChange={value => onColor(value === AUTOMATIC ? null : value)} className="flex flex-wrap gap-2.5">
          {automatic ? (
            <RadioGroupItem value={AUTOMATIC} aria-label={copy.automaticColor} title={copy.automaticColor} className={cn(swatchClass, "bg-fill-strong text-label-secondary")}>
              <IconSparkles className="size-3.5 [stroke-width:2]" />
            </RadioGroupItem>
          ) : null}
          {categoryColors.map(value => (
            <RadioGroupItem key={value} value={value} aria-label={names[locale][value]} title={names[locale][value]} className={cn(swatchClass, dots[value])} />
          ))}
        </RadioGroup>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-caption text-label-secondary">{copy.icon}</legend>
        <RadioGroup aria-label={copy.icon} value={icon} onValueChange={onIcon} className="grid grid-cols-5 gap-1">
          {Object.entries(categoryIcons).map(([value, Glyph]) => (
            <RadioGroupItem key={value} value={value} aria-label={iconName(value)} title={iconName(value)}
              className="grid h-8 place-items-center rounded-sm text-label-secondary hover:bg-fill data-[state=checked]:bg-fill-strong data-[state=checked]:text-label max-lg:h-11 max-lg:rounded-full">
              <Glyph className="size-4" />
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </fieldset>
    </div>
  )
}

/**
 * A category's tile as a button that opens CategoryLookFields in a popover. A small
 * chevron on the tile says it opens something.
 */
export function CategoryLookButton({ locale, name, color, icon, onColor, onIcon, disabled = false }: {
  locale: Locale; name: string; color: string; icon: string; onColor: (value: string) => void; onIcon: (value: string) => void; disabled?: boolean
}) {
  const copy = monthlyCopy(locale)
  const visual = categoryVisual(name, { color, icon })
  const label = `${copy.categoryLook}: ${name}`
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} aria-label={label} title={copy.categoryLook}
          className="relative shrink-0 rounded-sm disabled:opacity-50 data-[state=open]:ring-2 data-[state=open]:ring-brand-500">
          <IconTile icon={visual.icon} tone={visual.tone} size={28} />
          <span aria-hidden className="absolute -right-1 -bottom-1 grid size-3.5 place-items-center rounded-full bg-surface text-label-secondary">
            <IconChevronDown className="size-2.5" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent aria-label={label} className="w-[18rem]">
        <CategoryLookFields locale={locale} color={color} icon={icon} onColor={value => { if (value) onColor(value) }} onIcon={onIcon} />
      </PopoverContent>
    </Popover>
  )
}
