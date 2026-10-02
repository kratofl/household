# ADR 0030: Actual Transactions Are Voided, Not Deleted

- Status: Accepted
- Date: 2026-07-14

## Context

A completely incorrect or duplicate actual transaction should no longer affect
balances or reports. Hard deletion would remove the explanation for a historical
balance change and make audit trails incomplete.

## Decision

The user voids an incorrect actual transaction through a clear Void action. The
void removes the transaction's effective financial and reporting impact while
preserving the original record, void time, and user-provided reason in history.

## Consequences

- Ledger-derived balances exclude the voided transaction exactly once.
- Ordinary reports hide voided transactions by default, with an option to include
  or inspect them in history.
- Voiding one side of a transfer voids both sides atomically.
- An expected occurrence linked to a voided automatically posted transaction is
  marked resolved as voided and is not automatically posted again.
- Restoring a voided transaction, if supported later, must be another traceable
  action rather than history mutation.
