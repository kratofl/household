# ADR 0006: Budget Periods Use a User-Selected Start Day

- Status: Accepted
- Date: 2026-07-14

## Context

Calendar months are not the most useful budgeting boundary for every user. Some
users plan from a salary date, while others receive several incomes on different
dates. Deriving boundaries dynamically from income transactions would make
periods unstable and could undermine historical reporting.

## Decision

Each user selects a fixed day of the month on which their Budget period begins.
The default is the first day of the month.

A period runs from the selected start day through the day before the same
boundary in the following month. For example, a start day of the 25th produces a
period from the 25th through the 24th.

The selected boundary is configuration, not a dynamic consequence of actual
income arrival dates.

## Consequences

- Income occurrences are assigned to periods by their dates but do not determine
  period boundaries.
- Multiple incomes and minor payday changes do not shift a period unexpectedly.
- A change to the configured start day must preserve existing historical period
  boundaries and apply prospectively.
- The valid range and short-month behavior for late-month start days must be
  defined during implementation design.
