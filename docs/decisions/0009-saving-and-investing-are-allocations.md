# ADR 0009: Saving and Investing Are Allocations

- Status: Superseded in part by ADR 0040
- Date: 2026-07-14

## Context

Users want to plan and measure saving and investing separately from fixed costs
and ordinary spending. Treating these movements as expenses would incorrectly
report consumption and reduce total tracked net worth even though the money still
belongs to the user.

## Decision

Saving and investing are modeled as planned allocations fulfilled by transfers
to tracked savings or investment accounts. They are not expense categories.

An allocation reduces money available for ordinary spending and contributes to
the relevant savings or investment plan, while the transfer itself does not
reduce total value across the user's tracked accounts.

## Consequences

- Reports distinguish consumption from saving and investing.
- Savings and investment destinations participate in the account ledger.
- Planned and actual allocation amounts can be compared per interval and over
  time.
- A future purchase funded from an accumulated allocation must consume the
  associated reserve without charging ordinary available spending a second time.
- Investment valuation and spendable-gain behavior is defined by ADR 0042 and
  ADR 0043.
