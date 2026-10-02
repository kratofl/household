# ADR 0033: Categories and Merchants Have Distinct Visual Identities

- Status: Accepted
- Date: 2026-07-14

## Context

Users need fast visual scanning. A category such as Groceries describes spending
purpose, while REWE or EDEKA identifies the merchant. Treating a brand logo as a
category icon would mix those concepts and prevent several merchants from sharing
one category.

## Decision

Categories may have a user-selectable icon in addition to their name and color.

Transactions may reference a normalized merchant or brand identity with its own
display name and logo. Known brands such as retailers or subscription providers
show the appropriate logo; unknown merchants use a consistent generic fallback.

Category identity and merchant identity remain independent.

## Consequences

- Transaction lists and summaries can show both purpose and merchant at a glance.
- Changing a category icon does not rename or merge merchants.
- Merchant normalization, logo sourcing, caching, licensing, and user overrides
  require explicit implementation rules.
- Logos are decorative metadata and never determine ledger or budget behavior by
  themselves.
