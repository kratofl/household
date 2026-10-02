# ADR 0041: Existing Savings and Investments Have Opening Allocations

- Status: Accepted
- Date: 2026-07-14

## Context

A new Budget user may already have savings, funded goals, or investments. Starting
all purpose balances at zero would make the overview immediately incorrect, while
recording existing value as new income would distort the first Budget period.

## Decision

Initial Budget setup allows dated opening allocations for:

- individual savings goals;
- unallocated savings or buffer; and
- investments.

Opening allocations establish starting purpose balances. They are not reported as
income and do not increase the first period's ordinary spending availability.
Later changes use the normal traceable contribution, withdrawal, reallocation,
purchase, or correction workflows.

## Consequences

- Existing financial progress appears accurately from the first overview.
- Every opening value records its effective date and remains distinguishable from
  later activity.
- Goal-allocation exclusivity applies to opening savings as well as later
  contributions.
- Correcting an opening allocation is a traceable correction, not a silent reset.
- Investment valuation behavior is defined by ADR 0042 and ADR 0043.
