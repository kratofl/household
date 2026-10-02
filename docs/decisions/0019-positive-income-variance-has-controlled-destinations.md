# ADR 0019: Positive Income Variance Has Controlled Destinations

- Status: Accepted
- Date: 2026-07-14

## Context

After actual income exceeds its expected amount, the resulting positive variance
needs a purpose. Users may want to retain it safely, spend it during the current
period, or direct it toward longer-term plans.

## Decision

Positive income variance can be routed to:

- unallocated buffer;
- the current period's ordinary spending availability;
- one or more savings goals; or
- one or more investment allocations.

Routing may split the amount using fixed amounts or percentages. Any unassigned
or rounding remainder goes to unallocated buffer. The system default remains
unallocated buffer.

## Consequences

- Extra income never disappears into an unexplained total.
- Releasing extra income for spending is explicit and visibly changes the current
  period's funded availability.
- Savings and investment portions follow the exclusive-allocation rules.
- Forecast routing can show intent, while actual allocations use the actual
  positive variance received.
