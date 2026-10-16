import type { ComponentProps } from "react"

import { SearchFieldIcon, searchFieldClass } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * A stand-alone search field inside a page (DESIGN.md SearchField). `className` sizes the
 * wrapper; every other prop goes to the input, which needs an aria-label or a <label htmlFor>.
 */
export function SearchInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <div className={cn("relative", className)}>
      <SearchFieldIcon />
      <input type="search" className={searchFieldClass} {...props} />
    </div>
  )
}
