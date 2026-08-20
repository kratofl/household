# ADR 0023: Recurring Due Dates Clamp Without Drifting

- Status: Accepted
- Date: 2026-07-14

## Context

Monthly, quarterly, or yearly plans may use a desired day that does not exist in
every target month. Moving the stored schedule permanently after a short month
would make later occurrences drift away from the user's intent.

## Decision

A recurring plan retains its originally selected due day. When that day does not
exist for one occurrence, the occurrence uses the target month's final calendar
day. A later occurrence returns to the selected day whenever it exists.

The same rule applies to yearly February 29 schedules in non-leap years.

## Consequences

- An item due on the 31st occurs on the final day of February and on the 31st in
  March.
- The generated occurrence stores its actual clamped date while retaining a link
  to the unchanged plan version.
- Date generation uses calendar semantics and is deterministic across forecasts
  and actual posting.
