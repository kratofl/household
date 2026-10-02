# ADR 0065: Buffer Cannot Create an Unfunded Deficit

- Status: Accepted
- Date: 2026-07-17

## Context

A fixed buffer target may exceed the income remaining after mandatory
commitments and other higher-priority deductions. Reserving the full configured
amount would create artificial negative spending availability even though a
buffer is intended as protection.

## Decision

Budget reserves no more buffer than the period can actually fund. If a configured
fixed or percentage buffer cannot be met, Budget reserves the available amount
and shows the difference as a buffer-target shortfall.

The shortfall does not create a deficit and is not caught up automatically in a
later period. The user may explicitly change the plan or contribute more later.

## Consequences

- Buffer calculation is capped at funded availability after higher-priority
  commitments.
- Overview and reports distinguish target, actual buffered amount, and shortfall.
- A buffer shortfall does not become deficit carryover.
- Percentage buffers use actual posted income for their actual result and obey the
  same funding cap.
