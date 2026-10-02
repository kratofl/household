# ADR 0042: Investments Have Manual Valuation Snapshots

- Status: Accepted
- Date: 2026-07-15

## Context

Investment contributions alone do not show the current value or performance of
an investment. The current Budget slice intentionally has no brokerage or market
price integration, but users still need a useful investment overview.

## Decision

Budget tracks contributed investment capital separately from current investment
value. The user may enter dated manual valuation snapshots.

The overview shows current value, contributed capital, and gain or loss in both
base-currency amount and percentage. Earlier valuation snapshots remain available
for historical charts and corrections.

## Consequences

- Investment progress remains useful without external market-data dependencies.
- A new valuation changes performance reporting but is not income and does not
  automatically change ordinary spending availability.
- Snapshot history supports a value-over-time view.
- Correcting a valuation preserves the original and correction history.
- Contribution, withdrawal, and valuation effects must remain distinct in
  calculations.
