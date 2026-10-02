# ADR 0044: Goal-Funded Purchases Consume the Goal Allocation

- Status: Accepted
- Date: 2026-07-15

## Context

Money assigned to a savings goal has already been removed from ordinary spending
availability. Charging a later purchase against the ordinary monthly Budget again
would double-count the same economic use.

## Decision

An actual purchase may be linked to a savings goal. Its funded amount reduces the
goal's allocated balance and is not charged a second time against ordinary
spending availability.

The purchase remains an actual expense in the ledger and historical consumption
reports. Partial purchases are supported and consume only their linked funded
amount.

## Consequences

- Reports can distinguish ordinary monthly spending from goal-funded purchases
  while still showing total actual consumption.
- A purchase links to the goal allocation entries that fund it.
- Goal progress and remaining funded balance update immediately after the actual
  purchase.
- Voiding or refunding a goal-funded purchase restores the associated goal
  allocation unless the user explicitly reroutes it.
- Underfunded and overfunded purchase behavior is defined by ADR 0045.
