"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { IconCheck } from "@tabler/icons-react"

import { cn } from "@/lib/utils"

// A choice that waits for the form's Save button (settings that apply at once are
// switches). 20px on surface with a border and radius-xs; checked is brand-500 with
// an on-brand check. The hit area grows to 44px below lg.
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative grid size-5 shrink-0 place-items-center rounded-xs border border-border bg-surface data-checked:border-brand-500 data-checked:bg-brand-500 data-checked:text-on-brand data-disabled:cursor-not-allowed data-disabled:opacity-50 max-lg:after:absolute max-lg:after:-inset-3",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <IconCheck className="size-3.5 [stroke-width:3]" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
