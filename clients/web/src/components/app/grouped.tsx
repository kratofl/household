"use client"

// List building blocks (DESIGN.md Tables and lists), the one way pages build a card of
// rows: ListCard is the card, CardHeader its header, Group both plus hairline rows. Rows
// are 36px (48px on phones): Row, FormRow, ListSubhead, Block; ListFooter and ListEmpty
// close or replace them. A card never contains another card.

import Link from "next/link"
import type { ReactNode } from "react"
import { IconChevronRight } from "@tabler/icons-react"

import { cardSurfaceClass } from "@/components/ui/card"
import { toneTint, type Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

/** The card behind a list: the card surface, clipping its rows to the corners. */
const listCardClass = cn(cardSurfaceClass, "overflow-hidden")

/** A text action in the `link` colour: a Link for `href`, a button for `onClick`. */
export type CardAction = { label: string; href: string } | { label: string; onClick: () => void }

export function TextAction({ action, className }: { action: CardAction; className?: string }) {
  const style = cn("shrink-0 text-right font-medium text-link hover:underline", className)
  return "href" in action ? (
    <Link href={action.href} className={style}>
      {action.label}
    </Link>
  ) : (
    <button type="button" onClick={action.onClick} className={style}>
      {action.label}
    </button>
  )
}

/** A list card without a header of its own; use Group when it has a title and rows. */
export function ListCard({ label, className, children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <section aria-label={label} className={cn(listCardClass, className)}>
      {children}
    </section>
  )
}

/**
 * The 40px (48px on phones) card header: a headline title with an optional hint under
 * it, and on the right a text action or `aside`, one control that wraps below the
 * title when there is no room (e.g. a search field).
 */
export function CardHeader({ title, description, action, aside }: { title: string; description?: string; action?: CardAction; aside?: ReactNode }) {
  return (
    <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2 max-lg:min-h-12 max-lg:py-3">
      <div className="min-w-0">
        <h2 className="text-headline">{title}</h2>
        {description ? <p className="mt-0.5 text-footnote text-pretty text-label-secondary">{description}</p> : null}
      </div>
      {action ? <TextAction action={action} /> : aside}
    </div>
  )
}

/** A list card: an optional header, then rows separated by hairlines. */
export function Group({
  title,
  description,
  action,
  aside,
  className,
  children,
}: {
  title?: string
  description?: string
  action?: CardAction
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <ListCard className={className}>
      {title ? <CardHeader title={title} description={description} action={action} aside={aside} /> : null}
      <div className={cn("hairline-rows", title && "border-t border-separator")}>{children}</div>
    </ListCard>
  )
}

/** The summary footer row of a list card: footnote on fill. */
export function ListFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("border-t border-separator bg-fill px-4 py-2 text-footnote text-label-secondary", className)}>{children}</div>
}

/** A fill subheader inside a list card naming the rows under it (a day, a kind); `trailing` is e.g. their total. */
export function ListSubhead({ trailing, className, children }: { trailing?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <h3 className={cn("flex min-h-[30px] items-center justify-between gap-3 bg-fill px-4 text-footnote font-semibold text-label-secondary", className)}>
      <span>{children}</span>
      {trailing !== undefined ? <span className="tabular-nums">{trailing}</span> : null}
    </h3>
  )
}

/** What a list card shows when it has no rows: one centred line. */
export function ListEmpty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-footnote text-label-secondary">{children}</p>
}

const rowClass = "flex min-h-9 w-full items-center gap-3 px-4 py-1.5 text-left max-lg:min-h-12 max-lg:py-2.5"

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

/**
 * Label left, control right; the form-row shape of settings and editors. With `htmlFor`
 * the label names that control; without it the label is plain text beside the content
 * (a value, or controls that carry their own names).
 */
export function FormRow({ label, htmlFor, hint, children }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; children?: ReactNode }) {
  const text = (
    <>
      <span className="block truncate">{label}</span>
      {hint ? <span className="block text-footnote text-label-secondary">{hint}</span> : null}
    </>
  )
  return (
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-1.5 max-lg:min-h-12 max-lg:py-2.5">
      {htmlFor ? <label htmlFor={htmlFor} className="min-w-0">{text}</label> : <div className="min-w-0 flex-1">{text}</div>}
      {children ? <div className="flex min-w-0 items-center justify-end gap-2 text-right">{children}</div> : null}
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
 * The 6px meter: a meter-track (brand tint) with the value in brand-500.
 * The optional marker is a hairline, e.g. how far the period has run; `label`
 * explains the meter to screen readers and as a tooltip.
 */
export function Meter({ fraction, marker, label, className }: { fraction: number; marker?: number; label?: string; className?: string }) {
  const width = Math.min(100, Math.max(0, fraction * 100))
  return (
    <div role={label ? "img" : undefined} aria-label={label} title={label} className={cn("relative h-1.5 w-full rounded-full bg-meter-track", className)}>
      <div className="h-full rounded-full bg-brand-500" style={{ width: `${width}%` }} />
      {marker !== undefined ? (
        <div className="absolute -top-1 h-3.5 w-px bg-label" style={{ left: `${Math.min(100, Math.max(0, marker * 100))}%` }} aria-hidden />
      ) : null}
    </div>
  )
}
