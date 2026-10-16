"use client"

// The page's one lead number (DESIGN.md, Metrics → hero metric) on its card, with
// its chart directly under it as `children`. Label callout 500 label-secondary,
// value `display` (danger-text when negative), one supporting line in body
// label-secondary — put the key figure in <strong> — and an optional warning chip
// top-right. The card stretches to its row's height; the chart sits at the bottom.
//
//   <HeroMetric label="Spaßbudget übrig" value="415,63 €"
//     supporting={<>von 702,03 € · noch 20 Tage · <strong>20,78 € pro Tag</strong></>}
//     status={{ label: "49,47 € über Plan", icon: IconAlertTriangle }}>
//     <PaceChart … />
//   </HeroMetric>

import type { ComponentType, ReactNode } from "react"

import { ListCard } from "@/components/app/grouped"
import { toneTint } from "@/lib/tone"
import { cn } from "@/lib/utils"

export function HeroMetric({
  label,
  value,
  negative = false,
  supporting,
  status,
  children,
  className,
}: {
  label: string
  /** Pre-formatted, e.g. „415,63 €“. */
  value: string
  negative?: boolean
  supporting?: ReactNode
  /** A warning chip top-right; its text must make sense on its own. */
  status?: { label: string; icon: ComponentType<{ className?: string }> }
  children?: ReactNode
  className?: string
}) {
  return (
    <ListCard className={cn("flex h-full flex-col", className)}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 pt-4 pb-1">
        <div className="min-w-0">
          <h2 className="text-callout font-medium text-label-secondary">{label}</h2>
          <p className={cn("text-display", negative && "text-danger-text")}>{value}</p>
          {supporting ? (
            <p className="mt-0.5 text-body text-label-secondary [&_strong]:font-semibold [&_strong]:text-label">{supporting}</p>
          ) : null}
        </div>
        {status ? (
          <span className={cn("ml-auto inline-flex h-[22px] items-center gap-1 rounded-xs px-2 text-footnote font-semibold whitespace-nowrap", toneTint.yellow)}>
            <status.icon className="size-3.5 [stroke-width:2]" />
            {status.label}
          </span>
        ) : null}
      </div>
      {children ? <div className="mt-auto px-2 pb-2">{children}</div> : null}
    </ListCard>
  )
}
