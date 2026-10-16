"use client"

// A stacked field: the label above its control, as in sheets and forms. It gives the
// control a shared id so the label names it.

import { type ReactElement, cloneElement, useId } from "react"
import { Label } from "@/components/ui/label"

export function Field({
  label,
  children,
}: {
  label: string
  /** One control that takes an `id`, e.g. an Input. */
  children: ReactElement<{ id?: string }>
}) {
  const id = useId()
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, { id })}
    </div>
  )
}
