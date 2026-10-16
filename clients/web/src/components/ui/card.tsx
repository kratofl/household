import * as React from "react"

import { cn } from "@/lib/utils"

// The soft card surface: surface on bg, radius-lg, a separator border and shadow-e1.
// List cards (grouped.tsx) share it; Card itself is the padded message card (16px) for
// a title and a few lines, e.g. sign-in or an empty state. Titles are headline,
// descriptions footnote in label-secondary.
const cardSurfaceClass = "rounded-lg border border-separator bg-surface text-label shadow-(--shadow-e1)"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(cardSurfaceClass, "flex flex-col gap-4 p-4", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("grid gap-1", className)} {...props} />
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-title" className={cn("text-headline", className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-footnote text-label-secondary", className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={className} {...props} />
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, cardSurfaceClass }
