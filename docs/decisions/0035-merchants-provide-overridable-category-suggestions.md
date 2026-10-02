# ADR 0035: Merchants Provide Overridable Category Suggestions

- Status: Accepted
- Date: 2026-07-14

## Context

Users often assign the same category to transactions from one merchant, but a
merchant can also serve several purposes. Automatically applying one category
without confirmation would save clicks at the cost of hidden mistakes.

## Decision

After a merchant is selected, Budget ranks category suggestions using that
user's previously confirmed merchant-category choices. The likely category may
be preselected or shown first, but remains visible and freely changeable before
saving.

Budget learns only from confirmed user choices, not from discarded suggestions.

## Consequences

- Repeated manual entry becomes faster without losing control.
- Several categories can remain plausible for one merchant.
- Archived categories are excluded from new suggestions.
- Changing a suggestion affects only the current entry; later rankings learn from
  the confirmed result.
- Category suggestions never change historical transactions.
