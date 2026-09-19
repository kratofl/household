# ADR 0021: Base Currency Locks After Financial Data Exists

- Status: Accepted
- Date: 2026-07-14

## Context

Changing a currency code without converting amounts would reinterpret every
historical value incorrectly. A correct conversion after use would require an
effective date, exchange rate, rounding policy, and historically meaningful
reporting across the transition.

## Decision

The user may change the Budget base currency only before any financial data
exists. Once the first account opening balance, monetary plan, transaction,
allocation, or other monetary record is created, the base currency is locked.

A later currency change requires a dedicated migration capability and is outside
the current Budget completion scope.

## Consequences

- First-use setup warns that the currency becomes fixed when financial tracking
  begins.
- The system never relabels existing numeric amounts as a different currency.
- Deleting visible transactions does not unlock the currency if historical or
  audit records have existed.
- A future migration must define conversion and historical-reporting behavior
  explicitly.
