# ADR 0013: Income Buffer Supports Fixed or Percentage Mode

- Status: Accepted
- Date: 2026-07-14

## Context

Users need to withhold part of each Budget period's income from ordinary spending
availability. A stable-income user may prefer a fixed amount, while a user with
variable income may prefer a proportional buffer.

## Decision

The user selects one available-income buffer mode:

- **Fixed amount:** withhold a configured monetary amount per Budget period.
- **Percentage:** withhold a configured percentage of the period's income.

The forecasted percentage buffer uses expected income. The actual percentage
buffer is based on actual posted income, so deviations remain visible rather
than being hidden.

## Consequences

- The UI clearly identifies the active mode and does not apply both modes at the
  same time.
- Buffer configuration changes apply prospectively and do not rewrite historical
  period results.
- Reports distinguish expected and actual buffered amounts.
- Insufficient-income behavior is defined by ADR 0065; accumulation and period
  close are defined by ADR 0014 and ADR 0015.
