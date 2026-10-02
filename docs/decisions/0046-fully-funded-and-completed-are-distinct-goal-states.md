# ADR 0046: Fully Funded and Completed Are Distinct Goal States

- Status: Accepted
- Date: 2026-07-15

## Context

Reaching a savings target means enough money has been allocated, but the planned
purchase may not have happened yet. Marking the goal complete at 100 percent
would hide it prematurely and make later price changes awkward.

## Decision

A goal that reaches its target enters a **Fully funded** state. It becomes
**Completed** only after the linked purchase occurs or the user explicitly closes
the goal.

## Consequences

- Fully funded goals remain visible in active purchase planning.
- The user may update the target amount before purchase; status recalculates from
  the effective target and allocated balance.
- Completed goals move to history while retaining contributions, allocations,
  purchases, and any remainder disposition.
- Explicitly closing a goal without a purchase requires choosing where remaining
  allocated money goes.
- Recurring-contribution behavior after full funding is defined by ADR 0047.
