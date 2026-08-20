# ADR 0039: Financial Accounts Use One Simple Model

- Status: Superseded by ADR 0040
- Date: 2026-07-14

## Context

Mirroring real-world banking product categories such as checking, savings,
investment, cash, and credit can make setup and overview more complex without
improving the user's Budget decisions. The product should simplify financial
tracking rather than reproduce institutional terminology.

## Decision

Budget uses one unified financial-account model without mandatory account types.
Users name accounts according to their own mental model and may choose simple
display metadata such as an icon or color.

Required financial behavior is expressed through direct, understandable settings
rather than inferred from a bank-product type.

## Consequences

- Account creation remains short and does not require choosing a taxonomy.
- All accounts use the same ledger, transfer, correction, and reconciliation
  rules.
- Reports do not split accounts into artificial product-type sections unless the
  user organizes them explicitly.
- Behavior such as inclusion in spendable totals or permitting a negative balance
  must be decided through explicit settings, not hidden type logic.
- Future bank integrations may retain provider-specific account metadata without
  exposing it as the core Budget model.
