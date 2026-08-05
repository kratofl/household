# ADR 0010: Wishlist Items Can Be Promoted to Savings Goals

- Status: Accepted
- Date: 2026-07-14

## Context

Users want a lightweight reminder list for higher-value things they may buy one
day, as well as structured savings goals with plans, contributions, progress,
and eventual actual spending. Requiring every reminder to be a funded goal would
make casual capture too heavy, while keeping the concepts unrelated would force
duplicate entry when intent becomes a plan.

## Decision

A Budget wishlist item and a savings goal are distinct but linkable concepts.

A wishlist item may contain a name, estimated price, priority, and notes without
any funding plan. When the user decides to fund it, they can promote it or link
it to a savings goal with a target amount, optional target date, contribution
plan, progress, and eventual purchase.

## Consequences

- Users can capture future wants without committing Budget funds.
- Promotion or linking reuses item details rather than requiring duplicate data.
- Removing or completing a wishlist item must not silently destroy the linked
  goal's financial history.
- The Budget wishlist is limited to financially significant future purchases;
  it does not replace the broader Household shopping-list slice.
