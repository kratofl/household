"use client"

// Grouped-list building blocks (inset grouped lists as on iOS/macOS):
// a titled group of hairline-separated rows, plus common row shapes.

import Link from "next/link"
import type { ReactNode } from "react"
import { IconChevronRight } from "@tabler/icons-react"

import { cn } from "@/lib/utils"

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
  return (
    <section className={className}>
      {title || action || trailing ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 px-1">
          {title ? <h2 className="font-semibold">{title}</h2> : <span />}
          {action ? (
            "href" in action ? (
              <Link href={action.href} className="text-primary hover:underline">
                {action.label}
              </Link>
            ) : (
              <button type="button" onClick={action.onClick} className="text-primary hover:underline">
                {action.label}
              </button>
            )
          ) : trailing ? (
            <span className="text-xs tabular-nums text-muted-foreground">{trailing}</span>
          ) : null}
        </div>
      ) : null}
      <div className="surface-group hairline-rows">{children}</div>
      {footer ? <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">{footer}</p> : null}
    </section>
  )
}

const rowClass = "flex min-h-[44px] w-full items-center gap-3 px-3 py-2 text-left first:rounded-t-[10px] last:rounded-b-[10px]"

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
  const interactive = cn(rowClass, "transition-colors hover:bg-fill-3", className)
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

/** Label left, control right; the form-row shape of Settings screens. */
export function FormRow({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
      <label htmlFor={htmlFor} className="min-w-0">
        <span className="block">{label}</span>
        {hint ? <span className="block text-[11px] text-muted-foreground">{hint}</span> : null}
      </label>
      <div className="flex min-w-0 items-center justify-end gap-2 text-right">{children}</div>
    </div>
  )
}

/** A padded block inside a group for content that is not a row. */
export function Block({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 py-3", className)}>{children}</div>
}

export function Disclosure() {
  return <IconChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
}

/** Settings-app style icon tile in a system color. */
export function IconTile({
  icon: Icon,
  color,
  size = 28,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>
  color: string
  size?: number
}) {
  return (
    <span className="icon-tile text-white" style={{ background: color, width: size, height: size, borderRadius: size * 0.25 }}>
      <Icon style={{ width: size * 0.6, height: size * 0.6 }} strokeWidth={2} />
    </span>
  )
}

/** Thin progress bar in the Apple Storage/Battery idiom, with an optional "today" marker. */
export function ThinBar({
  fraction,
  marker,
  color,
  className,
}: {
  fraction: number
  marker?: number
  color?: string
  className?: string
}) {
  const width = Math.min(100, Math.max(0, fraction * 100))
  return (
    <div className={cn("relative h-1.5 w-full rounded-[3px] bg-fill-3", className)}>
      <div className="h-full rounded-[3px] bg-primary" style={{ width: `${width}%`, background: color }} />
      {marker !== undefined ? (
        <div className="absolute -top-1 h-3.5 w-px bg-foreground/60" style={{ left: `${Math.min(100, Math.max(0, marker * 100))}%` }} aria-hidden />
      ) : null}
    </div>
  )
}
