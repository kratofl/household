"use client"

import { cn } from "@/lib/utils"

export type FormSelectOption = {
  value: string
  label: string
}

export function FormSelect({
  id,
  value,
  onValueChange,
  options,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: FormSelectOption[]
  disabled?: boolean
  className?: string
  "aria-label"?: string
}) {
  return (
    <select
      id={id}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-colors outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
