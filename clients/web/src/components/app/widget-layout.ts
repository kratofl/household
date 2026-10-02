// The grid arithmetic behind the widget board: which cell a pointer is over, and
// how a layout changes when the user moves, resizes, adds or removes a widget.
// No DOM and no React, so the board's behaviour can be exercised on its own.

export const MIN_COLUMNS = 12
export const MAX_COLUMNS = 24
export const ROW_HEIGHT = 44
export const GRID_GAP = 12

/** One widget on the board. `key` is the instance, `widget` points at the definition. */
export type Placement = { key: string; widget: string; x: number; y: number; w: number; h: number; text?: string }
export type Layout = { columns: number; items: Placement[] }

/** The part of a widget definition the layout cares about. */
export type WidgetSize = { id: string; w: number; h: number }

export function overlaps(a: Placement, b: Placement) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/** Columns actually needed, never below the base width. */
export function neededColumns(items: Placement[]) {
  return Math.max(MIN_COLUMNS, ...items.map((item) => item.x + item.w))
}

/** Rows the grid has to show, plus room to drop something below the last widget. */
export function rowCount(items: Placement[], editing: boolean) {
  return Math.max(1, ...items.map((item) => item.y + item.h)) + (editing ? 2 : 0)
}

/** Stacks the default widgets full width, in the order the module listed them. */
export function defaultLayout(widgets: WidgetSize[], defaultIds: string[]): Layout {
  let y = 0
  const items = defaultIds.flatMap((id) => {
    const widget = widgets.find((candidate) => candidate.id === id)
    if (!widget) return []
    const placement: Placement = { key: widget.id, widget: widget.id, x: 0, y, w: widget.w, h: widget.h }
    y += widget.h
    return [placement]
  })
  return { columns: MIN_COLUMNS, items }
}

/**
 * The cell under a pointer, relative to the board's box. Beyond the right edge it
 * keeps counting, which is what grows the grid.
 */
export function cellAt(box: { left: number; top: number; width: number }, columns: number, clientX: number, clientY: number) {
  const columnWidth = (box.width - GRID_GAP * (columns - 1)) / columns
  return {
    x: Math.floor((clientX - box.left) / (columnWidth + GRID_GAP)),
    y: Math.max(0, Math.floor((clientY - box.top) / (ROW_HEIGHT + GRID_GAP))),
  }
}

/** Writes a placement if nothing else is already sitting there. */
export function put(layout: Layout, key: string, next: Omit<Placement, "key" | "widget" | "text">): Layout {
  const item = layout.items.find((candidate) => candidate.key === key)
  if (!item) return layout
  const moved: Placement = { ...item, ...next }
  if (moved.x + moved.w > MAX_COLUMNS) return layout
  if (layout.items.some((other) => other.key !== key && overlaps(moved, other))) return layout
  const items = layout.items.map((candidate) => (candidate.key === key ? moved : candidate))
  return { columns: Math.min(MAX_COLUMNS, neededColumns(items)), items }
}

/** Drops a widget where the pointer is, or at the bottom when there is no target. */
export function place(layout: Layout, widget: WidgetSize, key: string, repeatable: boolean, at?: { x: number; y: number }): Layout {
  if (!repeatable && layout.items.some((item) => item.widget === widget.id)) return layout
  const bottom = Math.max(0, ...layout.items.map((item) => item.y + item.h))
  const target: Placement = {
    key,
    widget: widget.id,
    x: at ? Math.max(0, Math.min(layout.columns - widget.w, at.x)) : 0,
    y: at ? Math.max(0, at.y) : bottom,
    w: widget.w,
    h: widget.h,
  }
  const free = !layout.items.some((other) => overlaps(target, other))
  const items = [...layout.items, free ? target : { ...target, x: 0, y: bottom }]
  return { columns: Math.min(MAX_COLUMNS, neededColumns(items)), items }
}

export function removeItem(layout: Layout, key: string): Layout {
  const items = layout.items.filter((item) => item.key !== key)
  return { columns: neededColumns(items), items }
}

/** Where the grab landed inside the widget, so a tile does not jump under the cursor. */
export function grabOffset(item: Placement, cell: { x: number; y: number } | null) {
  return {
    grabX: cell ? Math.max(0, Math.min(item.w - 1, cell.x - item.x)) : 0,
    grabY: cell ? Math.max(0, Math.min(item.h - 1, cell.y - item.y)) : 0,
  }
}
