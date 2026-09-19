# ADR 0068: Dashboards Are Arrangeable Widget Boards

- Status: Accepted
- Date: 2026-09-16

## Context

The global dashboard showed one fixed Budget card, and the Budget overview
showed a fixed stack of sections. As more modules ship, a fixed layout either
grows without bound or hides what a given household actually looks at.

## Decision

The global dashboard and each module's overview are widget boards. A module
contributes widget definitions; a board places them, and the user adds, removes,
reorders, and resizes widgets in an explicit edit mode. Widgets render their own
heading and the board supplies the frame, so a widget looks the same whether it
sits on a module overview or on the global dashboard.

While editing, the widgets that are not placed wait in a floating tray on the
right, grouped by the module they come from, with household-wide widgets first.
A widget moves onto the board by dragging it out of the tray or by tapping it.

Layouts are device-local, stored in `localStorage` under
`household.widgets.<boardId>`, like the appearance and language preferences.
A board falls back to its module's default arrangement when nothing is stored
and drops widget ids the current release no longer defines.

## Consequences

- A phone and a desktop can show different arrangements of the same board,
  which is usually what the user wants; the layout does not follow the account
  to a new device.
- Adding a widget to a module needs no backend change and no migration.
- Reordering works by pointer drag and by arrow keys on the drag handle, so the
  board stays keyboard-operable and usable on touch.
- Widgets must tolerate a narrower column than their default, because the user
  can set any widget to one third width.
- A new module needs no board work: giving its widgets a group name is enough
  for the tray to list them under their own heading.
