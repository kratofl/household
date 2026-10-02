# ADR 0031: Category History Is Preserved

- Status: Accepted
- Date: 2026-07-14

## Context

Older project notes proposed leaving transactions uncategorized when their
category is deleted. That would change historical reports and remove the meaning
the user assigned when recording the transaction. Renaming a shared mutable
category would have a similar retroactive effect.

## Decision

Categories with financial history are archived rather than deleted. An archived
category is unavailable for new transactions but remains inspectable in history.

Each transaction preserves the category name and color that applied when it was
posted. Renaming or recoloring a category applies prospectively and does not
change prior transaction presentation or reports.

## Consequences

- Historical category reports remain stable and explainable.
- Active category pickers exclude archived categories by default.
- Historical views can still filter by the enduring category identity and show
  the version applicable at the time.
- A new category may reuse an old display name without becoming the same
  historical category.
- Transactions originally posted without a category remain genuinely
  uncategorized; archival does not make categorized transactions uncategorized.
