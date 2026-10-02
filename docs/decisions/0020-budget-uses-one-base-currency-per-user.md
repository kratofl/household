# ADR 0020: Budget Uses One Base Currency Per User

- Status: Accepted
- Date: 2026-07-14

## Context

The guided first-use setup will ask the user to select a currency. Supporting a
different currency per account would also require exchange rates, dated
valuations, conversion gains and losses, and rules for combined reporting.

## Decision

Each user has one Budget base currency. All accounts, plans, transactions,
allocations, limits, and reports in the current slice use that currency.

Foreign-currency accounts and automatic currency conversion are deferred.

## Consequences

- First-use Budget setup requires a base-currency choice.
- Monetary values store integer minor units together with an ISO 4217 currency
  code or an unambiguous reference to the user's configured code.
- Formatting respects the selected currency's minor-unit rules rather than
  assuming every currency has two decimal places.
- Combined totals need no exchange-rate conversion in the current slice.
- Changing the base currency after financial history exists requires a separate,
  historically safe rule.
