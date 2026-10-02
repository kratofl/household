import type { ReactNode } from "react"

import { Meter } from "@/components/app/grouped"
import { cn } from "@/lib/utils"

/** positive and negative colour the line; neutral is plain supporting text. */
export type KpiDelta = { text: string; tone: "positive" | "negative" | "neutral" }

const deltaClass: Record<KpiDelta["tone"], string> = {
  positive: "font-semibold text-success-text",
  negative: "font-semibold text-danger-text",
  neutral: "text-label-secondary",
}

/**
 * The flat metric card: a label, the number, and a delta line or a meter. Four
 * sit in a row on desktop and 2×2 on phones. The card itself is never coloured;
 * a negative value may be.
 */
export function KpiCard({
  label,
  value,
  negative = false,
  delta,
  meter,
  action,
  className,
}: {
  label: string
  value: string
  negative?: boolean
  delta?: KpiDelta
  meter?: { fraction: number; marker?: number; label?: string }
  /** A small secondary action under the figures, e.g. spending from the value. */
  action?: ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex h-full flex-col gap-1 rounded-xl bg-surface px-5 py-[18px]", className)}>
      <h2 className="text-footnote font-medium text-label-secondary">{label}</h2>
      <p className={cn("text-kpi tabular-nums max-lg:text-[28px]", negative && "text-danger-text")}>{value}</p>
      {meter ? <Meter className="mt-1" {...meter} /> : null}
      {delta ? <p className={cn("text-caption font-normal", deltaClass[delta.tone])}>{delta.text}</p> : null}
      {action ? <div className="mt-auto pt-2">{action}</div> : null}
    </section>
  )
}
