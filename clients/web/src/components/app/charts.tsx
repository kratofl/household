"use client"

// Hand-built SVG charts after DESIGN.md, Charts: one series in brand-500, context
// in chart-muted / chart-muted-strong, over budget in danger-text with an icon and
// a label and never beside brand, 2px lines, bars ≤ 24px with radius-xs tops on a
// separator baseline, 3–5 solid grid lines, dashed lines only for a plan or budget
// reference, labelled at its end. Labels are selective (current value, maximum,
// reference); everything else is in a solid tooltip that follows the pointer and
// the keyboard (focus the chart, then ←/→, Home/End, Esc). Each chart is a
// <figure> with a visually hidden caption and table for screen readers.
//
// Every chart is pure: data in integer cents and pre-translated labels via props,
// money through the caller's formatter. Widths follow the container; heights are
// fixed per chart so nothing jumps while measuring.

import { IconAlertTriangle } from "@tabler/icons-react"
import { useEffect, useId, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Formats integer cents for display, e.g. 70203 → „702,03 €“. */
export type FormatMoney = (cents: number) => string

/** One line of a tooltip: the value leads, the label follows. */
export type ChartReadoutRow = { label: string; value: string }
type Readout = { title: string; rows: ChartReadoutRow[]; note?: string }

// ---------- shared pieces ----------

const tickText = "fill-label-secondary text-caption font-normal tabular-nums"
const valueText = "fill-label text-caption"

/** Rough width of a label in the caption style; good enough to keep labels clear of edges. */
function textWidth(text: string) {
  return text.length * 6.4
}

/** 3–5 round gridline values from 0 to at least `max`. */
function niceTicks(max: number, intervals: number): number[] {
  if (max <= 0) return [0]
  const raw = max / intervals
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((candidate) => candidate >= raw) ?? 10 * power
  const count = Math.ceil(max / step)
  return Array.from({ length: count + 1 }, (_, index) => index * step)
}

/** A column with radius-xs top corners, square at the baseline. */
function columnPath(x: number, width: number, top: number, base: number, radius = 4) {
  const r = Math.min(radius, width / 2, Math.max(0, base - top))
  if (r <= 0) return `M${x},${base}V${top}H${x + width}V${base}Z`
  return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + width - r}Q${x + width},${top} ${x + width},${top + r}V${base}Z`
}

function useWidth() {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!node) return
    const observer = new ResizeObserver(() => setWidth(Math.round(node.clientWidth)))
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return { ref: setNode, width }
}

/** Y gridlines with their tick labels on the left. */
function YGrid({ ticks, y, left, right, format }: { ticks: number[]; y: (value: number) => number; left: number; right: number; format: FormatMoney }) {
  return (
    <g>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} className="stroke-separator" />
          <text x={left - 8} y={y(tick) + 4} textAnchor="end" className={tickText}>
            {format(tick)}
          </text>
        </g>
      ))}
    </g>
  )
}

/** A dashed plan or budget reference's end label: name above, amount below. */
function ReferenceLabel({ x, y, name, amount }: { x: number; y: number; name: string; amount: string }) {
  return (
    <text x={x} y={y - 2} className={tickText}>
      <tspan>{name}</tspan>
      <tspan x={x} dy={14}>
        {amount}
      </tspan>
    </text>
  )
}

type Plot = { left: number; right: number }

/**
 * The frame every interactive chart shares: measures the width, maps pointer and
 * keyboard to one of `count` equal slots between `plot.left` and `plot.right`,
 * shows the slot's readout as a solid tooltip and renders the sr-only table.
 */
function ChartFrame({
  title,
  height,
  count,
  plot,
  initial,
  readout,
  table,
  children,
}: {
  title: string
  height: number
  count: number
  plot: (width: number) => Plot
  /** The slot the keyboard starts on, e.g. today. */
  initial: number
  readout: (index: number) => Readout
  table: ReactNode
  children: (width: number, active: number | null) => ReactNode
}) {
  const { ref, width } = useWidth()
  const [active, setActive] = useState<number | null>(null)
  const tooltipId = useId()
  const { left, right } = plot(width)
  const slot = count > 0 ? (right - left) / count : 0
  const shown = active === null || active >= count ? null : active
  const center = shown === null ? 0 : left + (shown + 0.5) * slot
  const info = shown === null ? null : readout(shown)

  function move(next: number) {
    setActive(Math.max(0, Math.min(count - 1, next)))
  }

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{title}</figcaption>
      <div
        ref={ref}
        tabIndex={0}
        role="group"
        aria-label={title}
        aria-describedby={info ? tooltipId : undefined}
        className="relative rounded-md"
        style={{ height }}
        onPointerMove={(event) => {
          const x = event.clientX - event.currentTarget.getBoundingClientRect().left
          setActive(x < left || x > right || slot <= 0 ? null : Math.min(count - 1, Math.floor((x - left) / slot)))
        }}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(initial)}
        onBlur={() => setActive(null)}
        onKeyDown={(event) => {
          const current = shown ?? initial
          if (event.key === "ArrowRight") move(current + 1)
          else if (event.key === "ArrowLeft") move(current - 1)
          else if (event.key === "Home") move(0)
          else if (event.key === "End") move(count - 1)
          else if (event.key === "Escape") setActive(null)
          else return
          event.preventDefault()
        }}
      >
        {width > 0 ? (
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden focusable="false" className="block overflow-visible">
            {children(width, shown)}
          </svg>
        ) : null}
        {info ? (
          <div
            id={tooltipId}
            role="tooltip"
            className="floating pointer-events-none absolute top-1 z-10 max-w-64 min-w-32 rounded-md px-2.5 py-1.5 text-footnote shadow-(--shadow-e3)"
            // Beside the active slot, on the side with more room, so it never covers the mark.
            style={center < width / 2 ? { left: center + slot / 2 + 8 } : { right: width - center + slot / 2 + 8 }}
          >
            <div className="font-semibold text-label">{info.title}</div>
            {info.rows.map((row, index) => (
              <div key={index} className="flex items-baseline justify-between gap-4">
                <span className="text-label-secondary">{row.label}</span>
                <span className="font-semibold text-label tabular-nums">{row.value}</span>
              </div>
            ))}
            {info.note ? <div className="text-label-secondary">{info.note}</div> : null}
          </div>
        ) : null}
      </div>
      {table}
    </figure>
  )
}

/** The screen-reader equivalent: one row per slot, the first cell its row header. */
function SrTable({ title, columns, rows }: { title: string; columns: string[]; rows: { key: string; head: string; cells: string[] }[] }) {
  return (
    <table className="sr-only">
      <caption>{title}</caption>
      <thead>
        <tr>
          <td />
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">{row.head}</th>
            {row.cells.map((cell, index) => (
              <td key={columns[index]}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Day ticks every week (every two on narrow plots), at the day's centre. */
function dayTicks(days: number, narrow: boolean) {
  const every = narrow ? 14 : 7
  return Array.from({ length: Math.ceil(days / every) }, (_, index) => 1 + index * every)
}

// ---------- PaceChart ----------

/**
 * Cumulative spending per day of the running period against a dashed straight
 * plan line from 0 to the budget at the period's end. The current total is the
 * end dot with its amount; a hairline marks today.
 */
export function PaceChart({
  days,
  today,
  cumulative,
  budget,
  formatMoney,
  formatTick = formatMoney,
  dayLabel,
  tickLabel = dayLabel,
  labels,
  height = 180,
}: {
  /** Days in the period. */
  days: number
  /** Today's day of the period, 1-based. */
  today: number
  /** Cents spent up to and including each day; index 0 = day 1, length = today. */
  cumulative: number[]
  /** Cents planned for the whole period. */
  budget: number
  formatMoney: FormatMoney
  /** Shorter amounts for the y axis, e.g. „200 €“. Defaults to formatMoney. */
  formatTick?: FormatMoney
  /** A day of the period (1-based) for the tooltip and table, e.g. „Sa, 11. Okt“. */
  dayLabel: (day: number) => string
  /** A day for the x axis, e.g. „1. Okt“ or „8.“. Defaults to dayLabel. */
  tickLabel?: (day: number) => string
  labels: { title: string; today: string; plan: string; spent: string }
  height?: number
}) {
  const current = cumulative[today - 1] ?? 0
  const ticks = niceTicks(Math.max(budget, ...cumulative), 4)
  const top = ticks[ticks.length - 1] || 1
  const margin = { left: Math.max(32, textWidth(formatTick(top)) + 12), right: Math.max(48, textWidth(formatMoney(budget)) + 16), top: 18, bottom: 24 }
  const plot = (width: number) => ({ left: margin.left, right: width - margin.right })
  const plannedBy = (day: number) => Math.round((budget * day) / days)

  return (
    <ChartFrame
      title={labels.title}
      height={height}
      count={days}
      plot={plot}
      initial={today - 1}
      readout={(index) => {
        const day = index + 1
        const spent = cumulative[index]
        return {
          title: dayLabel(day),
          rows:
            spent === undefined
              ? [{ label: labels.plan, value: formatMoney(plannedBy(day)) }]
              : [
                  { label: labels.spent, value: formatMoney(spent) },
                  { label: labels.plan, value: formatMoney(plannedBy(day)) },
                ],
        }
      }}
      table={
        <SrTable
          title={labels.title}
          columns={[labels.spent, labels.plan]}
          rows={cumulative.map((spent, index) => ({
            key: String(index),
            head: dayLabel(index + 1),
            cells: [formatMoney(spent), formatMoney(plannedBy(index + 1))],
          }))}
        />
      }
    >
      {(width, active) => {
        const { left, right } = plot(width)
        const plotHeight = height - margin.top - margin.bottom
        const x = (day: number) => left + (day / days) * (right - left)
        const y = (cents: number) => margin.top + plotHeight - (cents / top) * plotHeight
        const points = [`${x(0)},${y(0)}`, ...cumulative.map((cents, index) => `${x(index + 1)},${y(cents)}`)].join(" ")
        const currentLabel = formatMoney(current)
        // The amount sits left of the end dot unless that runs into the axis.
        const labelLeft = x(today) - 10 - textWidth(currentLabel) > left
        return (
          <>
            <YGrid ticks={ticks} y={y} left={left} right={right} format={formatTick} />
            <line x1={x(0)} y1={y(0)} x2={x(days)} y2={y(budget)} className="stroke-label-secondary" strokeWidth={1.5} strokeDasharray="4 4" />
            <ReferenceLabel x={right + 8} y={y(budget)} name={labels.plan} amount={formatMoney(budget)} />
            <polygon points={`${points} ${x(today)},${y(0)}`} className="fill-brand-500" fillOpacity={0.1} />
            <polyline points={points} fill="none" className="stroke-brand-500" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <line x1={x(today)} x2={x(today)} y1={margin.top} y2={margin.top + plotHeight} className="stroke-label-secondary" />
            <text x={x(today)} y={margin.top - 6} textAnchor="middle" className={valueText}>
              {labels.today}
            </text>
            {active !== null && active + 1 !== today ? (
              <g>
                <line x1={x(active + 1)} x2={x(active + 1)} y1={margin.top} y2={margin.top + plotHeight} className="stroke-separator" />
                <circle cx={x(active + 1)} cy={y(cumulative[active] ?? plannedBy(active + 1))} r={3.5} className={cumulative[active] === undefined ? "fill-label-secondary" : "fill-brand-500"} />
              </g>
            ) : null}
            <circle cx={x(today)} cy={y(current)} r={4.5} className="fill-brand-500 stroke-surface" strokeWidth={2} />
            <text x={labelLeft ? x(today) - 10 : x(today) + 10} y={y(current) - 10} textAnchor={labelLeft ? "end" : "start"} className="fill-label text-footnote font-semibold">
              {currentLabel}
            </text>
            {dayTicks(days, right - left < 360).map((day) => (
              <text key={day} x={x(day - 0.5)} y={height - 6} textAnchor="middle" className={tickText}>
                {tickLabel(day)}
              </text>
            ))}
          </>
        )
      }}
    </ChartFrame>
  )
}

// ---------- PeriodTrendChart ----------

export type TrendPeriod = {
  label: string
  /** Cents spent in the period. */
  spent: number
  /** Cents budgeted for the period. */
  budget: number
  /** The period still running; drawn in chart-muted-strong and labelled. */
  running: boolean
}

/**
 * One column per period (up to six). Past periods are chart-muted, the running one
 * chart-muted-strong; whatever lies above the budget is danger-text with a warning
 * icon and its „+x“ label. No brand-500 here: it is too close to the danger colour.
 *
 * The budget reference is one dashed line across the chart when every period has
 * the same budget, and a short dash over each column when budgets differ, so a
 * changed budget never draws a slope between periods. Either way the label sits
 * at the end of the last period's reference.
 */
export function PeriodTrendChart({
  periods,
  formatMoney,
  formatTick = formatMoney,
  labels,
  height = 220,
}: {
  periods: TrendPeriod[]
  formatMoney: FormatMoney
  formatTick?: FormatMoney
  /** `running` labels the running column („läuft“); `overBudget`/`leftOver` name the tooltip's difference row. */
  labels: { title: string; spent: string; budget: string; running: string; overBudget: string; leftOver: string }
  height?: number
}) {
  const ticks = niceTicks(Math.max(1, ...periods.flatMap((period) => [period.spent, period.budget])), 2)
  const top = ticks[ticks.length - 1] || 1
  const last = periods[periods.length - 1]
  const sameBudget = periods.every((period) => period.budget === periods[0]?.budget)
  const labelLines = Math.max(0, ...periods.map((period) => (period.spent > period.budget ? 1 : 0) + (period.running ? 1 : 0)))
  const margin = {
    left: Math.max(32, textWidth(formatTick(top)) + 12),
    right: last ? Math.max(48, textWidth(formatMoney(last.budget)) + 16) : 48,
    top: Math.max(18, labelLines * 14 + 10),
    bottom: 24,
  }
  const plot = (width: number) => ({ left: margin.left, right: width - margin.right })

  return (
    <ChartFrame
      title={labels.title}
      height={height}
      count={periods.length}
      plot={plot}
      initial={periods.length - 1}
      readout={(index) => {
        const period = periods[index]
        if (!period) return { title: "", rows: [] }
        const over = period.spent - period.budget
        return {
          title: period.running ? `${period.label} · ${labels.running}` : period.label,
          rows: [
            { label: labels.spent, value: formatMoney(period.spent) },
            { label: labels.budget, value: formatMoney(period.budget) },
            over > 0 ? { label: labels.overBudget, value: formatMoney(over) } : { label: labels.leftOver, value: formatMoney(-over) },
          ],
        }
      }}
      table={
        <SrTable
          title={labels.title}
          columns={[labels.spent, labels.budget]}
          rows={periods.map((period) => ({
            key: period.label,
            head: period.running ? `${period.label} (${labels.running})` : period.label,
            cells: [formatMoney(period.spent), formatMoney(period.budget)],
          }))}
        />
      }
    >
      {(width, active) => {
        const { left, right } = plot(width)
        const plotHeight = height - margin.top - margin.bottom
        const slot = (right - left) / Math.max(1, periods.length)
        const barWidth = Math.min(24, slot * 0.5)
        const y = (cents: number) => margin.top + plotHeight - (cents / top) * plotHeight
        const base = y(0)
        return (
          <>
            <YGrid ticks={ticks} y={y} left={left} right={right} format={formatTick} />
            {active !== null ? (
              <rect x={left + active * slot + slot * 0.1} y={margin.top} width={slot * 0.8} height={plotHeight} rx={4} className="fill-fill" />
            ) : null}
            {periods.map((period, index) => {
              const center = left + (index + 0.5) * slot
              const x0 = center - barWidth / 2
              const over = period.spent - period.budget
              const fill = period.running ? "fill-chart-muted-strong" : "fill-chart-muted"
              const overLabel = `+${formatMoney(over)}`
              // The amount only where it fits beside the icon, borrowing from neighbours that carry no
              // label of their own; it is always in the tooltip and table.
              const labelled = (other: TrendPeriod | undefined) => other !== undefined && (other.running || other.spent > other.budget)
              const room = labelled(periods[index - 1]) || labelled(periods[index + 1]) ? slot : slot * 1.6
              const showAmount = textWidth(overLabel) + 16 <= room
              const labelTop = y(period.spent) - 8
              return (
                <g key={period.label}>
                  {over > 0 ? (
                    <>
                      {/* A 2px surface gap separates the in-budget part from the overspend. */}
                      <path d={columnPath(x0, barWidth, y(period.budget) + 1, base, 0)} className={fill} />
                      <path d={columnPath(x0, barWidth, y(period.spent), y(period.budget) - 1)} className="fill-danger-text" />
                      <OverLabel center={center} y={labelTop} text={showAmount ? overLabel : null} />
                    </>
                  ) : (
                    <path d={columnPath(x0, barWidth, y(period.spent), base)} className={fill} />
                  )}
                  {period.running ? (
                    <text x={center} y={over > 0 ? labelTop - 14 : labelTop} textAnchor="middle" className={valueText}>
                      {labels.running}
                    </text>
                  ) : null}
                  {!sameBudget ? (
                    <line x1={center - slot * 0.4} x2={center + slot * 0.4} y1={y(period.budget)} y2={y(period.budget)} className="stroke-label-secondary" strokeWidth={1.5} strokeDasharray="4 4" />
                  ) : null}
                  <text x={center} y={height - 6} textAnchor="middle" className={tickText}>
                    {period.label}
                  </text>
                </g>
              )
            })}
            <line x1={left} x2={right} y1={base} y2={base} className="stroke-separator" />
            {sameBudget && last ? (
              <line x1={left} x2={right} y1={y(last.budget)} y2={y(last.budget)} className="stroke-label-secondary" strokeWidth={1.5} strokeDasharray="4 4" />
            ) : null}
            {last ? <ReferenceLabel x={right + 8} y={y(last.budget)} name={labels.budget} amount={formatMoney(last.budget)} /> : null}
          </>
        )
      }}
    </ChartFrame>
  )
}

/** The overspend marker above a column: a warning triangle and, if it fits, „+x €“. */
function OverLabel({ center, y, text }: { center: number; y: number; text: string | null }) {
  const width = text ? textWidth(text) + 16 : 12
  const x = center - width / 2
  return (
    <g>
      <IconAlertTriangle x={x} y={y - 11} width={12} height={12} className="text-danger-text" strokeWidth={2.2} />
      {text ? (
        <text x={x + 16} y={y} className={valueText}>
          {text}
        </text>
      ) : null}
    </g>
  )
}

// ---------- DailyBarChart ----------

/**
 * Spending per day of the period: past days chart-muted, today brand-500, days
 * still to come as empty slots. The highest day carries its amount, today its name
 * on the axis. `details` lists a day's items in the tooltip.
 */
export function DailyBarChart({
  days,
  today,
  amounts,
  formatMoney,
  formatTick = formatMoney,
  dayLabel,
  tickLabel = dayLabel,
  details,
  labels,
  height = 160,
}: {
  days: number
  /** Today's day of the period, 1-based. */
  today: number
  /** Cents spent per day; index 0 = day 1, length = today. */
  amounts: number[]
  formatMoney: FormatMoney
  formatTick?: FormatMoney
  dayLabel: (day: number) => string
  tickLabel?: (day: number) => string
  /** Extra tooltip rows for a day (1-based), e.g. its merchants and amounts. */
  details?: (day: number) => ChartReadoutRow[]
  /** `open` is the tooltip note for days still to come („noch offen“). */
  labels: { title: string; today: string; spent: string; open: string }
  height?: number
}) {
  const max = Math.max(0, ...amounts)
  const maxIndex = max > 0 ? amounts.indexOf(max) : -1
  const ticks = niceTicks(Math.max(1, max), 2)
  const top = ticks[ticks.length - 1] || 1
  const margin = { left: Math.max(32, textWidth(formatTick(top)) + 12), right: 8, top: 22, bottom: 24 }
  const plot = (width: number) => ({ left: margin.left, right: width - margin.right })

  return (
    <ChartFrame
      title={labels.title}
      height={height}
      count={days}
      plot={plot}
      initial={today - 1}
      readout={(index) => {
        const day = index + 1
        const amount = amounts[index]
        if (amount === undefined) return { title: dayLabel(day), rows: [], note: labels.open }
        return { title: dayLabel(day), rows: [{ label: labels.spent, value: formatMoney(amount) }, ...(details?.(day) ?? [])] }
      }}
      table={
        <SrTable
          title={labels.title}
          columns={[labels.spent]}
          rows={amounts.map((amount, index) => ({ key: String(index), head: dayLabel(index + 1), cells: [formatMoney(amount)] }))}
        />
      }
    >
      {(width, active) => {
        const { left, right } = plot(width)
        const plotHeight = height - margin.top - margin.bottom
        const slot = (right - left) / days
        const barWidth = Math.min(18, Math.max(2, slot * 0.6))
        const y = (cents: number) => margin.top + plotHeight - (cents / top) * plotHeight
        const base = y(0)
        const centerOf = (day: number) => left + (day - 0.5) * slot
        // Weekly ticks give way to „today“ when they would collide with it.
        const ticksShown = dayTicks(days, right - left < 360).filter((day) => Math.abs(centerOf(day) - centerOf(today)) > textWidth(labels.today))
        const maxLabel = maxIndex >= 0 ? formatMoney(max) : ""
        const maxCenter = centerOf(maxIndex + 1)
        const maxX = Math.min(right - textWidth(maxLabel) / 2, Math.max(left + textWidth(maxLabel) / 2, maxCenter))
        return (
          <>
            <YGrid ticks={ticks} y={y} left={left} right={right} format={formatTick} />
            {active !== null ? <rect x={left + active * slot} y={margin.top} width={slot} height={plotHeight} rx={Math.min(4, slot / 2)} className="fill-fill" /> : null}
            {amounts.map((amount, index) =>
              amount > 0 ? (
                <path
                  key={index}
                  d={columnPath(centerOf(index + 1) - barWidth / 2, barWidth, y(amount), base, Math.min(4, barWidth / 2))}
                  className={index + 1 === today ? "fill-brand-500" : "fill-chart-muted"}
                />
              ) : null,
            )}
            <line x1={left} x2={right} y1={base} y2={base} className="stroke-separator" />
            {maxIndex >= 0 ? (
              <text x={maxX} y={y(max) - 6} textAnchor="middle" className={valueText}>
                {maxLabel}
              </text>
            ) : null}
            {ticksShown.map((day) => (
              <text key={day} x={centerOf(day)} y={height - 6} textAnchor="middle" className={tickText}>
                {tickLabel(day)}
              </text>
            ))}
            <text x={centerOf(today)} y={height - 6} textAnchor="middle" className={valueText}>
              {labels.today}
            </text>
          </>
        )
      }}
    </ChartFrame>
  )
}

// ---------- BreakdownChart ----------

export type BreakdownPart = { label: string; amount: number }

/**
 * Where a whole flows, as a horizontal waterfall: the whole as a chart-muted-strong
 * bar, each deduction as a floating chart-muted segment that eats into what is
 * left, and the remainder in brand-500. Every row names its amount, so no tooltip
 * is needed and the rows themselves are the text equivalent. A negative remainder
 * draws no bar and shows its amount in danger-text with a warning icon.
 *
 * Amounts arrive as cents; deductions are positive and shown via formatMoney(-x).
 * The caller computes the remainder (the component never does budget arithmetic).
 */
export function BreakdownChart({
  title,
  whole,
  deductions,
  remainder,
  formatMoney,
}: {
  /** The accessible name; the card header usually shows it too. */
  title: string
  whole: BreakdownPart
  deductions: BreakdownPart[]
  remainder: BreakdownPart
  formatMoney: FormatMoney
}) {
  const scale = Math.max(1, whole.amount, deductions.reduce((sum, part) => sum + part.amount, 0))
  const percent = (cents: number) => `${(Math.max(0, cents) / scale) * 100}%`
  // Each deduction floats where the previous ones left off, counting down from the whole.
  const rows = deductions.map((part, index) => {
    const to = whole.amount - deductions.slice(0, index).reduce((sum, earlier) => sum + earlier.amount, 0)
    return { part, from: to - part.amount, to }
  })

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{title}</figcaption>
      <ul className="hairline-rows">
        <BreakdownRow label={whole.label} amount={formatMoney(whole.amount)}>
          <span className="absolute inset-y-0 left-0 rounded-xs bg-chart-muted-strong" style={{ width: percent(whole.amount) }} />
        </BreakdownRow>
        {rows.map(({ part, from, to }) => (
          <BreakdownRow key={part.label} label={part.label} amount={formatMoney(-part.amount)}>
            <span
              className="absolute inset-y-0 rounded-xs bg-chart-muted"
              style={{ left: percent(from), width: percent(Math.min(to, scale) - Math.max(0, from)) }}
            />
          </BreakdownRow>
        ))}
        <BreakdownRow label={remainder.label} amount={formatMoney(remainder.amount)} total negative={remainder.amount < 0}>
          {remainder.amount > 0 ? (
            <span className="absolute inset-y-0 left-0 rounded-xs bg-brand-500" style={{ width: percent(remainder.amount) }} />
          ) : null}
        </BreakdownRow>
      </ul>
    </figure>
  )
}

function BreakdownRow({
  label,
  amount,
  total = false,
  negative = false,
  children,
}: {
  label: string
  amount: string
  total?: boolean
  negative?: boolean
  children: ReactNode
}) {
  return (
    <li
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2.5 lg:min-h-[34px] lg:grid-cols-[11rem_minmax(0,1fr)_7rem] lg:py-1",
        total && "font-semibold",
      )}
    >
      <span className="col-start-1 row-start-1 truncate">{label}</span>
      <span aria-hidden className="relative col-span-2 col-start-1 row-start-2 h-3.5 lg:col-span-1 lg:col-start-2 lg:row-start-1">
        {children}
      </span>
      <span className={cn("col-start-2 row-start-1 inline-flex items-center justify-end gap-1 text-right tabular-nums whitespace-nowrap lg:col-start-3", negative && "text-danger-text")}>
        {negative ? <IconAlertTriangle className="size-3.5 [stroke-width:2]" aria-hidden /> : null}
        {amount}
      </span>
    </li>
  )
}
