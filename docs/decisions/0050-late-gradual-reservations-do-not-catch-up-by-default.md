# ADR 0050: Late Gradual Reservations Do Not Catch Up by Default

- Status: Accepted
- Date: 2026-07-16

## Context

A user may create a gradually reserved commitment shortly before its first due
date. Compressing a full yearly amount into the remaining periods would defeat
the user's choice to reserve a smaller regular amount and could unexpectedly
destroy the current Budget.

## Decision

When a gradual-reservation plan is created late, Budget starts its normal
full-cycle reservation amount prospectively. It does not increase that regular
amount to catch up before the first due date.

Budget clearly warns that the first occurrence will not be fully covered by the
new reserve and shows the projected shortfall.

The default does not deduct that first shortfall additionally from ordinary
spending availability. The user may explicitly enable a per-item option that
charges the remaining shortfall to ordinary spending in the first due period.

After the first occurrence, the next cycle uses the normal complete reservation
schedule.

## Consequences

- Late entry never causes a surprising automatic catch-up deduction.
- Forecasts show normal reservation, accumulated amount, and first-occurrence
  shortfall separately.
- The optional due-period shortfall charge must be visibly confirmed and is not
  the default.
- The first occurrence remains visible for its full transaction amount, while
  its Budget impact follows the selected reservation behavior.
- The uncovered first-occurrence remainder needs no invented funding source and
  does not make the reserve negative.
