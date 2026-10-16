"use client"

// A dashboard laid out on a real grid: every widget has a position and a size in
// grid cells, so the user places things exactly where they want them. Boards are
// device-local, stored in localStorage under `household.widgets.<boardId>`.
//
// The grid is as wide as the page. Dragging past the right edge adds columns, so
// the cells get narrower and the page never scrolls sideways. Dragging downward
// adds rows and the page gets taller, which is what scrolling is for.
//
// Below the `sm` breakpoint there is no room for a 12-column grid, so tiles flow
// in reading order (top to bottom, then left to right) on two columns at their
// natural height: quarter-width widgets take one column, so they sit 2×2,
// anything wider takes both. Only add/remove stays available there.
//
// Pages pass their default arrangement as positions; the grid arithmetic lives in
// widget-layout.ts. A page that drops widgets from its registry bumps its board id
// so saved boards that referred to them start over from the new default.
//
// Outside editing, rows take the height of their content, so an empty list or a
// short card leaves no gap under it. Editing switches to fixed-height rows,
// because that is the grid the user drags on.

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  IconCheck,
  IconChevronRight,
  IconGripVertical,
  IconLayoutGrid,
  IconPlus,
  IconRestore,
  IconX,
} from "@tabler/icons-react"

import { ToolbarButton } from "@/components/app/toolbar"
import {
  cellAt as cellUnder,
  defaultLayout,
  grabOffset,
  GRID_GAP,
  MAX_COLUMNS,
  MIN_COLUMNS,
  neededColumns,
  place as placeWidget,
  put as putPlacement,
  removeItem,
  ROW_HEIGHT,
  rowCount,
  type Layout,
  type Placement,
  type WidgetPosition,
} from "@/components/app/widget-layout"
import { Button } from "@/components/ui/button"
import type { Translator } from "@/lib/i18n"
import { uuid } from "@/lib/uuid"
import { cn } from "@/lib/utils"

/** What a widget can do with the text it owns; only the structural elements use it. */
export type WidgetInstance = {
  text: string
  setText: (value: string) => void
  editing: boolean
}

export type WidgetDefinition = {
  id: string
  /** Accessible name, shown in the tray and in the edit controls. */
  title: string
  /** Default size in grid cells. */
  w: number
  h: number
  /** Module this widget belongs to. Omitted for household-wide elements, which the tray lists first. */
  group?: string
  /** Several copies may live on one board. True for dividers, headings and labels. */
  repeatable?: boolean
  render: (instance: WidgetInstance) => ReactNode
}

/**
 * What the pointer is doing. `grabX`/`grabY` keep the cell the user grabbed under
 * the cursor, so a tile does not jump its top-left corner to the pointer.
 */
type Gesture =
  | { kind: "move"; key: string; widget: string; placed: boolean; grabX: number; grabY: number }
  | { kind: "resize"; key: string }

function storageKey(boardId: string) {
  return `household.widgets.${boardId}`
}

function isPlacement(value: unknown): value is Placement {
  if (typeof value !== "object" || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.key === "string" &&
    typeof item.widget === "string" &&
    [item.x, item.y, item.w, item.h].every((n) => typeof n === "number" && Number.isFinite(n))
  )
}

