"use client"

// Several metrics side by side as one card (DESIGN.md, Metrics → metric strip):
// cells divided by separator hairlines, never a row of separate cards. Up to five
// cells in one row on desktop; phones wrap to two columns, and an odd last cell
// spans the row. An optional header (headline title + link action) sits on top;
// without one the strip is just the cells (a list page's totals).
//
//   <MetricStrip title="Töpfe" action={{ label: "Verwalten", href: "/budget/categories" }} cells={[
//     { label: "Lebensmittel", value: "277,70 €", icon: { glyph: IconShoppingCart, tone: "green" },
//       note: "übrig von 450,00 €", meter: { fraction: 0.38, marker: 0.35 } },
//   ]} />

import Link from "next/link"
import type { ComponentProps, ReactNode } from "react"

import { IconTile, Meter, listCardClass } from "@/components/app/grouped"
import type { Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

export type MetricCell = {
  label: string
  /** Pre-formatted, e.g. „1.987,50 €“. */
  value: string
  /** The 26px tinted tile before the label. */
  icon?: { glyph: ComponentProps<typeof IconTile>["icon"]; tone: Tone }
  /** The footnote line under the value; put a key figure in <strong>. */
  note?: ReactNode
  meter?: ComponentProps<typeof Meter>
  /** Shows the value in danger-text, e.g. an overdrawn pot. */
  negative?: boolean
  /** A small action at the bottom of the cell. */
  action?: ReactNode
}

export type CardAction = { label: string; href: string } | { label: string; onClick: () => void }

// Written out so Tailwind sees every class.
const desktopColumns = ["lg:grid-cols-1", "lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3", "lg:grid-cols-4", "lg:grid-cols-5"]

export function MetricStrip({
  cells,
  title,
  action,
  className,
}: {
  cells: MetricCell[]
  title?: string
  action?: CardAction
  className?: string
}) {
  return (
    <section className={cn(listCardClass, className)} aria-label={title}>
      {title ? (
        <div className="flex min-h-10 items-center justify-between gap-3 border-b border-separator px-4 py-2 max-lg:min-h-12">
          <h2 className="text-headline">{title}</h2>
          {action ? <HeaderAction action={action} /> : null}
        </div>
      ) : null}
      {/* The separator shows through the 1px gaps as hairlines between cells. */}
      <div className={cn("grid grid-cols-2 gap-px bg-separator", desktopColumns[Math.min(cells.length, 5)])}>
        {cells.map((cell) => (
          <MetricCellView key={cell.label} cell={cell} />
        ))}
      </div>
    </section>
  )
}

function MetricCellView({ cell }: { cell: MetricCell }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 bg-surface px-4 py-3.5 max-lg:[&:last-child:nth-child(odd)]:col-span-2">
      <div className="flex min-w-0 items-center gap-2">
        {cell.icon ? <IconTile icon={cell.icon.glyph} tone={cell.icon.tone} size={26} /> : null}
        <span className="truncate text-callout font-medium text-label">{cell.label}</span>
      </div>
      <p className={cn("truncate text-kpi max-lg:text-title-2", cell.negative && "text-danger-text")}>{cell.value}</p>
      {cell.note ? (
        <p className="text-footnote text-label-secondary [&_strong]:font-semibold [&_strong]:text-label">{cell.note}</p>
      ) : null}
      {cell.meter ? <Meter {...cell.meter} /> : null}
      {cell.action ? <div className="mt-auto pt-1">{cell.action}</div> : null}
    </div>
  )
}

function HeaderAction({ action }: { action: CardAction }) {
  const className = "shrink-0 text-right font-medium text-link hover:underline"
  return "href" in action ? (
    <Link href={action.href} className={className}>
      {action.label}
    </Link>
  ) : (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  )
}
