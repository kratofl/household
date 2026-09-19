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
        "h-7 w-full rounded-md bg-input px-2.5 text-[13px] shadow-[inset_0_0_0_0.5px_var(--hairline)] transition-[box-shadow] outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring/40",
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