/** Stored layout, or null when there is nothing usable saved (including the older flow layout). */
function readLayout(boardId: string): Layout | null {
  try {
    const raw = window.localStorage.getItem(storageKey(boardId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null || !("items" in parsed)) return null
    const { columns, items } = parsed as { columns?: unknown; items?: unknown }
    if (!Array.isArray(items)) return null
    return {
      columns: typeof columns === "number" && columns >= MIN_COLUMNS ? Math.min(MAX_COLUMNS, columns) : MIN_COLUMNS,
      items: items.filter(isPlacement),
    }
  } catch {
    return null
  }
}

/** Repeatable elements get a fresh instance per copy; everything else is a singleton. */
function instanceKey(widget: WidgetDefinition) {
  return widget.repeatable ? `${widget.id}:${uuid()}` : widget.id
}

export function WidgetBoard({
  boardId,
  widgets,
  defaults,
  header,
  t,
}: {
  boardId: string
  widgets: WidgetDefinition[]
  /** The arrangement of a fresh board, and what Reset restores. */
  defaults: WidgetPosition[]
  /** The page's toolbar content. Receives the Customize icon action (null while editing) to place in its icon group. */
  header: (customize: ReactNode) => ReactNode
  t: Translator
}) {
  const [stored, setStored] = useState<{ boardId: string; layout: Layout } | null>(null)
  const [editing, setEditing] = useState(false)
  const [gesture, setGesture] = useState<Gesture | null>(null)
  const [compact, setCompact] = useState(false)
  const board = useRef<HTMLDivElement | null>(null)
  const ghost = useRef<HTMLDivElement | null>(null)

  // Read after mount, like the locale in the app shell: these pages are
  // pre-rendered, so localStorage must not influence the first paint.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const layout = readLayout(boardId)
      if (layout) setStored({ boardId, layout })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [boardId])

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)")
    const sync = () => setCompact(query.matches)
    const timer = window.setTimeout(sync, 0)
    query.addEventListener("change", sync)
    return () => {
      window.clearTimeout(timer)
      query.removeEventListener("change", sync)
    }
  }, [])

  // A gesture can start in the tray and end anywhere, so the pointer is followed
  // on the window. The ghost is moved by hand instead of through state: it would
  // otherwise re-render the whole board on every pixel.
  useEffect(() => {
    if (!gesture) return
    const track = (event: PointerEvent) => {
      if (ghost.current) ghost.current.style.transform = `translate3d(${event.clientX + 14}px, ${event.clientY + 14}px, 0)`
    }
    const stop = () => setGesture(null)
    window.addEventListener("pointermove", track)
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
    return () => {
      window.removeEventListener("pointermove", track)
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
    }
  }, [gesture])

  useEffect(() => {
    if (stored?.boardId === boardId) window.localStorage.setItem(storageKey(boardId), JSON.stringify(stored.layout))
  }, [boardId, stored])

  // Widgets can disappear between releases; keep only ids the registry still has.
  const current = (layout: Layout | undefined): Layout => {
    const source = layout ?? defaultLayout(widgets, defaults)
    return { ...source, items: source.items.filter((item) => widgets.some((widget) => widget.id === item.widget)) }
  }
  const layout = current(stored?.boardId === boardId ? stored.layout : undefined)
  const columns = Math.max(layout.columns, neededColumns(layout.items))

  // Always edits the latest layout, so a drag that fires several updates before a
  // repaint does not fold them into one.
  const commit = (update: (layout: Layout) => Layout) => {
    setStored((previous) => ({
      boardId,
      layout: update(current(previous?.boardId === boardId ? previous.layout : undefined)),
    }))
  }

  const put = (key: string, next: Omit<Placement, "key" | "widget" | "text">) => commit((value) => putPlacement(value, key, next))

  const remove = (key: string) => commit((value) => removeItem(value, key))

  const setText = (key: string, text: string) =>
    commit((value) => ({ ...value, items: value.items.map((item) => (item.key === key ? { ...item, text } : item)) }))

  /** Drops a widget where the pointer is, or at the bottom when there is no target. */
  const place = (widget: WidgetDefinition, key: string, at?: { x: number; y: number }) =>
    commit((value) => placeWidget(value, widget, key, widget.repeatable ?? false, at))

  /** The cell under the pointer. Beyond the right edge it keeps counting, which is what grows the grid. */
  const cellAt = (clientX: number, clientY: number) => {
    const box = board.current?.getBoundingClientRect()
    return box ? cellUnder(box, columns, clientX, clientY) : null
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!gesture || compact) return
    const cell = cellAt(event.clientX, event.clientY)
    if (!cell) return

    if (gesture.kind === "resize") {
      const item = layout.items.find((candidate) => candidate.key === gesture.key)
      if (!item) return
      put(item.key, {
        x: item.x,
        y: item.y,
        w: Math.max(1, Math.min(MAX_COLUMNS - item.x, cell.x - item.x + 1)),
        h: Math.max(1, cell.y - item.y + 1),
      })
      return
    }

    if (!gesture.placed) {
      const widget = widgets.find((candidate) => candidate.id === gesture.widget)
      if (!widget) return
      // The instance only exists from here on, so the gesture adopts its key and
      // the same drag keeps moving it.
      const key = instanceKey(widget)
      place(widget, key, { x: cell.x, y: cell.y })
      setGesture({ ...gesture, key, placed: true })
      return
    }

    const item = layout.items.find((candidate) => candidate.key === gesture.key)
    if (!item) return
    put(item.key, { x: Math.max(0, cell.x - gesture.grabX), y: Math.max(0, cell.y - gesture.grabY), w: item.w, h: item.h })
  }

  const startMove = (event: ReactPointerEvent<HTMLElement>, item: Placement) => {
    if (compact) return
    // Touch gives the target implicit pointer capture; release it so the board
    // keeps seeing pointermove and can tell which cell is under the pointer.
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setGesture({ kind: "move", key: item.key, widget: item.widget, placed: true, ...grabOffset(item, cellAt(event.clientX, event.clientY)) })
  }

  const placedIds = new Set(layout.items.map((item) => item.widget))
  const unplaced = widgets.filter((widget) => widget.repeatable || !placedIds.has(widget.id))
  const dragged = gesture?.kind === "move" ? widgets.find((widget) => widget.id === gesture.widget) : undefined
  const rows = rowCount(layout.items, editing)
  const gridStyle: CSSProperties = compact
    ? { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: GRID_GAP }
    : {
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridAutoRows: editing ? `${ROW_HEIGHT}px` : "minmax(0, auto)",
        gap: GRID_GAP,
      }

  const ordered = compact
    ? [...layout.items].sort((a, b) => a.y - b.y || a.x - b.x)
    : layout.items

  return (
    <div className={cn("space-y-6", editing && "pb-[46vh] lg:pb-0 lg:pr-[272px]")}>
      {header(
        editing ? null : <ToolbarButton icon={<IconLayoutGrid />} label={t("widgets.customize")} onClick={() => setEditing(true)} />,
      )}

      <div ref={board} className="relative" onPointerMove={onPointerMove}>
        {editing && !compact ? (
          <div aria-hidden className="pointer-events-none absolute inset-0" style={gridStyle}>
            {Array.from({ length: columns * rows }, (_, index) => (
              <div key={index} className="rounded-xs border border-dashed border-brand-500/25 bg-brand-500/[0.03]" />
            ))}
          </div>
        ) : null}

        <div style={gridStyle}>
          {ordered.map((item) => {
            const widget = widgets.find((candidate) => candidate.id === item.widget)
            if (!widget) return null
            const moving = gesture?.kind === "move" && gesture.key === item.key
            const cellStyle: CSSProperties = compact
              ? { gridColumn: item.w <= 3 ? "span 1" : "span 2" }
              : { gridColumn: `${item.x + 1} / span ${item.w}`, gridRow: `${item.y + 1} / span ${item.h}` }
            return (
              <div
                key={item.key}
                style={cellStyle}
                onPointerDown={editing && !widget.repeatable ? (event) => startMove(event, item) : undefined}
                className={cn(
                  "relative min-w-0",
                  editing && "rounded-lg ring-1 ring-brand-500/50",
                  editing && !compact && !widget.repeatable && "cursor-grab active:cursor-grabbing",
                  moving && "rounded-lg border-2 border-dashed border-brand-500 bg-brand-500/10 ring-0",
                )}
              >
                {editing ? (
                  <div className="glass absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-full p-1">
                    {!compact ? (
                      <button
                        type="button"
                        aria-label={t("widgets.move", { name: widget.title })}
                        title={t("widgets.move", { name: widget.title })}
                        onPointerDown={(event) => {
                          event.stopPropagation()
                          startMove(event, item)
                        }}
                        onKeyDown={(event) => {
                          if (event.key.startsWith("Arrow")) event.preventDefault()
                          if (event.key === "ArrowLeft") put(item.key, { ...item, x: Math.max(0, item.x - 1) })
                          if (event.key === "ArrowRight") put(item.key, { ...item, x: item.x + 1 })
                          if (event.key === "ArrowUp") put(item.key, { ...item, y: Math.max(0, item.y - 1) })
                          if (event.key === "ArrowDown") put(item.key, { ...item, y: item.y + 1 })
                        }}
                        className="flex size-7 cursor-grab touch-none items-center justify-center rounded-full text-label-secondary hover:bg-fill hover:text-label"
                      >
                        <IconGripVertical className="size-4" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label={t("widgets.remove", { name: widget.title })}
                      title={t("widgets.remove", { name: widget.title })}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => remove(item.key)}
                      className="flex size-7 items-center justify-center rounded-full text-danger-text hover:bg-red-100 dark:hover:bg-red-500/20 max-sm:size-11"
                    >
                      <IconX className="size-4" />
                    </button>
                  </div>
                ) : null}

                {editing && !compact ? (
                  <button
                    type="button"
                    aria-label={t("widgets.resize", { name: widget.title })}
                    title={t("widgets.resize", { name: widget.title })}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId)
                      }
                      setGesture({ kind: "resize", key: item.key })
                    }}
                    onKeyDown={(event) => {
                      if (event.key.startsWith("Arrow")) event.preventDefault()
                      if (event.key === "ArrowLeft") put(item.key, { ...item, w: Math.max(1, item.w - 1) })
                      if (event.key === "ArrowRight") put(item.key, { ...item, w: item.w + 1 })
                      if (event.key === "ArrowUp") put(item.key, { ...item, h: Math.max(1, item.h - 1) })
                      if (event.key === "ArrowDown") put(item.key, { ...item, h: item.h + 1 })
                    }}
                    className={cn(
                      "absolute -right-1 -bottom-1 z-10 size-4 cursor-nwse-resize touch-none rounded-full bg-brand-500/70 hover:bg-brand-500",
                      gesture?.kind === "resize" && gesture.key === item.key && "bg-brand-500",
                    )}
                  />
                ) : null}

                <div
                  className={cn(
                    "h-full min-w-0 overflow-y-auto",
                    editing && !widget.repeatable && "pointer-events-none select-none",
                    moving && "opacity-0",
                  )}
                >
                  {widget.render({
                    text: item.text ?? "",
                    setText: (value) => setText(item.key, value),
                    editing,
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {layout.items.length === 0 && !editing ? <p className="text-label-secondary">{t("widgets.empty")}</p> : null}

      {editing ? (
        <WidgetTray
          widgets={unplaced}
          dragId={gesture?.kind === "move" && !gesture.placed ? gesture.widget : null}
          t={t}
          onPick={(widget) => place(widget, instanceKey(widget))}
          onGrab={(widget) =>
            setGesture({ kind: "move", key: "", widget: widget.id, placed: false, grabX: 0, grabY: 0 })
          }
          onReset={() => commit(() => defaultLayout(widgets, defaults))}
          onDone={() => setEditing(false)}
        />
      ) : null}

      {dragged
        ? createPortal(
            <div
              ref={ghost}
              aria-hidden
              className="floating pointer-events-none fixed top-0 left-0 z-50 flex items-center gap-2 rounded-full px-3 py-1.5 font-medium shadow-(--shadow-e2)"
            >
              <IconGripVertical className="size-4 text-label-secondary" />
              {dragged.title}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

/**
 * The floating tray of widgets that are not on the board: a solid panel
 * (`.floating`, shadow-e4), not glass, because it carries content. Household-wide
 * elements come first, then one collapsible section per module. Each widget is a
 * card you drag onto the grid, or tap to append.
 */
function WidgetTray({
  widgets,
  dragId,
  t,
  onPick,
  onGrab,
  onReset,
  onDone,
}: {
  widgets: WidgetDefinition[]
  dragId: string | null
  t: Translator
  onPick: (widget: WidgetDefinition) => void
  onGrab: (widget: WidgetDefinition) => void
  onReset: () => void
  onDone: () => void
}) {
  const sections = new Map<string, WidgetDefinition[]>()
  for (const widget of widgets) {
    const key = widget.group ?? ""
    sections.set(key, [...(sections.get(key) ?? []), widget])
  }
  const ordered = [...sections.entries()].sort(([left], [right]) => (left === "" ? -1 : right === "" ? 1 : left.localeCompare(right)))

  // Portalled to the body: the page transition animates a transform, and that
  // makes any ancestor a containing block for position: fixed.
  return createPortal(
    <aside
      aria-label={t("widgets.add")}
      className="floating fixed inset-x-2 bottom-24 z-30 flex max-h-[44vh] flex-col rounded-lg shadow-(--shadow-e4) animate-in fade-in-0 slide-in-from-bottom-4 duration-200 motion-reduce:animate-none lg:inset-x-auto lg:right-3 lg:bottom-3 lg:top-[76px] lg:max-h-none lg:w-[272px] lg:slide-in-from-bottom-0 lg:slide-in-from-right-4"
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <IconLayoutGrid className="size-[18px] shrink-0 text-brand-500" />
        <span className="min-w-0 flex-1 truncate font-semibold">{t("widgets.add")}</span>
        <Button size="sm" onClick={onDone}>
          <IconCheck />
          {t("widgets.done")}
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2">
        {ordered.map(([group, items]) => (
          <TraySection
            key={group}
            label={group || t("widgets.general")}
            items={items}
            dragId={dragId}
            onPick={onPick}
            onGrab={onGrab}
          />
        ))}
        {widgets.length === 0 ? <p className="px-2 py-3 text-label-secondary">{t("widgets.allAdded")}</p> : null}
      </div>

      <div className="p-2">
        <Button variant="ghost" size="sm" className="w-full" onClick={onReset}>
          <IconRestore />
          {t("widgets.reset")}
        </Button>
      </div>
    </aside>,
    document.body,
  )
}

/** One module's widgets in the tray. Open by default; the count stays visible when folded. */
function TraySection({
  label,
  items,
  dragId,
  onPick,
  onGrab,
}: {
  label: string
  items: WidgetDefinition[]
  dragId: string | null
  onPick: (widget: WidgetDefinition) => void
  onGrab: (widget: WidgetDefinition) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1.5 rounded-sm px-1.5 py-1.5 text-caption max-lg:min-h-11 text-label-secondary transition-colors hover:bg-fill"
      >
        <IconChevronRight className={cn("size-3.5 shrink-0 transition-transform [stroke-width:2]", open && "rotate-90")} />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <span className="tabular-nums">{items.length}</span>
      </button>
      {open ? (
        <ul className="mt-1 grid gap-1.5 pb-1">
          {items.map((widget) => (
            <li key={widget.id}>
              <button
                type="button"
                onPointerDown={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId)
                  }
                  onGrab(widget)
                }}
                onClick={() => onPick(widget)}
                className={cn(
                  "flex w-full cursor-grab touch-none items-start gap-2 rounded-md bg-fill p-2.5 text-left transition-colors select-none hover:bg-fill-strong active:cursor-grabbing",
                  dragId === widget.id && "opacity-50 ring-2 ring-brand-500",
                )}
              >
                <IconGripVertical className="mt-0.5 size-4 shrink-0 text-label-secondary" />
                <span className="min-w-0 flex-1 font-medium">{widget.title}</span>
                <IconPlus className="mt-0.5 size-4 shrink-0 text-brand-500" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
