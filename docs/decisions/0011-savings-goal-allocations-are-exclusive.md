# ADR 0011: Savings-Goal Allocations Are Exclusive

- Status: Accepted
- Date: 2026-07-14

## Context

One physical savings account may hold money intended for several goals as well as
a general buffer. If the same money can count toward several goals, displayed
progress can exceed the amount actually available and make the plan impossible
to fulfill.

## Decision

Each unit of saved money is allocated to at most one savings goal. Money that is
not assigned to a goal remains explicitly unallocated, for example as a general
buffer.

A tracked savings account may contain allocations for many goals, but the sum of
its goal allocations cannot exceed the money available for allocation in that
account.

## Consequences

- Goal progress is backed by exclusively allocated money rather than overlapping
  claims on one balance.
- The UI shows goal allocations separately from unallocated savings.
- Reallocating money between goals is an explicit, historically traceable action.
- Completing, pausing, or deleting a goal must provide an explicit destination
  for any remaining allocation rather than silently duplicating or losing it.
- Physical account balances remain ledger-derived; goal allocations are a
  purpose-assignment layer over eligible saved money.
