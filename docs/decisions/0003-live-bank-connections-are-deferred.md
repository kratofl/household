# ADR 0003: Live Bank Connections Are Deferred

- Status: Accepted
- Date: 2026-07-14

## Context

A complete Budget workflow needs financial accounts and transactions, but it
does not necessarily need automated access to external banks. Live connectivity
would add provider selection, credential and consent handling, synchronization,
duplicate detection, reconciliation, and provider-specific failure recovery.

The current implementation supports manual transaction entry and has no bank
integration layer.

## Decision

The current Budget slice will use user-managed financial accounts and manually
recorded financial data. Direct bank connectivity is not required for the slice
to be considered complete.

## Consequences

- Finish the account and transaction workflows without introducing bank API
  providers or storing bank credentials.
- The manual workflow must be genuinely usable and cannot rely on a future bank
  connection to fill functional gaps.
- Live bank synchronization remains a separate future capability.
- Import, export, and reconciliation behavior are separate decisions; this ADR
  does not include or exclude them.
