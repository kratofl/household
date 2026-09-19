import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

// Settings pages in the grouped-list idiom: a section title, then one opaque
// group with hairline-separated rows.

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
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] lg:text-[34px]">{title}</h1>
        <p className="mt-0.5 text-muted-foreground">{description}</p>
      </div>
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
