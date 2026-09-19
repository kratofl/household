# ADR 0043: Investment Gains Do Not Automatically Fund Spending

- Status: Accepted
- Date: 2026-07-15

## Context

An investment valuation can rise without producing spendable cash. Adding
unrealized gains to ordinary spending availability would fund the Budget with
money the user has not withdrawn and may not be able to spend immediately.

## Decision

Unrealized investment gains and losses affect only investment value and
performance reporting. They do not change buffer, savings allocations, or
ordinary spending availability.

Only an actual investment withdrawal creates value that can be reassigned. The
user explicitly routes the withdrawn amount to unallocated buffer, savings goals,
or ordinary spending availability.

## Consequences

- Budget never treats a market valuation as received income.
- Withdrawals are dated actual events and remain distinct from contributions and
  valuation snapshots.
- Investment performance accounts for withdrawals without erasing earlier gains
  or losses.
- No destination is chosen silently; the safe default for an unassigned
  withdrawal is unallocated buffer.
