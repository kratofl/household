# ADR 0036: One Transaction Can Have Multiple Category Splits

- Status: Accepted
- Date: 2026-07-14

## Context

One purchase may serve several purposes, such as groceries and household goods
on one supermarket receipt. Duplicating the account transaction would overstate
the ledger, while forcing one category would make category reports inaccurate.

## Decision

One actual transaction may contain several category splits selected through a
multi-category entry workflow. Each split has a category and monetary amount.

The splits must sum exactly to the transaction total. The financial-account
ledger contains one transaction for the full amount; Budget reports and limit
behavior operate on the individual splits.

## Consequences

- Included and excluded category behavior is evaluated per split.
- Correcting or voiding the parent transaction updates all splits consistently.
- Historical category snapshots are retained separately for each split.
- Merchant identity remains on the parent transaction and does not need to be
  duplicated for each split.
- The split-entry interaction must make any unassigned remainder visible and
  prevent saving an unbalanced transaction.
