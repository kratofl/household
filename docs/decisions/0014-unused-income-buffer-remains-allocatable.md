# ADR 0014: Unused Income Buffer Remains Allocatable

- Status: Superseded in part by ADR 0040
- Date: 2026-07-14

## Context

The available-income buffer withholds real money from ordinary spending during a
Budget period. At period end, that money still exists and may remain in the same
financial account or be moved elsewhere. Resetting it would hide value; forcing
one destination would not match different user strategies.

## Decision

Unused actual buffer does not expire at period end. The user can:

- keep it accumulated as an unallocated reserve, including while it physically
  remains in the existing account;
- allocate it to one or more savings goals;
- transfer and allocate it to investing; or
- explicitly add it to the following period's spending limit.

The purpose assignment is separate from the physical account location. Leaving
money in a checking account does not make it ordinary spending money while it is
still reserved.

## Consequences

- Period close preserves the buffer and exposes its destination or retained
  status.
- Adding buffer to a later spending limit changes planning availability without
  fabricating an account transaction.
- Moving buffer to a savings or investment account uses an actual ledger
  transfer and the corresponding allocation.
- Reallocations are explicit and historically traceable; prior-period results
  remain unchanged.
- Default and override behavior is defined by ADR 0015.
