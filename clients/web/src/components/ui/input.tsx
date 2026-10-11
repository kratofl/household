import * as React from "react"

import { cn } from "@/lib/utils"

// Text field: 28px on surface with a 1px border-control edge and radius-sm; a pill
// of at least 44px below lg. Inside the toolbar it sits borderless on the toolbar fill.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-7 w-full min-w-0 rounded-sm border border-border-control bg-surface px-2.5 text-callout text-label placeholder:text-label-secondary disabled:cursor-not-allowed disabled:bg-bg disabled:text-label-disabled aria-invalid:border-red-500 max-lg:h-11 max-lg:rounded-full max-lg:px-4 in-[.toolbar-band]:border-0 in-[.toolbar-band]:bg-toolbar-fill max-lg:in-[.toolbar-band]:rounded-full",
        className
      )}
      {...props}
    />
  )
}

export { Input }
