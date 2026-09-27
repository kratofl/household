"use client"

// The tab view: switches which pane is shown below it (e.g. the login and the
// registration form). A pill track with one selected thumb that slides by whole
// tabs when the choice changes; the transition is finite. For picking a value
// that changes nothing but itself, use Segmented instead.
// Keyboard follows the radio group pattern: one Tab stop, arrow keys move and select.

import { useRef, type KeyboardEvent } from "react"

import { cn } from "@/lib/utils"

export function TabView<T extends string>({
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
      className={cn("relative grid w-fit rounded-full bg-fill-strong p-1 max-lg:w-full", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {index >= 0 ? (
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 rounded-full bg-segment-selected shadow-(--shadow-segment) transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
        />
      ) : null}
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
              "relative h-8 min-w-[84px] rounded-full px-3 text-footnote font-medium whitespace-nowrap text-label max-lg:h-10 max-lg:min-w-0",
              selected && "font-semibold",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
