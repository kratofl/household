"use client"

// A dashboard laid out on a real grid: every widget has a position and a size in
// grid cells, so the user places things exactly where they want them. Boards are
// device-local, stored in localStorage under `household.widgets.<boardId>`.
//
// The grid is as wide as the page. Dragging past the right edge adds columns, so
// the cells get narrower and the page never scrolls sideways. Dragging downward
// adds rows and the page gets taller, which is what scrolling is for.
//
// Below the `sm` breakpoint there is no room for a 12-column grid, so tiles stack
// in reading order at their natural height and only add/remove stays available.

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

/** One widget on the board. `key` is the instance, `widget` points at the definition. */
type Placement = { key: string; widget: string; x: number; y: number; w: number; h: number; text?: string }
type Layout = { columns: number; items: Placement[] }

/**
 * What the pointer is doing. `grabX`/`grabY` keep the cell the user grabbed under
 * the cursor, so a tile does not jump its top-left corner to the pointer.
 */
type Gesture =
  | { kind: "move"; key: string; widget: string; placed: boolean; grabX: number; grabY: number }
  | { kind: "resize"; key: string }

const MIN_COLUMNS = 12
const MAX_COLUMNS = 24
const ROW_HEIGHT = 44
const GRID_GAP = 12

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

/**
 * Packs the default widgets left to right in the order the module listed them,
 * wrapping to a new row when the next one no longer fits. Widgets carry their
 * own width, so three quarter-width cards sit side by side instead of each
 * taking a row of its own.
 */
function defaultLayout(widgets: WidgetDefinition[], defaultIds: string[]): Layout {
  let x = 0
  let y = 0
  let rowHeight = 0
  const items = defaultIds.flatMap((id) => {
    const widget = widgets.find((candidate) => candidate.id === id)
    if (!widget) return []
    const w = Math.min(widget.w, MIN_COLUMNS)
    if (x + w > MIN_COLUMNS) {
      x = 0
      y += rowHeight
      rowHeight = 0
    }
    const placement: Placement = { key: widget.id, widget: widget.id, x, y, w, h: widget.h }
    x += w
    rowHeight = Math.max(rowHeight, widget.h)
    return [placement]
  })
  return { columns: MIN_COLUMNS, items }
}

/** Repeatable elements get a fresh instance per copy; everything else is a singleton. */
function instanceKey(widget: WidgetDefinition) {
  return widget.repeatable ? `${widget.id}:${uuid()}` : widget.id
}

function overlaps(a: Placement, b: Placement) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/** Columns actually needed, never below the base width. */
function neededColumns(items: Placement[]) {
  return Math.max(MIN_COLUMNS, ...items.map((item) => item.x + item.w))
}

