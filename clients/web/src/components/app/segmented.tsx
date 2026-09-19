"use client"

// The iOS/macOS segmented control: a pill of mutually exclusive options.
// Used for appearance, language, and any small either/or choice in a toolbar.

import { cn } from "@/lib/utils"

export function Segmented<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
  className,
}: {
  ariaLabel: string
  value: string
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("seg flex text-xs", className)}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn("h-6 whitespace-nowrap px-2.5 leading-6", selected ? "seg-on" : "text-muted-foreground")}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
