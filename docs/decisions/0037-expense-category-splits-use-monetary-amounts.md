# ADR 0037: Expense Category Splits Use Monetary Amounts

- Status: Accepted
- Date: 2026-07-14

## Context

Expense splits commonly come from concrete receipt amounts. Percentage entry
would force users to calculate or correct rounding even when the source already
provides exact monetary values.

## Decision

After selecting several categories, the user assigns a monetary amount to each
expense split. Budget continuously shows the unassigned remainder and suggests
the full remaining amount for the final split.

The transaction cannot be saved until the split amounts equal its total exactly.

## Consequences

- Receipt entry maps directly to visible monetary amounts.
- No percentage rounding is needed for expense category splits.
- Editing the transaction total immediately revalidates all splits and exposes
  any new remainder or over-allocation.
- The contribution-allocation workflow may still support percentages; this ADR
  applies specifically to expense category splits.
