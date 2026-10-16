"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// The popover from DESIGN.md: small floating glass beside its trigger, radius-lg, 12px
// padding, for a choice or a combobox that needs more than a menu. It stacks above
// sheets, so it also works inside one. Escape closes it and returns focus to the trigger.

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger

function PopoverContent({ className, align = "start", sideOffset = 6, collisionPadding = 8, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "glass z-[60] w-72 max-w-[calc(100vw-2rem)] origin-(--radix-popover-content-transform-origin) rounded-lg p-3 text-label duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
