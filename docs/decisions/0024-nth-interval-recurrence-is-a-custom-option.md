# ADR 0024: Nth-Interval Recurrence Is a Custom Option

- Status: Accepted
- Date: 2026-07-14

## Context

Some plans recur every two weeks or every three months, but exposing interval
counts as the primary schedule UI would make common plan creation unnecessarily
complex.

## Decision

The standard recurrence choices are simple presets: daily, weekly, monthly,
quarterly, and yearly.

An additional **Custom** choice exposes an interval count and unit, allowing
schedules such as every two weeks or every three months. The plan's start date is
the recurrence anchor, so moving or correcting one occurrence does not shift the
schedule.

## Consequences

- Common plans use a concise form with no interval-count field.
- Custom recurrence supports positive whole-number intervals only.
- Forecasting and occurrence generation share the same anchored calendar rule.
- The API and persistence model support interval counts even though the standard
  UI hides them until Custom is selected.
