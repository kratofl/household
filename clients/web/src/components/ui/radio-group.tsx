"use client"

import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// Pick one of a few options: one Tab stop, arrow keys move and select (DESIGN.md
// Accessibility). Unstyled on purpose: the segmented control, colour swatches and the
// icon grid each draw their items; a checked item carries data-state="checked".

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={className} {...props} />
}

function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return <RadioGroupPrimitive.Item data-slot="radio-group-item" className={cn("disabled:pointer-events-none disabled:opacity-50", className)} {...props} />
}

export { RadioGroup, RadioGroupItem }
