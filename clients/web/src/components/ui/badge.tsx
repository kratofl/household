import * as React from "react"

import { toneTint, type Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

// Status tag: a tinted label with a word, never colour alone. 3px 10px padding,
// radius-xs, caption type. For a status dot with a word use StatusDot.
function Badge({
  className,
  tone = "neutral",
  ...props
}: React.ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      data-slot="badge"
      className={cn("inline-flex w-fit shrink-0 items-center rounded-xs px-2.5 py-[3px] text-caption whitespace-nowrap", toneTint[tone], className)}
      {...props}
    />
  )
}

const dotColor = {
  green: "bg-green-500",
  blue: "bg-blue-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
} as const

/** Status as an 8px dot plus its word: green active, blue review, yellow paused, red at risk. */
function StatusDot({
  className,
  status,
  children,
  ...props
}: React.ComponentProps<"span"> & { status: keyof typeof dotColor }) {
  return (
    <span className={cn("inline-flex items-center gap-[7px]", className)} {...props}>
      <i aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", dotColor[status])} />
      {children}
    </span>
  )
}

export { Badge, StatusDot }
