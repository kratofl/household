# ADR 0040: One Budget Ledger Per User

- Status: Accepted
- Date: 2026-07-14
- Supersedes: ADR 0039; supersedes parts of ADR 0008, ADR 0009, and ADR 0014

## Context

The product goal is a simpler answer to “what can I still spend this month?” and
“what is my saving or investment progress?” Modeling several real bank accounts,
their product types, balances, and transfers would reproduce financial-system
complexity that the Budget slice is intended to remove.

## Decision

Each user has one Budget ledger, not a collection of tracked bank accounts.

Actual income, expenses, refunds, corrections, and voids are recorded in that
ledger. Budget maintains purpose balances and allocations for ordinary spending,
buffer, savings goals, and investing. Moving value between those purposes is an
allocation change, not a transfer between bank-account entities.

The primary overview shows:

- ordinary spending still available in the current period;
- accumulated protected buffer; and
- savings and investment progress and balances.

The physical location of money in the user's real-world bank accounts is outside
the current Budget model.

## Consequences

- The target model has no user-managed bank-account list, account types, or
  account-to-account transfers.
- Manual transaction entry does not require selecting a bank account.
- Saving or investing reduces ordinary spending availability and increases its
  corresponding purpose balance without being reported as consumption.
- Historical totals remain derived from the single user ledger and its traceable
  corrections.
- The current backend `accounts` table and required transaction `account_id` do
  not match the target domain.
- Real bank-account tracking or synchronization may be introduced later as a
  separate capability without defining the current Budget experience.
