# ADR 0034: Manual Transactions Use a Suggested Merchant Field

- Status: Accepted
- Date: 2026-07-14

## Context

The current Budget slice uses manual transaction entry. Requiring a raw bank-like
description such as a statement line would be cumbersome and would make merchant
recognition an unnecessary prerequisite for normal entry.

## Decision

Manual expense entry has a first-class merchant field alongside category,
amount, date, account, and optional notes.

As the user types, Budget suggests known brands and merchants from the user's own
history. Selecting a known merchant attaches its normalized identity and logo.
The user can still enter a new merchant when no suggestion fits.

## Consequences

- A normal entry reads conceptually as “expense at REWE, category X, amount Y.”
- Merchant suggestions reduce typing without silently choosing a counterparty.
- User-created merchants participate in future suggestions and can use the
  generic logo fallback.
- Raw statement-text normalization remains useful for a future import feature but
  is not the primary manual-entry workflow.
- Merchant and category remain separate fields even if category suggestions are
  later derived from merchant history.
