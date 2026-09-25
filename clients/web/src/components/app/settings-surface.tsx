"use client"

import type { ReactNode } from "react"
import { IconRestore } from "@tabler/icons-react"

import { PageHeader } from "@/components/app/page-header"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

// Settings pages in the grouped-list idiom: a section title, then one grouped
// surface with hairline-separated rows.

export function SettingsSurface({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="space-y-7">
      <PageHeader title={title} subtitle={description} />
      {children}
    </div>
  )
}

export function SettingsSection({
  title,
  description,
  aside,
  children,
}: {
  title: string
  description?: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between px-1">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {aside}
      </div>
      <div className="surface-group hairline-rows">{children}</div>
      {description ? <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">{description}</p> : null}
    </section>
  )
}

export function SettingsRow({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-h-[44px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2", className)}>
      <div className="min-w-0">
        <p>{title}</p>
        {description ? <p className="text-[11px] text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  )
}

export function SettingsField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-4 px-4 py-2">
      <span>{label}</span>
      <span className="truncate text-muted-foreground">{value}</span>
    </div>
  )
}

/** A block inside a group that needs its own padding (forms, pickers). */
export function SettingsBlock({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 py-3", className)}>{children}</div>
}

/**
 * A row whose value is a range: label and hint on the left, the current value and
 * a slider on the right. The reset button only appears once the value was changed,
 * so an untouched setting stays quiet.
 */
export function SettingsSlider({
  title,
  description,
  value,
  display,
  min,
  max,
  step,
  resetLabel,
  onChange,
  onReset,
}: {
  title: string
  description?: string
  value: number
  display: string
  min: number
  max: number
  step: number
  resetLabel: string
  onChange: (value: number) => void
  onReset?: () => void
}) {
  return (
    <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="font-medium">{title}</p>
          {onReset ? (
            <button
              type="button"
              aria-label={resetLabel}
              title={resetLabel}
              onClick={onReset}
              className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-fill-3 hover:text-foreground"
            >
              <IconRestore className="size-3.5" />
            </button>
          ) : null}
        </div>
        {description ? <p className="text-[11px] text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="min-w-14 rounded-full bg-fill-3 px-2 py-0.5 text-center text-[11px] tabular-nums">{display}</span>
        <Slider
          className="w-36 sm:w-44"
          aria-label={title}
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(next) => onChange(next[0])}
        />
      </div>
    </div>
  )
}
