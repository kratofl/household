# ADR 0049: Missed Goal Contributions Trigger Visible Replanning

- Status: Accepted
- Date: 2026-07-15

## Context

An expected savings contribution may be skipped or posted for less than planned.
Treating the difference as hidden debt would make available spending and goal
progress hard to understand.

## Decision

A missed or insufficient goal contribution does not create an automatic debt.
Budget marks the goal as behind plan and calculates a transparent updated
projection:

- a date-driven goal shows the higher future contribution required to retain its
  target date;
- a rate-driven goal shows the later expected funding date at its current rate.

The user confirms any recurring-plan change. Until then, actual progress and the
original plan remain visibly distinct.

## Consequences

- Budget never silently takes more from a later period.
- Catch-up contributions can still be entered explicitly.
- Notifications can link directly to the replanning comparison.
- Historical expected and actual contributions remain available for performance
  reporting.
