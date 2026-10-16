"use client"

// The segmented control from DESIGN.md: 2–5 closely related options, text only,
// equal-width 24px segments of at least 72px with 2px between them. The selected
// segment itself carries segment-selected, shadow-segment and semibold; there is
// no separate sliding thumb.
// Shape follows its context. In content it is a flat desktop control: a
// fill-strong track with radius-md and radius-sm segments inside (DESIGN.md,
// SegmentedControl). Only in the toolbar is it a pill on the toolbar
// fill, and below lg it is a pill with 40px segments on a 48px track like every
// mobile control. Not for navigation.
// Keyboard follows the radio group pattern (components/ui/radio-group): one Tab stop,
// arrow keys move and select.

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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
    <RadioGroup
      aria-label={ariaLabel}
      value={value}
      onValueChange={(next) => {
        const option = options.find((item) => item.value === next)
        if (option) onChange(option.value)
      }}
      className={cn(
        "grid w-fit auto-cols-fr grid-flow-col gap-0.5 rounded-md bg-fill-strong p-0.5 in-[.toolbar-band]:rounded-full in-[.toolbar-band]:bg-toolbar-fill max-lg:w-full max-lg:rounded-full max-lg:p-1",
        className,
      )}
    >
      {options.map((option) => (
        <RadioGroupItem
          key={option.value}
          value={option.value}
          className="h-6 min-w-[72px] rounded-sm px-2.5 in-[.toolbar-band]:rounded-full max-lg:rounded-full text-footnote font-medium whitespace-nowrap text-label transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none max-lg:h-10 max-lg:min-w-0 max-lg:px-3 data-[state=checked]:bg-segment-selected data-[state=checked]:font-semibold data-[state=checked]:shadow-(--shadow-segment)"
        >
          {option.label}
        </RadioGroupItem>
      ))}
    </RadioGroup>
  )
}
