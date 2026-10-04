"use client"

// The segmented control from DESIGN.md: 2–5 closely related options, text only,
// equal-width segments of at least 88px with 2px between them. The selected
// segment itself carries segment-selected, shadow-segment and semibold; there is
// no separate sliding thumb.
// Shape follows its context. In content it is a flat desktop control: a
// fill-strong track with radius-md and radius-sm segments inside (DESIGN.md,
// SegmentedControl). Only in the toolbar is it a pill on the toolbar
// fill, and below lg it is a pill with 40px segments on a 48px track like every
// mobile control. Not for navigation.
// Keyboard follows the radio group pattern: one Tab stop, arrow keys move and select.

import { useRef, type KeyboardEvent } from "react"

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
  const group = useRef<HTMLDivElement>(null)
  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = (Math.max(0, index) + step + options.length) % options.length
    onChange(options[next].value)
    group.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus()
  }
  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        "grid w-fit auto-cols-fr grid-flow-col gap-0.5 rounded-md bg-fill-strong p-1 in-[.toolbar-band]:rounded-full in-[.toolbar-band]:bg-toolbar-fill max-lg:w-full max-lg:rounded-full",
        className,
      )}
    >
      {options.map((option, position) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (index < 0 && position === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-8 min-w-[88px] rounded-sm px-3 in-[.toolbar-band]:rounded-full max-lg:rounded-full text-footnote font-medium whitespace-nowrap text-label transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none max-lg:h-10 max-lg:min-w-0",
              selected && "bg-segment-selected font-semibold shadow-(--shadow-segment)",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
