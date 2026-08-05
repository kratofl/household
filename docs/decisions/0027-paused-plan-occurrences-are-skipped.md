# ADR 0027: Paused-Plan Occurrences Are Skipped

- Status: Accepted
- Date: 2026-07-14

## Context

Pausing a recurring plan may otherwise leave ambiguity about whether occurrences
inside the pause become overdue and should be generated when the plan resumes.
Automatically catching them up could create unexpected expenses or income.

## Decision

A pause has a start date and may have an end date. Occurrences whose scheduled
dates fall inside the pause are skipped permanently and are not generated or
posted when the plan resumes.

If a skipped obligation is actually paid later, the user records a separate
actual transaction or explicit one-off occurrence.

## Consequences

- Resuming continues with the next normally scheduled occurrence after the pause.
- Forecasts display the pause and contain no amounts for skipped dates.
- Pause history remains visible and does not modify earlier occurrences.
- Ending an open-ended pause is an effective-dated future change.
