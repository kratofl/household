"use client"

import type { ReactNode } from "react"

import { listCardClass } from "@/components/app/grouped"
import { PageHeader } from "@/components/app/page-header"
import { cn } from "@/lib/utils"

// Settings pages: the title in the toolbar, then list cards with a headline and
// 48px rows separated by hairlines, the same shape as every other list.

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
    <div className="space-y-4">
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
      <div className={listCardClass}>
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-separator px-4 pt-3 pb-2">
          <h2 className="text-headline">{title}</h2>
          {aside}
        </div>
        <div className="hairline-rows">{children}</div>
      </div>
      {description ? <p className="mt-2 px-1 text-footnote text-label-secondary">{description}</p> : null}
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
    <div className={cn("flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5", className)}>
      <div className="min-w-0">
        <p>{title}</p>
        {description ? <p className="text-footnote text-label-secondary">{description}</p> : null}
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
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-2.5">
      <span>{label}</span>
      <span className="truncate text-label-secondary">{value}</span>
    </div>
  )
}

/** A block inside a section that needs its own padding (forms, pickers). */
export function SettingsBlock({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 py-3", className)}>{children}</div>
}
