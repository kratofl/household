import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type MeterTone = "positive" | "warning" | "critical"

export function meterTone(usedFraction: number): MeterTone {
  if (usedFraction >= 1) return "critical"
  if (usedFraction >= 0.8) return "warning"
  return "positive"
}

const heroToneText: Record<MeterTone, string> = {
  positive: "text-foreground",
  warning: "text-amber-600 dark:text-amber-400",
  critical: "text-destructive",
}

const meterToneBar: Record<MeterTone, string> = {
  positive: "bg-primary",
  warning: "bg-amber-500",
  critical: "bg-destructive",
}

export function UsageMeter({
  fraction,
  tone,
  className,
}: {
  fraction: number
  tone: MeterTone
  className?: string
}) {
  const percent = Math.min(100, Math.max(0, fraction * 100))

  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-all", meterToneBar[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

export function HeroMetric(props: {
  eyebrow?: string
  label: string
  value: string
  tone?: MeterTone
  usedFraction?: number
  caption?: string
  stats?: ReactNode
}) {
  const tone = props.tone ?? "positive"

  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      {props.eyebrow ? (
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {props.eyebrow}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <p className="text-sm text-muted-foreground">{props.label}</p>
          <p className={cn("mt-1 text-4xl font-semibold tracking-tight tabular-nums", heroToneText[tone])}>
            {props.value}
          </p>
        </div>
        {props.stats ? (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">{props.stats}</div>
        ) : null}
      </div>
      {props.usedFraction !== undefined ? (
        <UsageMeter className="mt-5" fraction={props.usedFraction} tone={tone} />
      ) : null}
      {props.caption ? <p className="mt-2 text-xs text-muted-foreground">{props.caption}</p> : null}
    </section>
  )
}

export function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium tabular-nums">{value}</p>
    </div>
  )
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}
