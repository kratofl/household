import * as React from "react"

import { cn } from "@/lib/utils"

// Text field: 40px on surface with a 1px border and radius-md; a pill of at least
// 44px below lg. Inside the toolbar it becomes a pill on the toolbar fill.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-callout text-label placeholder:text-label-secondary disabled:cursor-not-allowed disabled:bg-bg disabled:text-label-disabled aria-invalid:border-red-500 max-lg:h-11 max-lg:rounded-full max-lg:px-4 in-[.toolbar-band]:rounded-full in-[.toolbar-band]:border-0 in-[.toolbar-band]:bg-toolbar-fill in-[.toolbar-band]:px-4",
        className
      )}
      {...props}
    />
  )
}

export { Input }
