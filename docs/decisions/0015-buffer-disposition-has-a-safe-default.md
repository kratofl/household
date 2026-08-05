# ADR 0015: Buffer Disposition Has a Safe Default

- Status: Accepted
- Date: 2026-07-14

## Context

At period end, accumulated income buffer may be retained, allocated to saving or
investing, or released into a later spending limit. Requiring repetitive input
for the common case creates friction, while silently moving money can violate the
user's intent.

## Decision

The user can configure a default buffer-disposition rule and override it for an
individual Budget period.

The system default is to retain unused buffer as an unallocated reserve. Budget
does not automatically save, invest, or release buffer into spending unless the
user has explicitly selected that rule.

## Consequences

- Period close can apply an already chosen rule without asking the same question
  every time.
- The selected disposition and any per-period override remain visible and
  historically traceable.
- The unallocated-reserve default avoids irreversible or surprising movements.
- Overspending and buffer protection is defined by ADR 0016.
