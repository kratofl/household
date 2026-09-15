"use client"

// Label + control pair; injects a shared id into the child control.

import { type ReactElement, type ReactNode, cloneElement, isValidElement, useId } from "react"
import { Label } from "@/components/ui/label"

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children}
    </div>
  )
}
