# ADR 0025: Multiple Weekdays Are a Custom Recurrence

- Status: Accepted
- Date: 2026-07-14

## Context

A standard weekly plan usually has one occurrence on the weekday of its start
date. Some income or expense patterns occur on several weekdays, but showing a
weekday matrix for every weekly plan would make the common workflow heavier.

## Decision

The standard Weekly preset uses the weekday of the plan's start date.

Custom recurrence may select several weekdays. Each matching weekday produces a
separate expected occurrence. For every-N-week schedules, the start date anchors
which weeks are active.

## Consequences

- Common weekly plans need no separate weekday control.
- Advanced plans can represent patterns such as Monday and Thursday without
  duplicating the plan.
- Amounts apply per generated occurrence unless explicitly described otherwise
  in the form.
- Forecast generation must remain deterministic across week and year boundaries.
