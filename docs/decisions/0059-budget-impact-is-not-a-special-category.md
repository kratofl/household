# ADR 0059: Budget Impact Is Not a Special Category

- Status: Accepted
- Date: 2026-07-16

## Context

Older product notes and the current implementation use a protected category for
expenses excluded from the spending limit. That mixes what an expense was for
with how it affects the current Budget, and it becomes especially awkward for
split transactions.

## Decision

Budget has no required, non-deletable “not counted” category.

Each category has a default Budget-impact behavior. Each transaction or category
split exposes a visible override when its treatment differs from that default.
The effective behavior is retained in the historical snapshot.

## Consequences

- Merchant and purpose categories remain meaningful regardless of Budget
  treatment.
- Different splits of one transaction may have different Budget impact.
- The UI makes overrides visible in entry and history rather than hiding them in
  a synthetic category.
- Archived-category and historical-behavior rules remain unchanged.
- The current protected default category must not be treated as a required target
  concept during implementation.
