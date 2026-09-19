# ADR 0012: One Contribution Can Fund Several Goals

- Status: Accepted
- Date: 2026-07-14

## Context

A user may make one real transfer to a savings account while intending portions
of it for several goals. Requiring a separate bank transfer for every goal would
make the physical account ledger unnecessarily cumbersome.

ADR 0011 still requires every unit of saved money to belong to at most one goal.

## Decision

One savings contribution may be split across several goal allocations using
fixed amounts or percentages. Each resulting portion is exclusively allocated to
one goal. Any remainder stays visibly unallocated as a general buffer.

## Consequences

- One physical transfer can fulfill several savings plans without duplicating
  ledger entries.
- Allocation amounts may not exceed the actual contribution being allocated.
- Percentage allocations require deterministic rounding, with any remainder
  left unallocated.
- Forecast allocations are based on the expected contribution; actual goal
  progress is based on the actual posted contribution.
- Later allocation changes remain explicit, historically traceable actions.
