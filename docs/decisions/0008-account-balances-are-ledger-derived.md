# ADR 0008: Account Balances Are Ledger-Derived

- Status: Superseded in part by ADR 0040
- Date: 2026-07-14

## Context

The current implementation stores a mutable account balance and subtracts newly
created expenses from it. It has no opening-balance workflow, income, transfers,
or explainable reconciliation. A direct balance edit can therefore make the
displayed balance disagree with transaction history.

Reliable historical tracking requires every balance change to have a dated,
inspectable cause.

## Decision

An account balance is derived from its opening balance and actual ledger entries.
Ledger entries cover income, expenses, transfers, and explicit reconciliation
adjustments.

Users do not silently overwrite a current balance. When the recorded balance
differs from reality, reconciliation creates a dated adjustment that explains the
difference.

## Consequences

- Actual transactions, not expected occurrences, change account balances.
- Editing or reversing a transaction must preserve an auditable explanation and
  must not silently corrupt later balances.
- A transfer must update both sides consistently and must not change the user's
  total balance across tracked accounts.
- The current `accounts.balance_cents` mutation model must be replaced or treated
  only as a safely maintained projection of the authoritative ledger.
- Reports can reconstruct historical balances as of a date.
