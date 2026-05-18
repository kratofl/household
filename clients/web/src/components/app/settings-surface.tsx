import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

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
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div>
        <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-8">{children}</div>
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
    <section className="grid gap-4 border-t pt-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        {aside ? <div className="mt-4">{aside}</div> : null}
      </div>
      <div className="space-y-3">{children}</div>
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
    <div className={cn("flex flex-wrap items-center justify-between gap-4 rounded-md border bg-card p-4", className)}>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
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
    <div className="rounded-md border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}
