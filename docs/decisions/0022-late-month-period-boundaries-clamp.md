# ADR 0022: Late-Month Period Boundaries Clamp

- Status: Accepted
- Date: 2026-07-14

## Context

A user-selected Budget-period start day may be the 29th, 30th, or 31st, which
does not exist in every month. Rejecting those choices would prevent legitimate
end-of-month salary-oriented periods, while permanently changing the selected
day after February would violate the user's configuration.

## Decision

When the selected period start day does not exist in a month, that month's
boundary uses its final calendar day. Later months return to the originally
selected day whenever it exists.

For example, a selected start day of 31 produces boundaries on January 31,
February 28 (or 29), and March 31.

## Consequences

- All days belong to exactly one period despite varying month lengths.
- The stored preference remains the user's original day, not the temporary
  clamped date.
- Period lengths vary around short months, which is expected and visible.
- Date calculations must use calendar arithmetic rather than fixed durations.
