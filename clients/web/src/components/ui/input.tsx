import * as React from "react"
import { IconSearch } from "@tabler/icons-react"

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

/**
 * Quiet fields for editable table rows (DESIGN.md Lists): no edge at rest, so a table of
 * fields reads like a table. A text field shows as plain text and gains a fill on hover;
 * a value field (amount, date part, select) keeps the fill. Focus brings back the
 * border-control edge on surface. On phones a text field keeps the desktop inset, so a
 * name next to an amount keeps its room. Pass one to `className` of an Input or a select trigger.
 */
const quietTextField = "border-transparent bg-transparent hover:bg-fill focus:border-border-control focus:bg-surface disabled:bg-transparent max-lg:px-2.5"
const quietValueField = "border-transparent bg-fill focus:border-border-control focus:bg-surface disabled:bg-fill"

/**
 * The search field from DESIGN.md (SearchField): a 28px surface field with the magnifier
 * on the left, a 44px pill on fill below lg. Put the input and SearchFieldIcon in one
 * `relative` wrapper; SearchInput and CommandInput do.
 */
const searchFieldClass =
  "h-7 w-full rounded-sm border border-border-control bg-surface pr-3 pl-8 text-callout text-label placeholder:text-label-secondary max-lg:h-11 max-lg:rounded-full max-lg:border-0 max-lg:bg-fill max-lg:pr-4 max-lg:pl-9 [&::-webkit-search-cancel-button]:hidden"

function SearchFieldIcon() {
  return <IconSearch aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-label-secondary [stroke-width:2] max-lg:left-3.5 max-lg:size-[15px]" />
}

export { Input, quietTextField, quietValueField, searchFieldClass, SearchFieldIcon }
