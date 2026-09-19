# ADR 0062: Transaction Timeline Has Search and Composable Filters

- Status: Accepted
- Date: 2026-07-16

## Context

A combined timeline of expected, actual, skipped, automatically posted, refunded,
and voided items becomes difficult to use without focused retrieval controls.

## Decision

The Transactions view supports text search over merchant and notes, plus
composable filters for:

- date range or Budget period;
- category;
- status;
- income, expense, or refund;
- recurring or one-time origin; and
- Budget-impact behavior.

Active filters remain visible, can be removed individually, and can all be reset
with one action.

## Consequences

- Search and filters apply consistently to list totals and exported results.
- Filter state is representable in the URL where practical so views can be
  revisited.
- Mobile controls use an accessible compact filter surface without losing any
  option.
- Empty results preserve the active-filter context and offer a reset action.
- Archived categories and historical merchants remain searchable for historical
  transactions.
