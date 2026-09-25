"use client"

// The macOS segmented control: mutually exclusive options on a recessed track.
// Used for appearance, language, and any small either/or choice in a toolbar.
// Segments share one width, so the selected thumb is a single element that
// slides by whole segments when the choice changes (.seg-slide in globals.css).

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
  const index = options.findIndex((option) => option.value === value)
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("seg relative grid w-fit rounded-full text-xs", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {index >= 0 ? (
        <span
          aria-hidden
          className="seg-on seg-slide absolute inset-y-0.5 left-0.5 rounded-full"
          style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative h-6 whitespace-nowrap rounded-full px-2.5 leading-6 transition-colors",
              selected ? "font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
