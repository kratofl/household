# ADR 0017: Ordinary Spending Availability Is Calculated

- Status: Accepted
- Date: 2026-07-14

## Context

Budget has expected income, committed expenses, gradual reserves, planned saving
and investing, an income buffer, and deficit carryover. An independently entered
spending limit could exceed the money supporting it and make every downstream
metric misleading.

## Decision

Budget calculates the maximum ordinary spending availability for a period from
its funded components:

```text
income
- committed expenses due in the period
- gradual reservations
- planned saving and investing
- available-income buffer
- prior uncovered deficit
+ reserves explicitly released for spending
= maximum ordinary spending availability
```

The user may choose a lower personal spending cap. The difference remains an
additional reserve. A higher cap requires explicitly releasing real reserves; it
cannot create unfunded availability.

## Consequences

- The UI explains the calculation rather than presenting one opaque limit.
- Each deduction links to the plans, allocations, or carryover that caused it.
- Forecast and actual income-variance behavior is defined by ADR 0018 and
  ADR 0019.
- Releasing a reserve changes its purpose assignment but does not fabricate
  account income.
- The current freely editable `spending_limit_cents` model does not represent the
  agreed source-of-funds calculation by itself.
