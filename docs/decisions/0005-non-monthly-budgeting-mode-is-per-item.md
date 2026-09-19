# ADR 0005: Non-Monthly Budgeting Mode Is Per Item

- Status: Accepted
- Date: 2026-07-14

## Context

Non-monthly fixed costs and subscriptions can affect available spending in two
useful ways. The whole amount can affect the period in which payment is due, or
money can be reserved gradually across earlier periods. One user may need both
behaviors for different commitments.

## Decision

Each applicable recurring item has its own budgeting mode:

- **Due period:** the full amount reduces available spending when it is due.
- **Gradual reservation:** portions reduce available spending in earlier periods,
  accumulate as a reserve for that item, and are consumed by the eventual
  payment without double-counting it.

A change to an item's budgeting mode follows the effective-dating rules for
recurring plans and does not recalculate historical periods.

## Consequences

- A single Budget can mix due-period and gradual-reservation commitments.
- Forecasts must distinguish ordinary available money from amounts reserved for
  future commitments.
- An eventual payment linked to a reserve consumes that reserve rather than
  appearing as a second reduction of available spending.
- Reservation allocation, handling of incomplete lead time, and any creation-form
  default remain implementation decisions to refine.
