# ADR 0048: Savings Goals Support Date- or Rate-Driven Planning

- Status: Accepted
- Date: 2026-07-15

## Context

Some users know when they need a target amount and want to know the required
contribution. Others know what they can afford per interval and want to know when
the goal will be funded. Requiring both rate and date as fixed inputs can create
an impossible or contradictory plan.

## Decision

A savings goal supports two planning modes:

- **Date-driven:** the user provides target amount and target date; Budget
  calculates the required recurring contribution.
- **Rate-driven:** the user provides target amount and recurring contribution;
  Budget forecasts the funding date.

The calculated value remains visible but is not an independent fixed constraint.

## Consequences

- Changing target amount, existing allocation, recurrence, date, or rate updates
  the derived plan immediately.
- Calculations use the user's configured Budget-period boundaries and recurrence
  calendar.
- Rounding never schedules a final contribution above the remaining target;
  the last expected contribution may be smaller.
- Actual progress can diverge from the plan and requires a separate replanning
  rule.
