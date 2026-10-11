"use client"

// Several metrics side by side as one card (DESIGN.md, Metrics → metric strip):
// cells divided by separator hairlines, never a row of separate cards. Up to five
// cells in one row on desktop, more wrap into evenly filled rows (6 → 3 + 3,
// 7 → 4 + 3); phones wrap to two columns. A short last row stretches its cells
// across, so there are never empty gaps. A cell with `select` is itself a button,
// e.g. a pot that starts an expense. An optional header (headline title + link
// action) sits on top; without one the strip is just the cells (a list page's totals).
//
//   <MetricStrip title="Töpfe" action={{ label: "Verwalten", href: "/budget/categories" }} cells={[
//     { label: "Lebensmittel", value: "277,70 €", icon: { glyph: IconShoppingCart, tone: "green" },
//       note: "übrig von 450,00 €", meter: { fraction: 0.38, marker: 0.35 } },
//   ]} />

import Link from "next/link"
import { useId, type ComponentProps, type ReactNode } from "react"
import { IconPlus } from "@tabler/icons-react"

import { IconTile, Meter, listCardClass } from "@/components/app/grouped"
import type { Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

type MetricCellContent = {
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
}

/**
 * A cell holds a small action at its bottom, or is the action itself (`select`,
 * with its accessible name); never both, as a button cannot contain another.
 */
export type MetricCell = MetricCellContent &
  ({ action?: ReactNode; select?: never } | { select: { label: string; onClick: () => void }; action?: never })

export type CardAction = { label: string; href: string } | { label: string; onClick: () => void }

// A cell's width per row of 1–5 columns, less 1px so the hairlines still fit; cells
// grow from there. Written out so Tailwind sees every class.
const desktopBasis = ["", "lg:basis-full", "lg:basis-[calc(50%_-_1px)]", "lg:basis-[calc(100%/3_-_1px)]", "lg:basis-[calc(25%_-_1px)]", "lg:basis-[calc(20%_-_1px)]"]

/** Desktop columns: at most five, with the rows as evenly filled as possible. */
function desktopColumns(count: number) {
  const rows = Math.max(1, Math.ceil(count / 5))
  return Math.max(1, Math.ceil(count / rows))
}

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
      <div className="flex flex-wrap gap-px bg-separator">
        {cells.map((cell) => (
          <MetricCellView key={cell.label} cell={cell} basis={desktopBasis[desktopColumns(cells.length)]} />
        ))}
      </div>
    </section>
  )
}

function MetricCellView({ cell, basis }: { cell: MetricCell; basis: string }) {
  const id = useId()
  // Two columns on phones, where an odd last cell grows across the row.
  const className = cn("flex min-w-0 grow basis-[calc(50%_-_1px)] flex-col gap-2 bg-surface px-4 py-3.5", basis)
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {cell.icon ? <IconTile icon={cell.icon.glyph} tone={cell.icon.tone} size={26} /> : null}
        <span className="truncate text-callout font-medium text-label">{cell.label}</span>
        {cell.select ? <IconPlus aria-hidden className="ml-auto size-4 shrink-0 text-label-secondary [stroke-width:2]" /> : null}
      </span>
      <span id={`${id}-value`} className={cn("block truncate text-kpi max-lg:text-title-2", cell.negative && "text-danger-text")}>{cell.value}</span>
      {cell.note ? (
        <span id={`${id}-note`} className="block text-footnote text-label-secondary [&_strong]:font-semibold [&_strong]:text-label">{cell.note}</span>
      ) : null}
      {cell.meter ? <Meter {...cell.meter} /> : null}
    </>
  )
  if (cell.select) {
    // The name says what the button does; the figures follow as its description.
    return (
      <button
        type="button"
        onClick={cell.select.onClick}
        aria-label={cell.select.label}
        aria-describedby={cell.note ? `${id}-value ${id}-note` : `${id}-value`}
        className={cn(className, "text-left transition-colors hover:bg-fill focus-visible:outline-offset-[-2px]")}
      >
        {content}
      </button>
    )
  }
  return (
    <div className={className}>
      {content}
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
