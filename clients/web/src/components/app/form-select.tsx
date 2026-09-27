"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type FormSelectOption = {
  value: string
  label: string
}

// Radix reserves the empty string for "no selection", but callers use it as a real
// option ("no merchant"), so it travels under this key inside the control.
const EMPTY = "__empty__"

/** A labelled pick-one field over a fixed option list. `id` lets a <label htmlFor> name it. */
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
    <Select
      value={value === "" ? EMPTY : value}
      onValueChange={(next) => onValueChange(next === EMPTY ? "" : next)}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value || EMPTY} value={option.value === "" ? EMPTY : option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
