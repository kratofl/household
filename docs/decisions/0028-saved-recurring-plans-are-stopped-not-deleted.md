# ADR 0028: Saved Recurring Plans Are Stopped, Not Deleted

- Status: Accepted
- Date: 2026-07-14

## Context

Asking users to simulate cancellation by manually entering today or tomorrow as
an end date is technical and error-prone. Hard deletion would remove the plan
needed to explain prior occurrences and reports.

## Decision

A saved recurring plan is stopped through a direct, context-appropriate action
such as Stop, End, or Cancel Subscription. The user does not need to enter an end
date for an immediate stop.

Stopping records the effective stop time, prevents future occurrences, and moves
the plan out of active views into history. It does not delete the plan, its
versions, occurrences, or linked transactions.

## Consequences

- Active lists remain focused while historical reports stay explainable.
- The action requires a clear confirmation that states which future occurrences
  will be removed from the forecast.
- A stopped plan is read-only in normal active workflows but remains inspectable
  in history.
- Recreating a similar future plan creates a new effective plan rather than
  rewriting the stopped one.
- Cancelling an unsaved form is merely a UI action and creates no historical plan.
