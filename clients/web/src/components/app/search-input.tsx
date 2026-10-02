import { IconSearch } from "@tabler/icons-react"
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

/**
 * A stand-alone search field inside a page: always a pill on fill with the
 * magnifier on the left. `className` sizes the wrapper; every other prop goes to
 * the input, which needs an aria-label or a <label htmlFor>.
 */
export function SearchInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <div className={cn("relative", className)}>
      <IconSearch aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-[15px] -translate-y-1/2 text-label-secondary [stroke-width:2]" />
      <input
        type="search"
        className="h-10 w-full rounded-full bg-fill pr-4 pl-9 text-callout text-label placeholder:text-label-secondary max-lg:h-11 [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
    </div>
  )
}