export function WidgetBoard({
  boardId,
  widgets,
  defaultIds,
  t,
}: {
  boardId: string
  widgets: WidgetDefinition[]
  defaultIds: string[]
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
    const source = layout ?? defaultLayout(widgets, defaultIds)
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

  /** Writes a placement if nothing else is already sitting there. */
  const put = (key: string, next: Omit<Placement, "key" | "widget" | "text">) => {
    commit((value) => {
      const item = value.items.find((candidate) => candidate.key === key)
      if (!item) return value
      const moved: Placement = { ...item, ...next }
      if (moved.x + moved.w > MAX_COLUMNS) return value
      if (value.items.some((other) => other.key !== key && overlaps(moved, other))) return value
      const items = value.items.map((candidate) => (candidate.key === key ? moved : candidate))
      return { columns: Math.min(MAX_COLUMNS, neededColumns(items)), items }
    })
  }

  const remove = (key: string) =>
    commit((value) => {
      const items = value.items.filter((item) => item.key !== key)
      return { columns: neededColumns(items), items }
    })

  const setText = (key: string, text: string) =>
    commit((value) => ({ ...value, items: value.items.map((item) => (item.key === key ? { ...item, text } : item)) }))

  /** Drops a widget where the pointer is, or at the bottom when there is no target. */
  const place = (widget: WidgetDefinition, key: string, at?: { x: number; y: number }) => {
    commit((value) => {
      if (!widget.repeatable && value.items.some((item) => item.widget === widget.id)) return value
      const bottom = Math.max(0, ...value.items.map((item) => item.y + item.h))
      const target: Placement = {
        key,
        widget: widget.id,
        x: at ? Math.max(0, Math.min(value.columns - widget.w, at.x)) : 0,
        y: at ? Math.max(0, at.y) : bottom,
        w: widget.w,
        h: widget.h,
      }
      const free = !value.items.some((other) => overlaps(target, other))
      const items = [...value.items, free ? target : { ...target, x: 0, y: bottom }]
      return { columns: Math.min(MAX_COLUMNS, neededColumns(items)), items }
    })
  }

  /** The cell under the pointer. Beyond the right edge it keeps counting, which is what grows the grid. */
  const cellAt = (clientX: number, clientY: number) => {
    const box = board.current?.getBoundingClientRect()
    if (!box) return null
    const columnWidth = (box.width - GRID_GAP * (columns - 1)) / columns
    return {
      x: Math.floor((clientX - box.left) / (columnWidth + GRID_GAP)),
      y: Math.max(0, Math.floor((clientY - box.top) / (ROW_HEIGHT + GRID_GAP))),
    }
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
    const cell = cellAt(event.clientX, event.clientY)
    setGesture({
      kind: "move",
      key: item.key,
      widget: item.widget,
      placed: true,
      grabX: cell ? Math.max(0, Math.min(item.w - 1, cell.x - item.x)) : 0,
      grabY: cell ? Math.max(0, Math.min(item.h - 1, cell.y - item.y)) : 0,
    })
  }

  const placedIds = new Set(layout.items.map((item) => item.widget))
  const unplaced = widgets.filter((widget) => widget.repeatable || !placedIds.has(widget.id))
  const dragged = gesture?.kind === "move" ? widgets.find((widget) => widget.id === gesture.widget) : undefined
  const rows = Math.max(1, ...layout.items.map((item) => item.y + item.h)) + (editing ? 2 : 0)
  const gridStyle: CSSProperties = compact
    ? { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: GRID_GAP }
    : {
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridAutoRows: `${ROW_HEIGHT}px`,
        gap: GRID_GAP,
      }

  const ordered = compact
    ? [...layout.items].sort((a, b) => a.y - b.y || a.x - b.x)
    : layout.items

  return (
    <div className={cn("space-y-4", editing && "pb-[46vh] lg:pb-0 lg:pr-[272px]")}>
      {!editing ? (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <IconLayoutGrid />
            {t("widgets.customize")}
          </Button>
        </div>
      ) : null}

      <div ref={board} className="relative" onPointerMove={onPointerMove}>
        {editing && !compact ? (
          <div aria-hidden className="pointer-events-none absolute inset-0" style={gridStyle}>
            {Array.from({ length: columns * rows }, (_, index) => (
              <div key={index} className="rounded-[4px] border border-dashed border-primary/25 bg-primary/[0.03]" />
            ))}
          </div>
        ) : null}

        <div style={gridStyle}>
          {ordered.map((item) => {
            const widget = widgets.find((candidate) => candidate.id === item.widget)
            if (!widget) return null
            const moving = gesture?.kind === "move" && gesture.key === item.key
            const cellStyle: CSSProperties = compact
              ? {}
              : { gridColumn: `${item.x + 1} / span ${item.w}`, gridRow: `${item.y + 1} / span ${item.h}` }
            return (
              <div
                key={item.key}
                style={cellStyle}
                onPointerDown={editing && !widget.repeatable ? (event) => startMove(event, item) : undefined}
                className={cn(
                  "relative min-w-0",
                  editing && "rounded-[12px] ring-1 ring-primary/50",
                  editing && !compact && !widget.repeatable && "cursor-grab active:cursor-grabbing",
                  moving && "rounded-[12px] border-2 border-dashed border-primary bg-primary/10 ring-0",
                )}
              >
                {editing ? (
                  <div className="glass-strong absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-full p-1">
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
                          if (event.key === "ArrowLeft") put(item.key, { ...item, x: Math.max(0, item.x - 1) })
                          if (event.key === "ArrowRight") put(item.key, { ...item, x: item.x + 1 })
                          if (event.key === "ArrowUp") put(item.key, { ...item, y: Math.max(0, item.y - 1) })
                          if (event.key === "ArrowDown") put(item.key, { ...item, y: item.y + 1 })
                        }}
                        className="flex size-7 cursor-grab touch-none items-center justify-center rounded-full text-muted-foreground hover:bg-fill-3 hover:text-foreground"
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
                      className="flex size-7 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
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
                      if (event.key === "ArrowLeft") put(item.key, { ...item, w: Math.max(1, item.w - 1) })
                      if (event.key === "ArrowRight") put(item.key, { ...item, w: item.w + 1 })
                      if (event.key === "ArrowUp") put(item.key, { ...item, h: Math.max(1, item.h - 1) })
                      if (event.key === "ArrowDown") put(item.key, { ...item, h: item.h + 1 })
                    }}
                    className={cn(
                      "absolute -right-1 -bottom-1 z-10 size-4 cursor-nwse-resize touch-none rounded-full bg-primary/70",
                      "hover:bg-primary focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                      gesture?.kind === "resize" && gesture.key === item.key && "bg-primary",
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

      {layout.items.length === 0 && !editing ? <p className="text-muted-foreground">{t("widgets.empty")}</p> : null}

      {editing ? (
        <WidgetTray
          widgets={unplaced}
          dragId={gesture?.kind === "move" && !gesture.placed ? gesture.widget : null}
          t={t}
          onPick={(widget) => place(widget, instanceKey(widget))}
          onGrab={(widget) =>
            setGesture({ kind: "move", key: "", widget: widget.id, placed: false, grabX: 0, grabY: 0 })
          }
          onReset={() => commit(() => defaultLayout(widgets, defaultIds))}
          onDone={() => setEditing(false)}
        />
      ) : null}

      {dragged
        ? createPortal(
            <div
              ref={ghost}
              aria-hidden
              className="glass-strong pointer-events-none fixed top-0 left-0 z-50 flex items-center gap-2 rounded-full px-3 py-1.5 font-medium"
            >
              <IconGripVertical className="size-4 text-muted-foreground" />
              {dragged.title}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

/**
 * The floating tray of widgets that are not on the board. Household-wide elements
 * come first, then one collapsible section per module. Each widget is a card you
 * drag onto the grid, or tap to append.
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
      className="glass-strong fixed inset-x-2 bottom-20 z-30 flex max-h-[44vh] flex-col rounded-2xl lg:inset-x-auto lg:bottom-3 lg:right-3 lg:top-[64px] lg:max-h-none lg:w-[272px]"
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <IconLayoutGrid className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-semibold">{t("widgets.add")}</span>
        <Button onClick={onDone}>
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
        {widgets.length === 0 ? <p className="px-2 py-3 text-muted-foreground">{t("widgets.allAdded")}</p> : null}
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
        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:bg-fill-3"
      >
        <IconChevronRight className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")} strokeWidth={2.2} />
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
                  "flex w-full cursor-grab touch-none items-start gap-2 rounded-[10px] bg-fill-3 p-2.5 text-left transition-colors select-none",
                  "shadow-[0_0_0_0.5px_var(--hairline)] hover:bg-fill-2 active:cursor-grabbing",
                  dragId === widget.id && "opacity-50 ring-2 ring-primary",
                )}
              >
                <IconGripVertical className="mt-px size-4 shrink-0 text-muted-foreground/70" />
                <span className="min-w-0 flex-1 font-medium">{widget.title}</span>
                <IconPlus className="mt-px size-4 shrink-0 text-primary" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
