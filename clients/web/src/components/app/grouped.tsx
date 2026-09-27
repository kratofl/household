"use client"

// List building blocks: a flat surface card with an optional headline, rows of
// 48px separated by hairlines, and the common row shapes. Tables and lists in
// the design system look like this.

import Link from "next/link"
import type { ReactNode } from "react"
import { IconChevronRight } from "@tabler/icons-react"

import { toneTint, type Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

/** The card behind a list. Header and rows are its children. */
export const listCardClass = "overflow-hidden rounded-xl bg-surface"

export function Group({
  title,
  action,
  trailing,
  footer,
  className,
  children,
}: {
  title?: string
  action?: { label: string; href: string } | { label: string; onClick: () => void }
  trailing?: ReactNode
  footer?: ReactNode
  className?: string
  children: ReactNode
}) {
  const header = title || action || trailing
  return (
    <section className={className}>
      <div className={listCardClass}>
        {header ? (
          <div className="flex min-h-12 items-center justify-between gap-3 px-4 pt-3 pb-2">
            {title ? <h2 className="text-headline">{title}</h2> : <span />}
            {action ? (
              "href" in action ? (
                <Link href={action.href} className="shrink-0 text-right font-medium text-link hover:underline">
                  {action.label}
                </Link>
              ) : (
                <button type="button" onClick={action.onClick} className="shrink-0 text-right font-medium text-link hover:underline">
                  {action.label}
                </button>
              )
            ) : trailing ? (
              <span className="text-footnote tabular-nums text-label-secondary">{trailing}</span>
            ) : null}
          </div>
        ) : null}
        <div className={cn("hairline-rows", header && "border-t border-separator")}>{children}</div>
      </div>
      {footer ? <p className="mt-2 px-1 text-footnote text-label-secondary">{footer}</p> : null}
    </section>
  )
}

const rowClass = "flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left"

export function Row({
  children,
  href,
  onClick,
  className,
}: {
  children: ReactNode
  href?: string
  onClick?: () => void
  className?: string
}) {
  // Rows fill the clipped card, so their focus ring is drawn inside them.
  const interactive = cn(rowClass, "transition-colors hover:bg-fill focus-visible:outline-offset-[-2px]", className)
  if (href) {
    return (
      <Link href={href} className={interactive}>
        {children}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={interactive}>
        {children}
      </button>
    )
  }
  return <div className={cn(rowClass, className)}>{children}</div>
}

/** Label left, control right; the form-row shape of settings and editors. */
export function FormRow({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
      <label htmlFor={htmlFor} className="min-w-0">
        <span className="block">{label}</span>
        {hint ? <span className="block text-footnote text-label-secondary">{hint}</span> : null}
      </label>
      <div className="flex min-w-0 items-center justify-end gap-2 text-right">{children}</div>
    </div>
  )
}

/** A padded block inside a list card for content that is not a row. */
export function Block({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 py-3", className)}>{children}</div>
}

export function Disclosure() {
  return <IconChevronRight className="size-4 shrink-0 text-label-secondary [stroke-width:2]" />
}

/** Tile corners keep the 10px-on-36px proportion of the design system's app tile. */
export function tileRadius(size: number) {
  return Math.round((size * 10) / 36)
}

/** A tinted icon tile for a category or a figure. */
export function IconTile({
  icon: Icon,
  tone,
  size = 32,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  tone: Tone
  size?: number
}) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", toneTint[tone])}
      style={{ width: size, height: size, borderRadius: tileRadius(size) }}
    >
      <Icon style={{ width: size * 0.56, height: size * 0.56 }} />
    </span>
  )
}

/**
 * The 6px meter: a fill track with the value in brand-500, the budget colour.
 * The optional marker is a hairline, e.g. how far the period has run; `label`
 * explains the meter to screen readers and as a tooltip.
 */
export function Meter({ fraction, marker, label, className }: { fraction: number; marker?: number; label?: string; className?: string }) {
  const width = Math.min(100, Math.max(0, fraction * 100))
  return (
    <div role={label ? "img" : undefined} aria-label={label} title={label} className={cn("relative h-1.5 w-full rounded-full bg-fill", className)}>
      <div className="h-full rounded-full bg-brand-500" style={{ width: `${width}%` }} />
      {marker !== undefined ? (
        <div className="absolute -top-1 h-3.5 w-px bg-label" style={{ left: `${Math.min(100, Math.max(0, marker * 100))}%` }} aria-hidden />
      ) : null}
    </div>
  )
}
