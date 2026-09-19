# ADR 0055: Budget Home Prioritizes the Current Period

- Status: Accepted
- Date: 2026-07-16

## Context

The Budget slice contains transactions, recurring plans, reservations, savings,
investments, and historical reports. Showing every workflow on one page would
make the most common question—what can I still spend now?—harder to answer.

## Decision

The Budget landing page prioritizes a compact overview of the current Budget
period with:

- ordinary spending still available and its category bar;
- expected versus actual income;
- upcoming fixed costs, subscriptions, and reservations;
- current protected buffer; and
- savings-goal and investment progress.

Detailed editing, transaction history, planning, and reporting live in focused
Budget subpages.

## Consequences

- The landing page favors scanning and drill-down over large inline forms.
- Every summary value links to the detailed records that explain it.
- Forecast and actual values remain visually distinct.
- Empty, loading, error, and no-income states must remain useful rather than
  rendering misleading zeroes.
- Mobile layout preserves the same information priority.
