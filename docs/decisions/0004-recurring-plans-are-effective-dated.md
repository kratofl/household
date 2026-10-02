# ADR 0004: Recurring Plans Are Effective-Dated

- Status: Accepted
- Date: 2026-07-14

## Context

Budget needs recurring income, fixed costs, subscriptions, and savings or
investment contributions. Users must be able to change, pause, stop, or schedule
these plans without causing prior months to be recalculated from the latest
definition.

The current `planned_expenses` model is a mutable definition. Transactions that
have already been applied retain their amounts, but the model cannot faithfully
represent scheduled future changes or the historical definition that produced
an occurrence.

## Decision

Recurring items are effective-dated plans that produce period-specific
occurrences.

- A plan has an explicit start date and may have a stop date or paused periods.
- A new plan may start now or on a future date.
- Changes apply from an explicitly selected effective date.
- Recorded past occurrences remain unchanged when a plan changes.
- Supported recurrence intervals must include daily, weekly, monthly, quarterly,
  and yearly where the kind of plan allows them.
- The occurrence records the values that applied at the time, so historical
  reporting does not depend on the current version of a plan.

## Consequences

- Editing a recurring plan must not update historical transactions or prior
  period totals.
- A change that should affect the future requires a new effective version or an
  equivalent immutable schedule segment, not an in-place historical rewrite.
- Pausing and stopping are dated schedule changes rather than destructive
  deletion.
- Forecasts use the versions effective in each future period.
- Posting and reservation behavior is defined by ADR 0005, ADR 0007, ADR 0050,
  and ADR 0051.
