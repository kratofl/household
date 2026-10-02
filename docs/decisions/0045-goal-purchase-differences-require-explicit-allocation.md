# ADR 0045: Goal-Purchase Differences Require Explicit Allocation

- Status: Accepted
- Date: 2026-07-15

## Context

The actual price of a planned purchase may differ from the funded savings-goal
amount. Silently absorbing the difference could overdraw a goal or unexpectedly
consume protected money.

## Decision

If a goal-funded purchase costs less than its available goal allocation, the
unused amount remains in that goal until the user explicitly reallocates it.

If the purchase costs more, the user must fund the shortfall explicitly from
ordinary spending availability, buffer, or another eligible reserve. A goal may
not become negative implicitly.

## Consequences

- The purchase workflow shows funded amount, price, difference, and selected
  source before confirmation.
- Reallocating leftover goal money remains a traceable allocation action.
- A split-funded purchase records each funding source without duplicating the
  actual expense.
- If no sufficient source is selected, Budget prevents confirmation rather than
  creating unfunded availability.
