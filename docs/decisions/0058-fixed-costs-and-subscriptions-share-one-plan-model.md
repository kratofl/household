# ADR 0058: Fixed Costs and Subscriptions Share One Plan Model

- Status: Accepted
- Date: 2026-07-16

## Context

Fixed costs and subscriptions both describe recurring commitments with schedules,
effective-dated changes, pauses, stops, expected occurrences, posting behavior,
and optional gradual reservation. Separate engines would duplicate rules and risk
inconsistent history.

## Decision

Fixed cost and Subscription are distinct kinds of one recurring-commitment plan
model. They share recurrence, versioning, pause, stop, reminder, posting, and
reservation behavior.

Kind-specific differences are presentation, wording, grouping, filtering, and
reporting—for example “Cancel subscription” versus “Stop fixed cost.”

## Consequences

- A behavior fix applies consistently to both kinds.
- Users can change a plan's future kind through the effective-dated edit workflow
  without rewriting prior occurrences.
- APIs and persistence expose one commitment contract with a validated kind.
- New commitment kinds can reuse the same deep scheduling model when their
  semantics genuinely match.
