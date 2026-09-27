"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// On/off for settings that apply immediately: a 44×26 pill with a 22px white
// knob, brand-500 when on and fill-strong when off; 51×31 below lg. Anything that
// waits for a Save button is a checkbox instead.
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-[26px] w-11 shrink-0 items-center rounded-full p-0.5 transition-colors data-checked:bg-brand-500 data-unchecked:bg-fill-strong data-disabled:cursor-not-allowed data-disabled:opacity-50 max-lg:h-[31px] max-lg:w-[51px]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform data-checked:translate-x-[18px] max-lg:size-[27px] max-lg:data-checked:translate-x-5"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
